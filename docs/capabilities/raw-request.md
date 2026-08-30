# Google Sheets: Raw Google Sheets API call — MCP tool

**Google Sheets MCP tool:** Escape hatch to call any Google Sheets API v4 path directly, for requests the typed tools don't cover — e.g. a batchUpdate with mergeCells, named ranges, banding, basic filters, slicers, sortRange, findReplace, gradient conditional-format rules, developer metadata, or several requests in one atomic call: path "v4/spreadsheets/<spreadsheetId>:batchUpdate", method POST, body {"requests":[...]}.

Technical name: `raw_request`

## What task it solves

> I want to call a Google Sheets API method the typed tools don't cover.

Escape hatch to call any Google Sheets API v4 path directly, for requests the typed tools don't cover — e.g. a batchUpdate with mergeCells, named ranges, banding, basic filters, slicers, sortRange, findReplace, gradient conditional-format rules, developer metadata, or several requests in one atomic call: path "v4/spreadsheets/<spreadsheetId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string. The Bearer token is added automatically; the method defaults to GET (values updates use PUT). Sheets API paths only — Drive paths are not reachable here.

## When to use it

Use this capability when you need “Raw Google Sheets API call” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `path` — **required**. API path relative to https://sheets.googleapis.com, e.g. "v4/spreadsheets/<id>:batchUpdate".
- `method` — optional. HTTP method (the Sheets API uses only these three). Defaults to GET.
- `body` — optional. JSON request body (POST/PUT only).

## What it returns

Escape hatch to call any Google Sheets API v4 path directly, for requests the typed tools don't cover — e.g. a batchUpdate with mergeCells, named ranges, banding, basic filters, slicers, sortRange, findReplace, gradient conditional-format rules, developer metadata, or several requests in one atomic call: path "v4/spreadsheets/<spreadsheetId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string. The Bearer token is added automatically; the method defaults to GET (values updates use PUT). Sheets API paths only — Drive paths are not reachable here.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Raw Google Sheets API call in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Only Sheets API paths are reachable — Drive paths and any other origin are rejected before the request is sent, so the Bearer token never leaves sheets.googleapis.com. Writes are never retried after an ambiguous failure.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get spreadsheet metadata](./get-spreadsheet.md) — `get_spreadsheet`
- [Manage charts](./manage-charts.md) — `manage_charts`
- [Manage conditional formatting](./manage-conditional-formats.md) — `manage_conditional_formats`

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
