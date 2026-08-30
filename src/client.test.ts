import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCellFormat,
  buildChartSpec,
  buildConditionalRule,
  GoogleSheetsClient,
  hexToColor,
} from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleSheetsConfig } from "./types.js";

const BASE = "https://sheets.googleapis.com";
const DRIVE = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; auth: unknown; body: string | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleSheetsConfig> = {}): GoogleSheetsConfig {
  return { accessToken: "STATIC", apiBase: BASE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleSheetsConfig> = {}): GoogleSheetsConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      body: typeof i.body === "string" ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

/** The single batchUpdate request object of the recorded call. */
function batchRequest(call: Call): Record<string, unknown> {
  const body = JSON.parse(call.body!) as { requests: Record<string, unknown>[] };
  assert.equal(body.requests.length, 1);
  return body.requests[0];
}

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.getSpreadsheet({ spreadsheetId: "abc" }),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The historical startup error, verbatim — the message is the product.
        assert.ok(
          err.message.startsWith(
            "Google OAuth credentials are required: set GOOGLE_SHEETS_CLIENT_ID + " +
              "GOOGLE_SHEETS_CLIENT_SECRET + GOOGLE_SHEETS_REFRESH_TOKEN (recommended), " +
              "or GOOGLE_SHEETS_ACCESS_TOKEN with a short-lived access token.",
          ),
          "the message must open with the historical startup error, verbatim",
        );
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("no credentials: the Drive-backed methods fail the same way, before any fetch", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(() => client.searchSpreadsheets({}), CredentialsError);
    await assert.rejects(() => client.listPermissions({ spreadsheetId: "abc" }), CredentialsError);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).getSpreadsheet({ spreadsheetId: "abc" });
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/abc`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(refreshConfig());
    await client.getSpreadsheet({ spreadsheetId: "abc" });
    await client.getSpreadsheet({ spreadsheetId: "def" });

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(tokenCalls[0].body);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSheetsClient(refreshConfig()).getSpreadsheet({ spreadsheetId: "abc" });
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleSheetsClient(refreshConfig()).getSpreadsheet({ spreadsheetId: "abc" }),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleSheetsClient(refreshConfig()).getSpreadsheet({ spreadsheetId: "abc" }),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Spreadsheet endpoint mapping ----

test("createSpreadsheet posts properties and one sheet per title", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).createSpreadsheet({
      title: "Budget",
      sheetTitles: ["Data", "Summary"],
      locale: "ru_RU",
      timeZone: "Europe/Moscow",
    });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets`);
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      properties: { title: "Budget", locale: "ru_RU", timeZone: "Europe/Moscow" },
      sheets: [{ properties: { title: "Data" } }, { properties: { title: "Summary" } }],
    });
  } finally {
    mock.restore();
  }
});

test("createSpreadsheet without sheet titles sends no sheets array", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).createSpreadsheet({ title: "Solo" });
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { properties: { title: "Solo" } });
  } finally {
    mock.restore();
  }
});

test("getSpreadsheet appends each range and passes the query flags", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).getSpreadsheet({
      spreadsheetId: "s",
      ranges: ["A1:B2", "Sheet2!C:C"],
      includeGridData: true,
      fields: "sheets.properties",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v4/spreadsheets/s");
    assert.deepEqual(url.searchParams.getAll("ranges"), ["A1:B2", "Sheet2!C:C"]);
    assert.equal(url.searchParams.get("includeGridData"), "true");
    assert.equal(url.searchParams.get("fields"), "sheets.properties");
  } finally {
    mock.restore();
  }
});

test("searchSpreadsheets goes to the Drive origin with an escaped q", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).searchSpreadsheets({
      nameContains: "Bob's \\report",
      pageSize: 10,
      pageToken: "tok",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin, DRIVE, "search is a Drive API call, not a Sheets one");
    assert.equal(url.pathname, "/drive/v3/files");
    assert.equal(
      url.searchParams.get("q"),
      "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains 'Bob\\'s \\\\report'",
    );
    assert.equal(url.searchParams.get("pageSize"), "10");
    assert.equal(url.searchParams.get("pageToken"), "tok");
    assert.equal(url.searchParams.get("orderBy"), "modifiedTime desc");
    assert.match(String(url.searchParams.get("fields")), /files\(id,name/);
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

// ---- Values endpoint mapping ----

test("getValues batchGets every range with the render options", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).getValues({
      spreadsheetId: "s",
      ranges: ["Sheet1!A1:B2", "Sheet2!A:A"],
      valueRenderOption: "FORMULA",
      majorDimension: "COLUMNS",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v4/spreadsheets/s/values:batchGet");
    assert.deepEqual(url.searchParams.getAll("ranges"), ["Sheet1!A1:B2", "Sheet2!A:A"]);
    assert.equal(url.searchParams.get("valueRenderOption"), "FORMULA");
    assert.equal(url.searchParams.get("majorDimension"), "COLUMNS");
    assert.equal(url.searchParams.get("dateTimeRenderOption"), "FORMATTED_STRING");
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].body, undefined);
  } finally {
    mock.restore();
  }
});

