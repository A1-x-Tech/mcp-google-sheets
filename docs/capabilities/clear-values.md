# Google Sheets: Clear values — MCP tool

**Google Sheets MCP tool:** Empties the VALUES of one or more A1 ranges in a single call — cell contents and formulas are gone (no undo through the API), while formatting, data validation, notes, conditional formats and merges all stay.

Technical name: `clear_values`

## What task it solves

> I want to clear the contents of ranges.

Empties the VALUES of one or more A1 ranges in a single call — cell contents and formulas are gone (no undo through the API), while formatting, data validation, notes, conditional formats and merges all stay. To also remove formatting use format_cells or raw_request; to delete whole rows/columns (not just their content) use manage_dimensions action=delete.

## When to use it

Use this capability when you need “Clear values” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `ranges` — **required**. The A1 ranges to clear.

## What it returns

Empties the VALUES of one or more A1 ranges in a single call — cell contents and formulas are gone (no undo through the API), while formatting, data validation, notes, conditional formats and merges all stay. To also remove formatting use format_cells or raw_request; to delete whole rows/columns (not just their content) use manage_dimensions action=delete.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Clear values in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Cleared values have no undo through the API; formatting, data validation, notes and merges all stay in place.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read values](./read-values.md) — `read_values`
- [Write values to a range](./write-values.md) — `write_values`
- [Write values to many ranges](./batch-write-values.md) — `batch_write_values`
- [Append rows](./append-values.md) — `append_values`

## Technical details

- **Impact:** destructive operation
- **Group:** Values
- **Description source:** `clear_values` registration in `src/tools/values.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
