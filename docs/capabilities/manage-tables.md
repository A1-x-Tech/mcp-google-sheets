# Google Sheets: Manage tables — MCP tool

**Google Sheets MCP tool:** Manages structured tables (the "Convert to table" feature: named ranges with per-column types, filters and formatting).

Technical name: `manage_tables`

## What task it solves

> I want to manage structured tables.

Manages structured tables (the "Convert to table" feature: named ranges with per-column types, filters and formatting). action=add creates a table over a grid range whose FIRST ROW becomes the header: name (must be unique in the spreadsheet) + range required; column_properties optionally types the columns — a list of raw TableColumnProperties objects, e.g. [{"columnIndex":0,"columnName":"Task","columnType":"TEXT"},{"columnIndex":1,"columnName":"Done","columnType":"BOOLEAN"}] (columnType TEXT/PERCENT/DROPDOWN/DOUBLE/CURRENCY/DATE/TIME/DATE_TIME/BOOLEAN; DROPDOWN adds dataValidationRule). The reply carries the new table with its tableId. action=update renames and/or re-ranges an existing table (table_id + name and/or range; expanding the range grows the table). action=delete removes the TABLE DEFINITION only — the cell data stays; clear the cells separately if needed. Find tableIds via get_spreadsheet (sheets[].tables).

## When to use it

Use this capability when you need “Manage tables” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the tables.
- `name` — optional. add (required) / update: the table's unique name.
- `range` — optional. add (required) / update: the table's cells incl. the header row.
- `column_properties` — optional. add: raw TableColumnProperties list, e.g. [{"columnIndex":0,"columnName":"Task","columnType":"TEXT"}].
- `table_id` — optional. update/delete: the tableId from get_spreadsheet or the add reply.

## What it returns

Manages structured tables (the "Convert to table" feature: named ranges with per-column types, filters and formatting). action=add creates a table over a grid range whose FIRST ROW becomes the header: name (must be unique in the spreadsheet) + range required; column_properties optionally types the columns — a list of raw TableColumnProperties objects, e.g. [{"columnIndex":0,"columnName":"Task","columnType":"TEXT"},{"columnIndex":1,"columnName":"Done","columnType":"BOOLEAN"}] (columnType TEXT/PERCENT/DROPDOWN/DOUBLE/CURRENCY/DATE/TIME/DATE_TIME/BOOLEAN; DROPDOWN adds dataValidationRule). The reply carries the new table with its tableId. action=update renames and/or re-ranges an existing table (table_id + name and/or range; expanding the range grows the table). action=delete removes the TABLE DEFINITION only — the cell data stays; clear the cells separately if needed. Find tableIds via get_spreadsheet (sheets[].tables).

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage tables in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Table names must be unique within the spreadsheet, and `delete` removes only the table definition — the cell data stays.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Manage charts](./manage-charts.md) — `manage_charts`

## Technical details

- **Impact:** destructive operation
- **Group:** Tables and charts
- **Description source:** `manage_tables` registration in `src/tools/objects.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