test("updateValues PUTs the matrix to the encoded range with USER_ENTERED by default", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).updateValues({
      spreadsheetId: "s",
      range: "'My sheet'!A1:B2",
      values: [
        ["a", 1],
        ["b", 2],
      ],
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, `/v4/spreadsheets/s/values/${encodeURIComponent("'My sheet'!A1:B2")}`);
    assert.equal(url.searchParams.get("valueInputOption"), "USER_ENTERED");
    assert.equal(mock.calls[0].method, "PUT");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      values: [
        ["a", 1],
        ["b", 2],
      ],
    });
  } finally {
    mock.restore();
  }
});

test("batchUpdateValues posts all ranges in one call", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).batchUpdateValues({
      spreadsheetId: "s",
      data: [
        { range: "A1", values: [["x"]] },
        { range: "B1", values: [["y"]] },
      ],
      valueInputOption: "RAW",
    });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/s/values:batchUpdate`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      valueInputOption: "RAW",
      data: [
        { range: "A1", values: [["x"]] },
        { range: "B1", values: [["y"]] },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("appendValues posts to :append with the insert option", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).appendValues({
      spreadsheetId: "s",
      range: "Sheet1!A1:C1",
      values: [["new", "row", 3]],
      insertDataOption: "INSERT_ROWS",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, `/v4/spreadsheets/s/values/${encodeURIComponent("Sheet1!A1:C1")}:append`);
    assert.equal(url.searchParams.get("valueInputOption"), "USER_ENTERED");
    assert.equal(url.searchParams.get("insertDataOption"), "INSERT_ROWS");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { values: [["new", "row", 3]] });
  } finally {
    mock.restore();
  }
});

test("clearValues batchClears the ranges", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).clearValues({ spreadsheetId: "s", ranges: ["A1:B2", "D:D"] });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/s/values:batchClear`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { ranges: ["A1:B2", "D:D"] });
  } finally {
    mock.restore();
  }
});

// ---- Sheet management mapping ----

test("addSheet builds addSheet with optional grid properties", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.addSheet({ spreadsheetId: "s", title: "Data", index: 1, rowCount: 50, columnCount: 5 });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/s:batchUpdate`);
    assert.deepEqual(batchRequest(mock.calls[0]), {
      addSheet: { properties: { title: "Data", index: 1, gridProperties: { rowCount: 50, columnCount: 5 } } },
    });
    await client.addSheet({ spreadsheetId: "s", title: "Plain" });
    assert.deepEqual(batchRequest(mock.calls[1]), { addSheet: { properties: { title: "Plain" } } });
  } finally {
    mock.restore();
  }
});

test("duplicate/rename/delete sheet map to their batchUpdate requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.duplicateSheet({ spreadsheetId: "s", sheetId: 7, newTitle: "Copy", insertIndex: 2 });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      duplicateSheet: { sourceSheetId: 7, newSheetName: "Copy", insertSheetIndex: 2 },
    });
    await client.renameSheet({ spreadsheetId: "s", sheetId: 7, title: "Renamed" });
    assert.deepEqual(batchRequest(mock.calls[1]), {
      updateSheetProperties: { properties: { sheetId: 7, title: "Renamed" }, fields: "title" },
    });
    await client.deleteSheet("s", 7);
    assert.deepEqual(batchRequest(mock.calls[2]), { deleteSheet: { sheetId: 7 } });
  } finally {
    mock.restore();
  }
});

test("copySheetTo posts to the sheet's copyTo endpoint", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).copySheetTo({
      spreadsheetId: "src",
      sheetId: 3,
      destinationSpreadsheetId: "dst",
    });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/src/sheets/3:copyTo`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { destinationSpreadsheetId: "dst" });
  } finally {
    mock.restore();
  }
});

// ---- Formatting mapping ----

