# Google Sheets: Manage sheets — MCP tool

**Google Sheets MCP tool:** Manages the sheets (tabs) of a spreadsheet.

Technical name: `manage_sheets`

## What task it solves

> I want to add, copy, rename or delete sheets.

Manages the sheets (tabs) of a spreadsheet. action=add creates a tab (title required; optional index position and row_count/column_count — default 1000×26). action=duplicate copies a tab within the same spreadsheet (sheet_id; optional title for the copy and index). action=rename changes a tab's title (sheet_id + title; the numeric sheetId never changes, so other tools keep working). action=delete removes the tab AND all its data — irreversible through the API, and deleting the last remaining sheet fails. action=copy_to copies a tab into ANOTHER spreadsheet (sheet_id + destination_spreadsheet_id; the copy arrives named "Copy of ..." — rename it there). Get sheet_id values from get_spreadsheet; every action except add returns batchUpdate replies with the affected sheet's properties.

## When to use it

Use this capability when you need “Manage sheets” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the sheets.
- `sheet_id` — optional. duplicate/rename/delete/copy_to: the target sheet.
- `title` — optional. add: the new tab's title (required). rename: the new title (required). duplicate: the copy's title.
- `index` — optional. add/duplicate: 0-based tab position for the new sheet (omit = after the existing tabs).
- `row_count` — optional. add: grid rows for the new sheet (default 1000).
- `column_count` — optional. add: grid columns for the new sheet (default 26).
- `destination_spreadsheet_id` — optional. copy_to: the spreadsheet to copy the sheet into.

## What it returns

Manages the sheets (tabs) of a spreadsheet. action=add creates a tab (title required; optional index position and row_count/column_count — default 1000×26). action=duplicate copies a tab within the same spreadsheet (sheet_id; optional title for the copy and index). action=rename changes a tab's title (sheet_id + title; the numeric sheetId never changes, so other tools keep working). action=delete removes the tab AND all its data — irreversible through the API, and deleting the last remaining sheet fails. action=copy_to copies a tab into ANOTHER spreadsheet (sheet_id + destination_spreadsheet_id; the copy arrives named "Copy of ..." — rename it there). Get sheet_id values from get_spreadsheet; every action except add returns batchUpdate replies with the affected sheet's properties.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage sheets in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

`delete` is irreversible through the API and fails on the last remaining sheet; `copy_to` names the copy "Copy of …" in the destination spreadsheet.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get spreadsheet metadata](./get-spreadsheet.md) — `get_spreadsheet`
- [Manage rows and columns](./manage-dimensions.md) — `manage_dimensions`
- [Create a spreadsheet](./create-spreadsheet.md) — `create_spreadsheet`

## Technical details

- **Impact:** destructive operation
- **Group:** Sheets
- **Description source:** `manage_sheets` registration in `src/tools/sheets.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
