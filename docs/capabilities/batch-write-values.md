# Google Sheets: Write values to many ranges — MCP tool

**Google Sheets MCP tool:** Overwrites several A1 ranges in ONE call — one write against the per-minute quota instead of one per range, so always prefer this over looping write_values.

Technical name: `batch_write_values`

## What task it solves

> I want to write values into several ranges at once.

Overwrites several A1 ranges in ONE call — one write against the per-minute quota instead of one per range, so always prefer this over looping write_values. data is a list of {range, values} pairs; all are written with the same value_input_option (USER_ENTERED parses formulas/numbers/dates, RAW stores literally). Returns totalUpdatedCells and a per-range responses[] breakdown. Like write_values, null entries skip cells rather than clearing them.

## When to use it

Use this capability when you need “Write values to many ranges” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `data` — **required**. The ranges to write, each with its own 2-D values matrix.
- `value_input_option` — optional. USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings.

## What it returns

Overwrites several A1 ranges in ONE call — one write against the per-minute quota instead of one per range, so always prefer this over looping write_values. data is a list of {range, values} pairs; all are written with the same value_input_option (USER_ENTERED parses formulas/numbers/dates, RAW stores literally). Returns totalUpdatedCells and a per-range responses[] breakdown. Like write_values, null entries skip cells rather than clearing them.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Write values to many ranges in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

All ranges share one `value_input_option`, and `null` entries skip cells rather than clearing them.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read values](./read-values.md) — `read_values`
- [Write values to a range](./write-values.md) — `write_values`
- [Append rows](./append-values.md) — `append_values`
- [Clear values](./clear-values.md) — `clear_values`

## Technical details

- **Impact:** destructive operation
- **Group:** Values
- **Description source:** `batch_write_values` registration in `src/tools/values.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