test("hexToColor parses #RRGGBB and rejects junk", () => {
  assert.deepEqual(hexToColor("#FF0000"), { red: 1, green: 0, blue: 0 });
  assert.deepEqual(hexToColor("#000000"), { red: 0, green: 0, blue: 0 });
  assert.deepEqual(hexToColor("#1A73E8"), { red: 0.102, green: 0.451, blue: 0.91 });
  for (const bad of ["FF0000", "#FFF", "#GG0000", "red"]) {
    assert.throws(() => hexToColor(bad), /Invalid color/);
  }
});

test("buildCellFormat computes format and mask from only the provided fields", () => {
  const { format, fields } = buildCellFormat({
    spreadsheetId: "s",
    range: { sheetId: 0 },
    backgroundColor: "#FF0000",
    bold: true,
    horizontalAlignment: "CENTER",
    numberFormatType: "PERCENT",
    numberFormatPattern: "0.0%",
  });
  assert.deepEqual(format, {
    backgroundColor: { red: 1, green: 0, blue: 0 },
    textFormat: { bold: true },
    horizontalAlignment: "CENTER",
    numberFormat: { type: "PERCENT", pattern: "0.0%" },
  });
  assert.equal(
    fields,
    "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment,userEnteredFormat.numberFormat",
  );
});

test("buildCellFormat rejects an empty format and a pattern without a type", () => {
  assert.throws(
    () => buildCellFormat({ spreadsheetId: "s", range: { sheetId: 0 } }),
    /At least one formatting field/,
  );
  assert.throws(
    () => buildCellFormat({ spreadsheetId: "s", range: { sheetId: 0 }, numberFormatPattern: "0.0%" }),
    /requires number_format_type/,
  );
});

test("formatCells sends repeatCell with the computed mask and compacted range", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSheetsClient(staticConfig()).formatCells({
      spreadsheetId: "s",
      range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
      bold: true,
    });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      repeatCell: {
        range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    });
  } finally {
    mock.restore();
  }
});

test("setFrozen computes the gridProperties mask and requires at least one field", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.setFrozen({ spreadsheetId: "s", sheetId: 0, frozenRowCount: 1 });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      updateSheetProperties: {
        properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    await client.setFrozen({ spreadsheetId: "s", sheetId: 0, frozenRowCount: 0, frozenColumnCount: 2 });
    assert.deepEqual(batchRequest(mock.calls[1]), {
      updateSheetProperties: {
        properties: { sheetId: 0, gridProperties: { frozenRowCount: 0, frozenColumnCount: 2 } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    });
    await assert.rejects(() => client.setFrozen({ spreadsheetId: "s", sheetId: 0 }), /At least one of/);
  } finally {
    mock.restore();
  }
});

test("setBorders maps sides with colors and requires at least one side", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.setBorders({
      spreadsheetId: "s",
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 2 },
      top: { style: "SOLID_THICK", color: "#FF0000" },
      innerHorizontal: { style: "DOTTED" },
    });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      updateBorders: {
        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 2 },
        top: { style: "SOLID_THICK", color: { red: 1, green: 0, blue: 0 } },
        innerHorizontal: { style: "DOTTED" },
      },
    });
    await assert.rejects(
      () => client.setBorders({ spreadsheetId: "s", range: { sheetId: 0 } }),
      /At least one border side/,
    );
  } finally {
    mock.restore();
  }
});

test("dimension operations build the right batchUpdate requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    const range = { spreadsheetId: "s", sheetId: 1, dimension: "COLUMNS" as const, startIndex: 0, endIndex: 3 };
    const wire = { sheetId: 1, dimension: "COLUMNS", startIndex: 0, endIndex: 3 };

    await client.resizeDimensions({ ...range, pixelSize: 120 });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      updateDimensionProperties: { range: wire, properties: { pixelSize: 120 }, fields: "pixelSize" },
    });
    await client.autoResizeDimensions(range);
    assert.deepEqual(batchRequest(mock.calls[1]), { autoResizeDimensions: { dimensions: wire } });
    await client.insertDimensions({ ...range, inheritFromBefore: true });
    assert.deepEqual(batchRequest(mock.calls[2]), {
      insertDimension: { range: wire, inheritFromBefore: true },
    });
    await client.deleteDimensions(range);
    assert.deepEqual(batchRequest(mock.calls[3]), { deleteDimension: { range: wire } });
    await client.setDimensionsHidden({ ...range, hidden: true });
    assert.deepEqual(batchRequest(mock.calls[4]), {
      updateDimensionProperties: { range: wire, properties: { hiddenByUser: true }, fields: "hiddenByUser" },
    });
    await client.groupDimensions(range);
    assert.deepEqual(batchRequest(mock.calls[5]), { addDimensionGroup: { range: wire } });
    await client.ungroupDimensions(range);
    assert.deepEqual(batchRequest(mock.calls[6]), { deleteDimensionGroup: { range: wire } });
  } finally {
    mock.restore();
  }
});

