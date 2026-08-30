# Google Sheets: Manage rows and columns — MCP tool

**Google Sheets MCP tool:** Row/column operations on a run of rows (dimension=ROWS) or columns (dimension=COLUMNS), addressed by sheet_id + 0-based start_index (inclusive) and end_index (exclusive) — e.g. columns A-C = start 0, end 3.

Technical name: `manage_dimensions`

## What task it solves

> I want to resize, insert, delete, hide or group rows and columns.

Row/column operations on a run of rows (dimension=ROWS) or columns (dimension=COLUMNS), addressed by sheet_id + 0-based start_index (inclusive) and end_index (exclusive) — e.g. columns A-C = start 0, end 3. action=resize sets an exact pixel_size; auto_resize fits to content; insert adds empty rows/columns at start_index (inherit_from_before=true copies formatting from the row/column before instead of after); delete removes them WITH their data (irreversible; cell references below/right shift); hide/show toggle visibility without touching data; group/ungroup add or remove a collapsible outline group over the run (groups nest — repeat group on a subrange for a deeper level).

## When to use it

Use this capability when you need “Manage rows and columns” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the rows/columns.
- `sheet_id` — **required**. The numeric sheetId (NOT the title) from get_spreadsheet sheets[].properties.sheetId; the first sheet of a new spreadsheet is 0.
- `dimension` — **required**. Whether the run is rows or columns.
- `start_index` — **required**. First row/column of the run, 0-based inclusive.
- `end_index` — **required**. End of the run, exclusive (rows 1-3 = start 0, end 3).
- `pixel_size` — optional. resize: the new size in pixels.
- `inherit_from_before` — optional. insert: new rows/columns copy formatting from before the insertion point (default: after).

## What it returns

Row/column operations on a run of rows (dimension=ROWS) or columns (dimension=COLUMNS), addressed by sheet_id + 0-based start_index (inclusive) and end_index (exclusive) — e.g. columns A-C = start 0, end 3. action=resize sets an exact pixel_size; auto_resize fits to content; insert adds empty rows/columns at start_index (inherit_from_before=true copies formatting from the row/column before instead of after); delete removes them WITH their data (irreversible; cell references below/right shift); hide/show toggle visibility without touching data; group/ungroup add or remove a collapsible outline group over the run (groups nest — repeat group on a subrange for a deeper level).

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage rows and columns in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

`delete` removes rows/columns with their data irreversibly and shifts everything after them — re-read get_spreadsheet between successive structural edits. Indexes are 0-based with an exclusive end.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Format cells](./format-cells.md) — `format_cells`
- [Freeze rows and columns](./set-frozen.md) — `set_frozen`
- [Set cell borders](./set-borders.md) — `set_borders`

## Technical details

- **Impact:** destructive operation
- **Group:** Formatting and layout
- **Description source:** `manage_dimensions` registration in `src/tools/format.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
