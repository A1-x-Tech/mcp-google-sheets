import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleSheetsClient } from "./client.js";

/**
 * Live smoke check against the real Google APIs.
 *
 * Default mode is READ-ONLY: with a spreadsheet id (argv or
 * GOOGLE_SHEETS_SMOKE_SPREADSHEET_ID) it fetches that spreadsheet's metadata;
 * otherwise it just mints an access token from the refresh token. Either way
 * the credentials are exercised for real and nothing is written.
 *
 * GOOGLE_SHEETS_SMOKE_WRITE=1 opts into the full write cycle on a DISPOSABLE
 * resource: create a throwaway spreadsheet → write values → read them back and
 * verify → trash the Drive file. Cleanup runs in `finally`, i.e. after success
 * AND after a failed step, so nothing durable is left behind. The write cycle
 * needs a Drive scope (drive.file is enough — the file is app-created) for the
 * cleanup step.
 */
async function main(): Promise<void> {
  const client = new GoogleSheetsClient(loadConfig());

  if ((process.env.GOOGLE_SHEETS_SMOKE_WRITE ?? "") === "1") {
    await writeCycle(client);
    return;
  }

  const spreadsheetId = process.argv[2] ?? process.env.GOOGLE_SHEETS_SMOKE_SPREADSHEET_ID;
  if (spreadsheetId) {
    const spreadsheet = (await client.getSpreadsheet({
      spreadsheetId,
      fields: "properties.title,sheets.properties(sheetId,title),spreadsheetUrl",
    })) as {
      properties?: { title?: string };
      sheets?: unknown[];
      spreadsheetUrl?: string;
    };
    console.log(
      JSON.stringify(
        {
          spreadsheetId,
          title: spreadsheet.properties?.title,
          sheets: spreadsheet.sheets?.length ?? 0,
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(JSON.stringify(await client.authCheck(), null, 2));
}

/** Create → write → read back → verify → trash, with cleanup on every exit path. */
async function writeCycle(client: GoogleSheetsClient): Promise<void> {
  const title = `mcp-google-sheets smoke ${new Date().toISOString()}`;
  const created = (await client.createSpreadsheet({ title })) as { spreadsheetId?: string };
  const spreadsheetId = created.spreadsheetId;
  if (!spreadsheetId) throw new Error("createSpreadsheet returned no spreadsheetId");
  console.error(`created disposable spreadsheet ${spreadsheetId}`);

  try {
    await client.updateValues({
      spreadsheetId,
      range: "A1:B2",
      values: [
        ["smoke", 1],
        ["check", 2],
      ],
      valueInputOption: "RAW",
    });
    const read = (await client.getValues({
      spreadsheetId,
      ranges: ["A1:B2"],
      valueRenderOption: "UNFORMATTED_VALUE",
    })) as { valueRanges?: { values?: unknown[][] }[] };
    const values = read.valueRanges?.[0]?.values;
    const expected = JSON.stringify([
      ["smoke", 1],
      ["check", 2],
    ]);
    if (JSON.stringify(values) !== expected) {
      throw new Error(`read-back mismatch: got ${JSON.stringify(values)}, want ${expected}`);
    }
    console.log(JSON.stringify({ ok: true, cycle: "create+write+read+verify+cleanup", spreadsheetId }, null, 2));
  } finally {
    // Cleanup after success and failure alike — the disposable file must not
    // outlive the check. A cleanup failure is reported but must not mask the
    // original error, so it only logs.
    try {
      await client.deleteSpreadsheetFile(spreadsheetId);
      console.error(`cleaned up ${spreadsheetId}`);
    } catch (err) {
      console.error(
        `cleanup failed for ${spreadsheetId} — delete it manually in Drive:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