// ---- Validation / protection / conditional formats mapping ----

test("setDataValidation sets a dropdown rule and clears when no condition is given", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.setDataValidation({
      spreadsheetId: "s",
      range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
      conditionType: "ONE_OF_LIST",
      conditionValues: ["Yes", "No"],
      strict: true,
      showCustomUi: true,
    });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      setDataValidation: {
        range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
        rule: {
          condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Yes" }, { userEnteredValue: "No" }] },
          strict: true,
          showCustomUi: true,
        },
      },
    });
    await client.setDataValidation({ spreadsheetId: "s", range: { sheetId: 0 } });
    assert.deepEqual(batchRequest(mock.calls[1]), { setDataValidation: { range: { sheetId: 0 } } });
  } finally {
    mock.restore();
  }
});

test("protected ranges: add with editors, update with computed mask, delete", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.addProtectedRange({
      spreadsheetId: "s",
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
      description: "Header",
      editorUsers: ["a@example.com"],
    });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      addProtectedRange: {
        protectedRange: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          description: "Header",
          editors: { users: ["a@example.com"] },
        },
      },
    });
    await assert.rejects(() => client.addProtectedRange({ spreadsheetId: "s" }), /range or named_range_id/);

    await client.updateProtectedRange({ spreadsheetId: "s", protectedRangeId: 5, warningOnly: true });
    assert.deepEqual(batchRequest(mock.calls[1]), {
      updateProtectedRange: {
        protectedRange: { protectedRangeId: 5, warningOnly: true },
        fields: "warningOnly",
      },
    });
    await assert.rejects(
      () => client.updateProtectedRange({ spreadsheetId: "s", protectedRangeId: 5 }),
      /At least one of/,
    );

    await client.deleteProtectedRange("s", 5);
    assert.deepEqual(batchRequest(mock.calls[2]), { deleteProtectedRange: { protectedRangeId: 5 } });
  } finally {
    mock.restore();
  }
});

test("buildConditionalRule maps condition + format and validates its inputs", () => {
  assert.deepEqual(
    buildConditionalRule({
      ranges: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10 }],
      conditionType: "NUMBER_GREATER",
      conditionValues: ["100"],
      backgroundColor: "#FF0000",
      bold: true,
    }),
    {
      ranges: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10 }],
      booleanRule: {
        condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "100" }] },
        format: { backgroundColor: { red: 1, green: 0, blue: 0 }, textFormat: { bold: true } },
      },
    },
  );
  assert.throws(
    () => buildConditionalRule({ ranges: [], conditionType: "BLANK", bold: true }),
    /At least one range/,
  );
  assert.throws(
    () => buildConditionalRule({ ranges: [{ sheetId: 0 }], conditionType: "BLANK" }),
    /At least one of background_color/,
  );
});

test("conditional formats: add at index, update replaces the rule, delete by index", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    const rule = { ranges: [{ sheetId: 0 }], conditionType: "NOT_BLANK", backgroundColor: "#00FF00" };
    await client.addConditionalFormat({ spreadsheetId: "s", ...rule });
    const added = batchRequest(mock.calls[0]) as { addConditionalFormatRule: { index: number } };
    assert.equal(added.addConditionalFormatRule.index, 0);

    await client.updateConditionalFormat({ spreadsheetId: "s", sheetId: 3, index: 2, ...rule });
    const updated = batchRequest(mock.calls[1]) as {
      updateConditionalFormatRule: { sheetId: number; index: number; rule: unknown };
    };
    assert.equal(updated.updateConditionalFormatRule.sheetId, 3);
    assert.equal(updated.updateConditionalFormatRule.index, 2);
    assert.ok(updated.updateConditionalFormatRule.rule);

    await client.deleteConditionalFormat("s", 3, 2);
    assert.deepEqual(batchRequest(mock.calls[2]), { deleteConditionalFormatRule: { sheetId: 3, index: 2 } });
  } finally {
    mock.restore();
  }
});

// ---- Tables & charts mapping ----

