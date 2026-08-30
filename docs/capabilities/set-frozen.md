# Google Sheets: Freeze rows and columns — MCP tool

**Google Sheets MCP tool:** Freezes the first N rows and/or columns of a sheet so they stay visible while scrolling (typical: frozen_rows=1 pins the header).

Technical name: `set_frozen`

## What task it solves

> I want to freeze header rows and columns.

Freezes the first N rows and/or columns of a sheet so they stay visible while scrolling (typical: frozen_rows=1 pins the header). 0 unfreezes. At least one of frozen_rows / frozen_columns is required; the other stays as it is. You cannot freeze all rows or all columns of a sheet — at least one unfrozen row/column must remain.

## When to use it

Use this capability when you need “Freeze rows and columns” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `sheet_id` — **required**. The numeric sheetId (NOT the title) from get_spreadsheet sheets[].properties.sheetId; the first sheet of a new spreadsheet is 0.
- `frozen_rows` — optional. How many top rows to freeze (0 = unfreeze).
- `frozen_columns` — optional. How many left columns to freeze (0 = unfreeze).

## What it returns

Freezes the first N rows and/or columns of a sheet so they stay visible while scrolling (typical: frozen_rows=1 pins the header). 0 unfreezes. At least one of frozen_rows / frozen_columns is required; the other stays as it is. You cannot freeze all rows or all columns of a sheet — at least one unfrozen row/column must remain.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Freeze rows and columns in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

At least one of `frozen_rows` / `frozen_columns` is required, and a sheet cannot be frozen entirely — one unfrozen row/column must remain.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Format cells](./format-cells.md) — `format_cells`
- [Set cell borders](./set-borders.md) — `set_borders`
- [Manage rows and columns](./manage-dimensions.md) — `manage_dimensions`

## Technical details

- **Impact:** destructive operation
- **Group:** Formatting and layout
- **Description source:** `set_frozen` registration in `src/tools/format.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
