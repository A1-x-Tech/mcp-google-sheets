# Google Sheets: Get spreadsheet metadata — MCP tool

**Google Sheets MCP tool:** Returns the spreadsheet's structure: properties (title, locale, timeZone), sheets[] with properties (sheetId, title, index, gridProperties incl. rowCount/columnCount and frozenRowCount/frozenColumnCount), plus each sheet's protectedRanges, conditionalFormats, tables and charts, and the spreadsheet's namedRanges.

Technical name: `get_spreadsheet`

## What task it solves

> I want to see a spreadsheet's structure and ids.

Returns the spreadsheet's structure: properties (title, locale, timeZone), sheets[] with properties (sheetId, title, index, gridProperties incl. rowCount/columnCount and frozenRowCount/frozenColumnCount), plus each sheet's protectedRanges, conditionalFormats, tables and charts, and the spreadsheet's namedRanges. Call this FIRST whenever a structural tool needs a sheetId, protectedRangeId, tableId, chartId or a conditional-format rule index — titles are not addresses. By default no cell data is returned; include_grid_data=true (optionally limited to ranges) embeds cells but is heavy — prefer read_values for data. fields is a partial-response mask to trim the payload, e.g. "sheets.properties".

## When to use it

Use this capability when you need “Get spreadsheet metadata” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `ranges` — optional. Limit the returned sheets/grid data to these A1 ranges.
- `include_grid_data` — optional. Embed cell data (values, formats) in the response. Heavy — prefer read_values.
- `fields` — optional. Partial-response field mask, e.g. "sheets.properties" or "namedRanges".

## What it returns

Returns the spreadsheet's structure: properties (title, locale, timeZone), sheets[] with properties (sheetId, title, index, gridProperties incl. rowCount/columnCount and frozenRowCount/frozenColumnCount), plus each sheet's protectedRanges, conditionalFormats, tables and charts, and the spreadsheet's namedRanges. Call this FIRST whenever a structural tool needs a sheetId, protectedRangeId, tableId, chartId or a conditional-format rule index — titles are not addresses. By default no cell data is returned; include_grid_data=true (optionally limited to ranges) embeds cells but is heavy — prefer read_values for data. fields is a partial-response mask to trim the payload, e.g. "sheets.properties".

## What changes in Google Sheets

The tool reads Google Sheets data and does not change it.

## Example request

> Get spreadsheet metadata in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

`include_grid_data=true` on a large spreadsheet is very heavy — prefer read_values for cell data, and trim the payload with `fields`.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a spreadsheet](./create-spreadsheet.md) — `create_spreadsheet`
- [Search spreadsheets](./search-spreadsheets.md) — `search_spreadsheets`

## Technical details

- **Impact:** read-only
- **Group:** Spreadsheets
- **Description source:** `get_spreadsheet` registration in `src/tools/spreadsheets.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