test("tables: add with columns, update with computed mask, delete", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.addTable({
      spreadsheetId: "s",
      name: "Tasks",
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 3 },
      columnProperties: [{ columnIndex: 0, columnName: "Task", columnType: "TEXT" }],
    });
    assert.deepEqual(batchRequest(mock.calls[0]), {
      addTable: {
        table: {
          name: "Tasks",
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 3 },
          columnProperties: [{ columnIndex: 0, columnName: "Task", columnType: "TEXT" }],
        },
      },
    });
    await client.updateTable({ spreadsheetId: "s", tableId: "t1", name: "Renamed" });
    assert.deepEqual(batchRequest(mock.calls[1]), {
      updateTable: { table: { tableId: "t1", name: "Renamed" }, fields: "name" },
    });
    await assert.rejects(() => client.updateTable({ spreadsheetId: "s", tableId: "t1" }), /At least one of/);
    await client.deleteTable("s", "t1");
    assert.deepEqual(batchRequest(mock.calls[2]), { deleteTable: { tableId: "t1" } });
  } finally {
    mock.restore();
  }
});

test("buildChartSpec maps basic and pie charts, passes raw specs through, validates", () => {
  const domain = { sheetId: 0, startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 };
  const series = { sheetId: 0, startRowIndex: 0, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 };

  assert.deepEqual(buildChartSpec({ chartType: "LINE", title: "Trend", domainRange: domain, seriesRanges: [series] }), {
    title: "Trend",
    basicChart: {
      chartType: "LINE",
      headerCount: 1,
      domains: [{ domain: { sourceRange: { sources: [domain] } } }],
      series: [{ series: { sourceRange: { sources: [series] } }, targetAxis: "LEFT_AXIS" }],
    },
  });

  assert.deepEqual(
    buildChartSpec({ chartType: "PIE", domainRange: domain, seriesRanges: [series], legendPosition: "RIGHT_LEGEND" }),
    {
      pieChart: {
        legendPosition: "RIGHT_LEGEND",
        domain: { sourceRange: { sources: [domain] } },
        series: { sourceRange: { sources: [series] } },
      },
    },
  );

  const raw = { title: "Raw", histogramChart: {} };
  assert.equal(buildChartSpec({ spec: raw }), raw);

  assert.throws(() => buildChartSpec({}), /chart_type is required/);
  assert.throws(() => buildChartSpec({ chartType: "COLUMN" }), /series_ranges is required/);
  assert.throws(() => buildChartSpec({ chartType: "PIE", seriesRanges: [series, series] }), /PIE chart/);
});

test("charts: add anchored or on a new sheet, update replaces the spec, delete", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    const series = { sheetId: 0, startColumnIndex: 1, endColumnIndex: 2 };
    await client.addChart({
      spreadsheetId: "s",
      chartType: "COLUMN",
      seriesRanges: [series],
      anchor: { sheetId: 0, rowIndex: 5, columnIndex: 3 },
    });
    const added = batchRequest(mock.calls[0]) as {
      addChart: { chart: { spec: unknown; position: unknown } };
    };
    assert.deepEqual(added.addChart.chart.position, {
      overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 5, columnIndex: 3 } },
    });

    await client.addChart({ spreadsheetId: "s", chartType: "COLUMN", seriesRanges: [series], newSheet: true });
    const onSheet = batchRequest(mock.calls[1]) as { addChart: { chart: { position: unknown } } };
    assert.deepEqual(onSheet.addChart.chart.position, { newSheet: true });

    await assert.rejects(
      () => client.addChart({ spreadsheetId: "s", chartType: "COLUMN", seriesRanges: [series] }),
      /anchor .* or new_sheet/,
    );

    await client.updateChart({ spreadsheetId: "s", chartId: 9, chartType: "LINE", seriesRanges: [series] });
    const updated = batchRequest(mock.calls[2]) as { updateChartSpec: { chartId: number } };
    assert.equal(updated.updateChartSpec.chartId, 9);

    await client.deleteChart("s", 9);
    assert.deepEqual(batchRequest(mock.calls[3]), { deleteEmbeddedObject: { objectId: 9 } });
  } finally {
    mock.restore();
  }
});

// ---- Permissions (Drive) mapping ----

