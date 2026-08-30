import type {
  DateTimeRenderOption,
  DimensionKind,
  GoogleSheetsConfig,
  MajorDimension,
  ValueInputOption,
  ValueRenderOption,
} from "./types.js";
import { GoogleSheetsError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Drive API v3 root. An internal dependency only: spreadsheet search and
 * permission management have no Sheets API equivalent. raw_request stays
 * pinned to the Sheets origin and can never reach it.
 */
export const DRIVE_BASE = "https://www.googleapis.com/";

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

type QueryValue = string | number | boolean | string[] | undefined;

/**
 * A cell rectangle in the batchUpdate coordinate system: numeric sheetId plus
 * 0-based half-open row/column indexes (start inclusive, end exclusive; an
 * omitted edge extends to the sheet's bound). The values endpoints use A1
 * notation instead — the two schemes never mix.
 */
export interface GridRangeParams {
  sheetId: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

/** A run of rows or columns for dimension operations (0-based, end exclusive). */
export interface DimensionRangeParams {
  sheetId: number;
  dimension: DimensionKind;
  startIndex: number;
  endIndex: number;
}

/** Normalized inputs for format_cells; buildCellFormat maps them to CellFormat + fields mask. */
export interface FormatCellsParams {
  spreadsheetId: string;
  range: GridRangeParams;
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  horizontalAlignment?: "LEFT" | "CENTER" | "RIGHT";
  verticalAlignment?: "TOP" | "MIDDLE" | "BOTTOM";
  wrapStrategy?: "OVERFLOW_CELL" | "CLIP" | "WRAP";
  numberFormatType?: "TEXT" | "NUMBER" | "PERCENT" | "CURRENCY" | "DATE" | "TIME" | "DATE_TIME" | "SCIENTIFIC";
  numberFormatPattern?: string;
}

/** One border side: line style plus optional color. */
export interface BorderParams {
  style: "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE" | "NONE";
  color?: string;
}

/** Normalized chart inputs; buildChartSpec maps them to a ChartSpec (or passes `spec` through). */
export interface ChartSpecParams {
  chartType?: "COLUMN" | "BAR" | "LINE" | "AREA" | "STEPPED_AREA" | "SCATTER" | "PIE";
  title?: string;
  domainRange?: GridRangeParams;
  seriesRanges?: GridRangeParams[];
  legendPosition?: string;
  headerCount?: number;
  /** Raw ChartSpec — full control; wins over every other field. */
  spec?: Record<string, unknown>;
}

/** Normalized inputs for a conditional-format boolean rule. */
export interface ConditionalRuleParams {
  ranges: GridRangeParams[];
  conditionType: string;
  conditionValues?: string[];
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Parses "#RRGGBB" into the API's { red, green, blue } floats (0..1, rounded
 * to 3 decimals so request bodies stay stable and diffable in tests).
 */
export function hexToColor(hex: string): { red: number; green: number; blue: number } {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) throw new Error(`Invalid color ${JSON.stringify(hex)} — expected "#RRGGBB", e.g. "#1A73E8".`);
  const n = parseInt(match[1], 16);
  const channel = (v: number) => Math.round((v / 255) * 1000) / 1000;
  return { red: channel((n >> 16) & 0xff), green: channel((n >> 8) & 0xff), blue: channel(n & 0xff) };
}

/**
 * Builds a CellFormat plus the matching fields mask from the normalized
 * format_cells vocabulary. Pure wire mapping — only the provided fields make it
 * into the mask, so untouched formatting survives.
 */
export function buildCellFormat(p: FormatCellsParams): { format: Record<string, unknown>; fields: string } {
  if (p.numberFormatPattern !== undefined && p.numberFormatType === undefined) {
    throw new Error("number_format_pattern requires number_format_type.");
  }
  const textFormat = compact({
    bold: p.bold,
    italic: p.italic,
    strikethrough: p.strikethrough,
    underline: p.underline,
    fontSize: p.fontSize,
    fontFamily: p.fontFamily,
    foregroundColor: p.textColor === undefined ? undefined : hexToColor(p.textColor),
  });
  const numberFormat =
    p.numberFormatType === undefined ? undefined : compact({ type: p.numberFormatType, pattern: p.numberFormatPattern });
  const format = compact({
    backgroundColor: p.backgroundColor === undefined ? undefined : hexToColor(p.backgroundColor),
    textFormat: Object.keys(textFormat).length > 0 ? textFormat : undefined,
    horizontalAlignment: p.horizontalAlignment,
    verticalAlignment: p.verticalAlignment,
    wrapStrategy: p.wrapStrategy,
    numberFormat,
  });

  const fields: string[] = [];
  if (format.backgroundColor !== undefined) fields.push("userEnteredFormat.backgroundColor");
  for (const key of Object.keys(textFormat)) fields.push(`userEnteredFormat.textFormat.${key}`);
  if (p.horizontalAlignment !== undefined) fields.push("userEnteredFormat.horizontalAlignment");
  if (p.verticalAlignment !== undefined) fields.push("userEnteredFormat.verticalAlignment");
  if (p.wrapStrategy !== undefined) fields.push("userEnteredFormat.wrapStrategy");
  if (numberFormat !== undefined) fields.push("userEnteredFormat.numberFormat");
  if (fields.length === 0) throw new Error("At least one formatting field is required.");
  return { format, fields: fields.join(",") };
}

const sourceRange = (range: GridRangeParams) => ({ sourceRange: { sources: [gridRange(range)] } });

/**
 * Builds a ChartSpec from the normalized chart vocabulary, or passes a raw
 * `spec` through untouched. PIE maps to pieChart (one domain + one series);
 * every other type maps to basicChart with LEFT_AXIS series.
 */
export function buildChartSpec(p: ChartSpecParams): Record<string, unknown> {
  if (p.spec) return p.spec;
  if (!p.chartType) throw new Error("chart_type is required (or pass a raw spec).");
  if (p.chartType === "PIE") {
    if (!p.domainRange || !p.seriesRanges || p.seriesRanges.length !== 1) {
      throw new Error("A PIE chart needs domain_range (labels) and exactly one series_ranges entry (values).");
    }
    return compact({
      title: p.title,
      pieChart: compact({
        legendPosition: p.legendPosition,
        domain: sourceRange(p.domainRange),
        series: sourceRange(p.seriesRanges[0]),
      }),
    });
  }
  if (!p.seriesRanges || p.seriesRanges.length === 0) {
    throw new Error("series_ranges is required — one range per data series (or pass a raw spec).");
  }
  return compact({
    title: p.title,
    basicChart: compact({
      chartType: p.chartType,
      legendPosition: p.legendPosition,
      headerCount: p.headerCount ?? 1,
      domains: p.domainRange ? [{ domain: sourceRange(p.domainRange) }] : undefined,
      series: p.seriesRanges.map((range) => ({ series: sourceRange(range), targetAxis: "LEFT_AXIS" })),
    }),
  });
}

/** Builds a booleanRule conditional-format rule from the normalized vocabulary. */
export function buildConditionalRule(p: ConditionalRuleParams): Record<string, unknown> {
  if (p.ranges.length === 0) throw new Error("At least one range is required.");
  const textFormat = compact({
    bold: p.bold,
    italic: p.italic,
    foregroundColor: p.textColor === undefined ? undefined : hexToColor(p.textColor),
  });
  const format = compact({
    backgroundColor: p.backgroundColor === undefined ? undefined : hexToColor(p.backgroundColor),
    textFormat: Object.keys(textFormat).length > 0 ? textFormat : undefined,
  });
  if (Object.keys(format).length === 0) {
    throw new Error("At least one of background_color, text_color, bold or italic is required.");
  }
  return {
    ranges: p.ranges.map(gridRange),
    booleanRule: {
      condition: buildCondition(p.conditionType, p.conditionValues),
      format,
    },
  };
}

/** Maps a condition type + values to the API's BooleanCondition. */
function buildCondition(type: string, values?: string[]): Record<string, unknown> {
  return compact({
    type,
    values: values && values.length > 0 ? values.map((userEnteredValue) => ({ userEnteredValue })) : undefined,
  });
}

/** Strips undefined index fields so unbounded edges are truly omitted on the wire. */
function gridRange(range: GridRangeParams): Record<string, unknown> {
  return compact({
    sheetId: range.sheetId,
    startRowIndex: range.startRowIndex,
    endRowIndex: range.endRowIndex,
    startColumnIndex: range.startColumnIndex,
    endColumnIndex: range.endColumnIndex,
  });
}

export class GoogleSheetsClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleSheetsConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_SHEETS_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, text } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleSheetsError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_SHEETS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_SHEETS_ACCESS_TOKEN fetch a spreadsheet instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level request against one of the two API roots. Auth is a Bearer token
   * (refreshed transparently; a 401 forces one re-mint + retry). 429 is always
   * retried with backoff; 5xx and network errors/timeouts are retried only for
   * GET — the Sheets API has real writes, and replaying one after an ambiguous
   * failure could apply it twice (append duplicates rows, batchUpdate re-adds
   * sheets/rules). Any other non-2xx throws a {@link GoogleSheetsError}.
   */
  private async httpRequest<T = unknown>(
    base: string,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasBody = body !== undefined && method !== "GET";

    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the Bearer token can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), base);
    if (url.origin !== new URL(base).origin) {
      throw new Error(`the path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, item);
        else url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasBody) headers["Content-Type"] = "application/json";

      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(
          target,
          { method, headers, body: hasBody ? JSON.stringify(body) : undefined },
          path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleSheetsError(res.status, data);
      return data as T;
    }
  }

  /** Request against the Sheets API root (raw_request and every typed Sheets method). */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    return this.httpRequest<T>(this.base, method, path, body, query);
  }

  /** Request against the Drive API root — internal (search, permissions, smoke cleanup). */
  private async driveRequest<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    return this.httpRequest<T>(DRIVE_BASE, method, path, body, query);
  }

  // ---- Spreadsheets ----

  /** Creates a spreadsheet, optionally with named sheets (otherwise one default "Sheet1"). */
  async createSpreadsheet(p: {
    title: string;
    sheetTitles?: string[];
    locale?: string;
    timeZone?: string;
  }): Promise<unknown> {
    return this.request("POST", "v4/spreadsheets", compact({
      properties: compact({ title: p.title, locale: p.locale, timeZone: p.timeZone }),
      sheets: p.sheetTitles?.length ? p.sheetTitles.map((title) => ({ properties: { title } })) : undefined,
    }));
  }

  /** Spreadsheet metadata (and optionally cell data for the given A1 ranges). */
  async getSpreadsheet(p: {
    spreadsheetId: string;
    ranges?: string[];
    includeGridData?: boolean;
    fields?: string;
  }): Promise<unknown> {
    return this.request(
      "GET",
      `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}`,
      undefined,
      compact({ ranges: p.ranges, includeGridData: p.includeGridData, fields: p.fields }),
    );
  }

  /** Finds spreadsheets by name via the Drive API (internal dependency; needs a Drive scope). */
  async searchSpreadsheets(p: {
    nameContains?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
  }): Promise<unknown> {
    const terms = [`mimeType='${SPREADSHEET_MIME}'`, "trashed=false"];
    if (p.nameContains) {
      // Drive query strings escape backslashes and single quotes.
      const escaped = p.nameContains.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      terms.push(`name contains '${escaped}'`);
    }
    return this.driveRequest("GET", "drive/v3/files", undefined, {
      q: terms.join(" and "),
      pageSize: p.pageSize,
      pageToken: p.pageToken,
      orderBy: p.orderBy ?? "modifiedTime desc",
      fields: "nextPageToken,files(id,name,createdTime,modifiedTime,owners(emailAddress,displayName),webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });
  }

  /** Low-level batchUpdate — the write channel for every structural change. */
  async batchUpdate(
    spreadsheetId: string,
    requests: unknown[],
    opts: { includeSpreadsheetInResponse?: boolean } = {},
  ): Promise<unknown> {
    return this.request(
      "POST",
      `v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      compact({
        requests,
        includeSpreadsheetInResponse: opts.includeSpreadsheetInResponse,
      }),
    );
  }

  // ---- Values ----

  /** Reads one or more A1 ranges in a single batchGet call. */
  async getValues(p: {
    spreadsheetId: string;
    ranges: string[];
    valueRenderOption?: ValueRenderOption;
    majorDimension?: MajorDimension;
    dateTimeRenderOption?: DateTimeRenderOption;
  }): Promise<unknown> {
    return this.request(
      "GET",
      `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values:batchGet`,
      undefined,
      compact({
        ranges: p.ranges,
        valueRenderOption: p.valueRenderOption,
        majorDimension: p.majorDimension,
        dateTimeRenderOption: p.dateTimeRenderOption,
      }),
    );
  }

  /** Overwrites one A1 range with a 2-D values matrix. */
  async updateValues(p: {
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: ValueInputOption;
    includeValuesInResponse?: boolean;
  }): Promise<unknown> {
    return this.request(
      "PUT",
      `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values/${encodeURIComponent(p.range)}`,
      { values: p.values },
      compact({
        valueInputOption: p.valueInputOption ?? "USER_ENTERED",
        includeValuesInResponse: p.includeValuesInResponse,
      }),
    );
  }

  /** Overwrites several A1 ranges in one batchUpdate call (counts as one write against the quota). */
  async batchUpdateValues(p: {
    spreadsheetId: string;
    data: { range: string; values: unknown[][] }[];
    valueInputOption?: ValueInputOption;
  }): Promise<unknown> {
    return this.request("POST", `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values:batchUpdate`, {
      valueInputOption: p.valueInputOption ?? "USER_ENTERED",
      data: p.data,
    });
  }

  /** Appends rows after the last row of the table that contains the range. */
  async appendValues(p: {
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: ValueInputOption;
    insertDataOption?: "OVERWRITE" | "INSERT_ROWS";
  }): Promise<unknown> {
    return this.request(
      "POST",
      `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values/${encodeURIComponent(p.range)}:append`,
      { values: p.values },
      compact({
        valueInputOption: p.valueInputOption ?? "USER_ENTERED",
        insertDataOption: p.insertDataOption,
      }),
    );
  }

  /** Clears the values of one or more A1 ranges (formatting, notes and validation survive). */
  async clearValues(p: { spreadsheetId: string; ranges: string[] }): Promise<unknown> {
    return this.request("POST", `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values:batchClear`, {
      ranges: p.ranges,
    });
  }

  // ---- Sheets (tabs) ----

  /** Adds a sheet (tab); index positions it, rowCount/columnCount size the grid. */
  async addSheet(p: {
    spreadsheetId: string;
    title: string;
    index?: number;
    rowCount?: number;
    columnCount?: number;
  }): Promise<unknown> {
    const gridProperties = compact({ rowCount: p.rowCount, columnCount: p.columnCount });
    return this.batchUpdate(p.spreadsheetId, [
      {
        addSheet: {
          properties: compact({
            title: p.title,
            index: p.index,
            gridProperties: Object.keys(gridProperties).length > 0 ? gridProperties : undefined,
          }),
        },
      },
    ]);
  }

  /** Duplicates a sheet within the same spreadsheet. */
  async duplicateSheet(p: {
    spreadsheetId: string;
    sheetId: number;
    newTitle?: string;
    insertIndex?: number;
  }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      {
        duplicateSheet: compact({
          sourceSheetId: p.sheetId,
          newSheetName: p.newTitle,
          insertSheetIndex: p.insertIndex,
        }),
      },
    ]);
  }

  /** Renames a sheet (the sheetId never changes; only the visible title does). */
  async renameSheet(p: { spreadsheetId: string; sheetId: number; title: string }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      { updateSheetProperties: { properties: { sheetId: p.sheetId, title: p.title }, fields: "title" } },
    ]);
  }

  /** Deletes a sheet and everything on it. Irreversible through the API. */
  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<unknown> {
    return this.batchUpdate(spreadsheetId, [{ deleteSheet: { sheetId } }]);
  }

  /** Copies a sheet into another spreadsheet (returns the new sheet's properties there). */
  async copySheetTo(p: {
    spreadsheetId: string;
    sheetId: number;
    destinationSpreadsheetId: string;
  }): Promise<unknown> {
    return this.request(
      "POST",
      `v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/sheets/${p.sheetId}:copyTo`,
      { destinationSpreadsheetId: p.destinationSpreadsheetId },
    );
  }

  // ---- Formatting, dimensions, freeze, borders ----

  /** Applies a partial CellFormat to a range via repeatCell with a computed fields mask. */
  async formatCells(p: FormatCellsParams): Promise<unknown> {
    const { format, fields } = buildCellFormat(p);
    return this.batchUpdate(p.spreadsheetId, [
      { repeatCell: { range: gridRange(p.range), cell: { userEnteredFormat: format }, fields } },
    ]);
  }

  /** Freezes (or unfreezes with 0) the first N rows/columns of a sheet. */
  async setFrozen(p: {
    spreadsheetId: string;
    sheetId: number;
    frozenRowCount?: number;
    frozenColumnCount?: number;
  }): Promise<unknown> {
    const gridProperties = compact({
      frozenRowCount: p.frozenRowCount,
      frozenColumnCount: p.frozenColumnCount,
    });
    const fields = Object.keys(gridProperties)
      .map((key) => `gridProperties.${key}`)
      .join(",");
    if (!fields) throw new Error("At least one of frozen_rows or frozen_columns is required.");
    return this.batchUpdate(p.spreadsheetId, [
      { updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties }, fields } },
    ]);
  }

  /** Sets the borders of a range (outer sides and/or inner grid lines). */
  async setBorders(p: {
    spreadsheetId: string;
    range: GridRangeParams;
    top?: BorderParams;
    bottom?: BorderParams;
    left?: BorderParams;
    right?: BorderParams;
    innerHorizontal?: BorderParams;
    innerVertical?: BorderParams;
  }): Promise<unknown> {
    const mapBorder = (b?: BorderParams) =>
      b === undefined ? undefined : compact({ style: b.style, color: b.color === undefined ? undefined : hexToColor(b.color) });
    const borders = compact({
      top: mapBorder(p.top),
      bottom: mapBorder(p.bottom),
      left: mapBorder(p.left),
      right: mapBorder(p.right),
      innerHorizontal: mapBorder(p.innerHorizontal),
      innerVertical: mapBorder(p.innerVertical),
    });
    if (Object.keys(borders).length === 0) {
      throw new Error("At least one border side (top/bottom/left/right/inner_horizontal/inner_vertical) is required.");
    }
    return this.batchUpdate(p.spreadsheetId, [{ updateBorders: { range: gridRange(p.range), ...borders } }]);
  }

  /** Sets rows/columns to an exact pixel size. */
  async resizeDimensions(p: DimensionRangeParams & { spreadsheetId: string; pixelSize: number }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      {
        updateDimensionProperties: {
          range: dimensionRange(p),
          properties: { pixelSize: p.pixelSize },
          fields: "pixelSize",
        },
      },
    ]);
  }

  /** Auto-fits rows/columns to their content. */
  async autoResizeDimensions(p: DimensionRangeParams & { spreadsheetId: string }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [{ autoResizeDimensions: { dimensions: dimensionRange(p) } }]);
  }

  /** Inserts empty rows/columns at startIndex. */
  async insertDimensions(
    p: DimensionRangeParams & { spreadsheetId: string; inheritFromBefore?: boolean },
  ): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      { insertDimension: compact({ range: dimensionRange(p), inheritFromBefore: p.inheritFromBefore }) },
    ]);
  }

  /** Deletes rows/columns and their data. Irreversible through the API. */
  async deleteDimensions(p: DimensionRangeParams & { spreadsheetId: string }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [{ deleteDimension: { range: dimensionRange(p) } }]);
  }

  /** Hides or shows rows/columns without touching their data. */
  async setDimensionsHidden(
    p: DimensionRangeParams & { spreadsheetId: string; hidden: boolean },
  ): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      {
        updateDimensionProperties: {
          range: dimensionRange(p),
          properties: { hiddenByUser: p.hidden },
          fields: "hiddenByUser",
        },
      },
    ]);
  }

  /** Groups rows/columns so they collapse/expand together (groups can nest). */
  async groupDimensions(p: DimensionRangeParams & { spreadsheetId: string }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [{ addDimensionGroup: { range: dimensionRange(p) } }]);
  }

  /** Removes the deepest group over the given rows/columns. */
  async ungroupDimensions(p: DimensionRangeParams & { spreadsheetId: string }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [{ deleteDimensionGroup: { range: dimensionRange(p) } }]);
  }

  // ---- Data validation, protected ranges, conditional formatting ----

  /**
   * Sets (or, with no condition, clears) a data-validation rule on a range.
   * ONE_OF_LIST turns into an in-cell dropdown when showCustomUi is true.
   */
  async setDataValidation(p: {
    spreadsheetId: string;
    range: GridRangeParams;
    conditionType?: string;
    conditionValues?: string[];
    inputMessage?: string;
    strict?: boolean;
    showCustomUi?: boolean;
  }): Promise<unknown> {
    const rule =
      p.conditionType === undefined
        ? undefined
        : compact({
            condition: buildCondition(p.conditionType, p.conditionValues),
            inputMessage: p.inputMessage,
            strict: p.strict,
            showCustomUi: p.showCustomUi,
          });
    return this.batchUpdate(p.spreadsheetId, [
      { setDataValidation: compact({ range: gridRange(p.range), rule }) },
    ]);
  }

  /** Protects a range or a whole sheet (range without row/column bounds). */
  async addProtectedRange(p: {
    spreadsheetId: string;
    range?: GridRangeParams;
    namedRangeId?: string;
    description?: string;
    warningOnly?: boolean;
    editorUsers?: string[];
    editorGroups?: string[];
  }): Promise<unknown> {
    if (!p.range && !p.namedRangeId) throw new Error("Either range or named_range_id is required.");
    const editors =
      p.editorUsers || p.editorGroups
        ? compact({ users: p.editorUsers, groups: p.editorGroups })
        : undefined;
    return this.batchUpdate(p.spreadsheetId, [
      {
        addProtectedRange: {
          protectedRange: compact({
            range: p.range ? gridRange(p.range) : undefined,
            namedRangeId: p.namedRangeId,
            description: p.description,
            warningOnly: p.warningOnly,
            editors,
          }),
        },
      },
    ]);
  }

  /** Updates a protected range's description/warning mode/editors with a computed fields mask. */
  async updateProtectedRange(p: {
    spreadsheetId: string;
    protectedRangeId: number;
    description?: string;
    warningOnly?: boolean;
    editorUsers?: string[];
    editorGroups?: string[];
  }): Promise<unknown> {
    const editors =
      p.editorUsers || p.editorGroups
        ? compact({ users: p.editorUsers, groups: p.editorGroups })
        : undefined;
    const protectedRange = compact({
      protectedRangeId: p.protectedRangeId,
      description: p.description,
      warningOnly: p.warningOnly,
      editors,
    });
    const fields = Object.keys(protectedRange)
      .filter((key) => key !== "protectedRangeId")
      .join(",");
    if (!fields) throw new Error("At least one of description, warning_only or editors is required.");
    return this.batchUpdate(p.spreadsheetId, [{ updateProtectedRange: { protectedRange, fields } }]);
  }

  /** Removes a protection (the cells and their data stay). */
  async deleteProtectedRange(spreadsheetId: string, protectedRangeId: number): Promise<unknown> {
    return this.batchUpdate(spreadsheetId, [{ deleteProtectedRange: { protectedRangeId } }]);
  }

  /** Adds a boolean conditional-format rule at the given per-sheet index (default: first). */
  async addConditionalFormat(
    p: ConditionalRuleParams & { spreadsheetId: string; index?: number },
  ): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      { addConditionalFormatRule: { rule: buildConditionalRule(p), index: p.index ?? 0 } },
    ]);
  }

  /** Replaces the rule at a per-sheet index with a new boolean rule. */
  async updateConditionalFormat(
    p: ConditionalRuleParams & { spreadsheetId: string; sheetId: number; index: number },
  ): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      { updateConditionalFormatRule: { sheetId: p.sheetId, index: p.index, rule: buildConditionalRule(p) } },
    ]);
  }

  /** Deletes the conditional-format rule at a per-sheet index (later rules shift down). */
  async deleteConditionalFormat(spreadsheetId: string, sheetId: number, index: number): Promise<unknown> {
    return this.batchUpdate(spreadsheetId, [{ deleteConditionalFormatRule: { sheetId, index } }]);
  }

  // ---- Tables ----

  /** Adds a structured table over a range. */
  async addTable(p: {
    spreadsheetId: string;
    name: string;
    range: GridRangeParams;
    columnProperties?: unknown[];
  }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      {
        addTable: {
          table: compact({ name: p.name, range: gridRange(p.range), columnProperties: p.columnProperties }),
        },
      },
    ]);
  }

  /** Renames and/or re-ranges a table with a computed fields mask. */
  async updateTable(p: {
    spreadsheetId: string;
    tableId: string;
    name?: string;
    range?: GridRangeParams;
  }): Promise<unknown> {
    const table = compact({
      tableId: p.tableId,
      name: p.name,
      range: p.range ? gridRange(p.range) : undefined,
    });
    const fields = Object.keys(table)
      .filter((key) => key !== "tableId")
      .join(",");
    if (!fields) throw new Error("At least one of name or range is required.");
    return this.batchUpdate(p.spreadsheetId, [{ updateTable: { table, fields } }]);
  }

  /** Deletes a table definition (the underlying cell data stays). */
  async deleteTable(spreadsheetId: string, tableId: string): Promise<unknown> {
    return this.batchUpdate(spreadsheetId, [{ deleteTable: { tableId } }]);
  }

  // ---- Charts ----

  /** Adds an embedded chart, anchored over the grid or on its own new sheet. */
  async addChart(
    p: ChartSpecParams & {
      spreadsheetId: string;
      anchor?: { sheetId: number; rowIndex: number; columnIndex: number };
      newSheet?: boolean;
    },
  ): Promise<unknown> {
    if (!p.anchor && !p.newSheet) {
      throw new Error("Either anchor (sheet_id + row_index + column_index) or new_sheet=true is required.");
    }
    const position = p.newSheet ? { newSheet: true } : { overlayPosition: { anchorCell: p.anchor } };
    return this.batchUpdate(p.spreadsheetId, [
      { addChart: { chart: { spec: buildChartSpec(p), position } } },
    ]);
  }

  /** Replaces a chart's entire spec (updateChartSpec has no partial mask). */
  async updateChart(p: ChartSpecParams & { spreadsheetId: string; chartId: number }): Promise<unknown> {
    return this.batchUpdate(p.spreadsheetId, [
      { updateChartSpec: { chartId: p.chartId, spec: buildChartSpec(p) } },
    ]);
  }

  /** Deletes an embedded chart by its chartId. */
  async deleteChart(spreadsheetId: string, chartId: number): Promise<unknown> {
    return this.batchUpdate(spreadsheetId, [{ deleteEmbeddedObject: { objectId: chartId } }]);
  }

  // ---- Sharing (Drive permissions — internal dependency) ----

  /**
   * Lists who can access the spreadsheet — one page per call. Shared-drive
   * files cap a page at 100 permissions, so the fields mask must keep
   * `nextPageToken` or a long list is truncated silently.
   */
  async listPermissions(p: {
    spreadsheetId: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<unknown> {
    return this.driveRequest(
      "GET",
      `drive/v3/files/${encodeURIComponent(p.spreadsheetId)}/permissions`,
      undefined,
      {
        fields: "nextPageToken,permissions(id,type,role,emailAddress,domain,displayName,deleted)",
        pageSize: p.pageSize,
        pageToken: p.pageToken,
        supportsAllDrives: true,
      },
    );
  }

  /** Grants reader/commenter/writer access to a user, group, domain or anyone. */
  async grantPermission(p: {
    spreadsheetId: string;
    role: "reader" | "commenter" | "writer";
    type: "user" | "group" | "domain" | "anyone";
    emailAddress?: string;
    domain?: string;
    allowFileDiscovery?: boolean;
    sendNotificationEmail?: boolean;
    emailMessage?: string;
  }): Promise<unknown> {
    if ((p.type === "user" || p.type === "group") && !p.emailAddress) {
      throw new Error(`type "${p.type}" requires email_address.`);
    }
    if (p.type === "domain" && !p.domain) throw new Error('type "domain" requires domain.');
    return this.driveRequest(
      "POST",
      `drive/v3/files/${encodeURIComponent(p.spreadsheetId)}/permissions`,
      compact({
        role: p.role,
        type: p.type,
        emailAddress: p.emailAddress,
        domain: p.domain,
        allowFileDiscovery: p.allowFileDiscovery,
      }),
      compact({
        sendNotificationEmail: p.sendNotificationEmail,
        emailMessage: p.emailMessage,
        supportsAllDrives: true,
      }),
    );
  }

  /** Changes an existing permission's role. */
  async updatePermission(p: {
    spreadsheetId: string;
    permissionId: string;
    role: "reader" | "commenter" | "writer";
  }): Promise<unknown> {
    return this.driveRequest(
      "PATCH",
      `drive/v3/files/${encodeURIComponent(p.spreadsheetId)}/permissions/${encodeURIComponent(p.permissionId)}`,
      { role: p.role },
      { supportsAllDrives: true },
    );
  }

  /** Revokes a permission by its id. */
  async revokePermission(spreadsheetId: string, permissionId: string): Promise<unknown> {
    return this.driveRequest(
      "DELETE",
      `drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions/${encodeURIComponent(permissionId)}`,
      undefined,
      { supportsAllDrives: true },
    );
  }

  /**
   * Trashes the spreadsheet's Drive file. NOT exposed as a tool — deleting
   * spreadsheets is outside the functional contour; this exists only so the
   * opt-in live smoke can clean up the disposable spreadsheet it created.
   */
  async deleteSpreadsheetFile(spreadsheetId: string): Promise<unknown> {
    return this.driveRequest(
      "DELETE",
      `drive/v3/files/${encodeURIComponent(spreadsheetId)}`,
      undefined,
      { supportsAllDrives: true },
    );
  }
}

/** Maps a DimensionRangeParams (plus extras) to the wire DimensionRange. */
function dimensionRange(p: DimensionRangeParams): Record<string, unknown> {
  return { sheetId: p.sheetId, dimension: p.dimension, startIndex: p.startIndex, endIndex: p.endIndex };
}

/** Drops keys whose value is `undefined` so they are not sent to the API. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