test("listPermissions GETs the Drive permissions with a field mask that keeps nextPageToken", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.listPermissions({ spreadsheetId: "s" });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/drive/v3/files/s/permissions");
    // Without nextPageToken in the mask, shared-drive files with 100+
    // permissions truncate silently — the token must survive the field mask.
    assert.match(String(url.searchParams.get("fields")), /(^|,)nextPageToken(,|$)/);
    assert.match(String(url.searchParams.get("fields")), /permissions\(id,type,role/);
    assert.equal(url.searchParams.get("pageSize"), null, "no pageSize unless requested");
    assert.equal(url.searchParams.get("pageToken"), null, "no pageToken unless requested");

    await client.listPermissions({ spreadsheetId: "s", pageSize: 50, pageToken: "t1" });
    const paged = new URL(mock.calls[1].url);
    assert.equal(paged.searchParams.get("pageSize"), "50");
    assert.equal(paged.searchParams.get("pageToken"), "t1");
  } finally {
    mock.restore();
  }
});

test("grantPermission validates the grantee and posts the permission", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.grantPermission({
      spreadsheetId: "s",
      role: "writer",
      type: "user",
      emailAddress: "a@example.com",
      sendNotificationEmail: false,
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/drive/v3/files/s/permissions");
    assert.equal(url.searchParams.get("sendNotificationEmail"), "false");
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      role: "writer",
      type: "user",
      emailAddress: "a@example.com",
    });

    await assert.rejects(
      () => client.grantPermission({ spreadsheetId: "s", role: "reader", type: "user" }),
      /requires email_address/,
    );
    await assert.rejects(
      () => client.grantPermission({ spreadsheetId: "s", role: "reader", type: "domain" }),
      /requires domain/,
    );
    assert.equal(mock.calls.length, 1, "validation failures must not reach the API");
  } finally {
    mock.restore();
  }
});

test("updatePermission PATCHes the role; revoke and file cleanup use DELETE", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSheetsClient(staticConfig());
    await client.updatePermission({ spreadsheetId: "s", permissionId: "p1", role: "reader" });
    assert.equal(mock.calls[0].method, "PATCH");
    assert.equal(new URL(mock.calls[0].url).pathname, "/drive/v3/files/s/permissions/p1");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { role: "reader" });

    await client.revokePermission("s", "p1");
    assert.equal(mock.calls[1].method, "DELETE");
    assert.equal(new URL(mock.calls[1].url).pathname, "/drive/v3/files/s/permissions/p1");

    await client.deleteSpreadsheetFile("s");
    assert.equal(mock.calls[2].method, "DELETE");
    assert.equal(new URL(mock.calls[2].url).pathname, "/drive/v3/files/s");
  } finally {
    mock.restore();
  }
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).getSpreadsheet({ spreadsheetId: "s" }),
    () => new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).deleteSheet("s", 0),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).getSpreadsheet({
      spreadsheetId: "s",
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  // A PUT (values write) and a POST (batchUpdate) must both rethrow at once.
  for (const run of [
    () =>
      new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).updateValues({
        spreadsheetId: "s",
        range: "A1",
        values: [["x"]],
      }),
    () => new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).deleteSheet("s", 0),
  ]) {
    n = 0;
    const mock2 = mockFetch(() => {
      n++;
      return new Response("unavailable", { status: 503 });
    });
    try {
      await assert.rejects(run, /HTTP 503/);
      assert.equal(n, 1, "a 503 on a write must not be replayed — the write may have committed");
    } finally {
      mock2.restore();
    }
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSheetsClient(staticConfig({ maxRetries: 2 })).getSpreadsheet({
      spreadsheetId: "s",
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () =>
        new GoogleSheetsClient(staticConfig({ maxRetries: 2 })).appendValues({
          spreadsheetId: "s",
          range: "A1",
          values: [["x"]],
        }),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on an append must not be replayed — rows would duplicate");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleSheetsClient(staticConfig({ maxRetries: 3 })).getSpreadsheet({ spreadsheetId: "s" }),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleSheetsClient(staticConfig({ maxRetries: 2 })).getSpreadsheet({ spreadsheetId: "s" }),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleSheetsClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getSpreadsheet({ spreadsheetId: "s" }).then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleSheetsClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("raw_request cannot cross from the Sheets origin to the Drive origin", async () => {
  const mock = mockFetch(() => okJson({}));
  try {
    await assert.rejects(
      () => new GoogleSheetsClient(staticConfig()).request("GET", "https://www.googleapis.com/drive/v3/files"),
      /foreign origin/,
    );
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleSheetsClient(staticConfig()).request(
      "GET",
      "v4/spreadsheets/s/values/A1:B2?valueRenderOption=FORMULA",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/v4/spreadsheets/s/values/A1:B2?valueRenderOption=FORMULA`);
  } finally {
    mock.restore();
  }
});
