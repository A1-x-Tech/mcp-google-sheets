# Google Sheets: Write values to a range — MCP tool

**Google Sheets MCP tool:** Overwrites one A1 range with a 2-D values matrix (rows first) and returns updatedRange/updatedRows/updatedColumns/updatedCells.

Technical name: `write_values`

## What task it solves

> I want to write values into a range.

Overwrites one A1 range with a 2-D values matrix (rows first) and returns updatedRange/updatedRows/updatedColumns/updatedCells. The matrix is anchored at the range's top-left corner; cells beyond the matrix keep their old content, and a null entry skips (does not clear) that cell — use clear_values to empty cells. value_input_option USER_ENTERED (default) parses input like typing in the UI: "=SUM(A1:A10)" becomes a live formula, "1,234" and "2026-01-15" become number/date per the spreadsheet locale; RAW stores everything as literal values. For several ranges use batch_write_values (one quota unit instead of N).

## When to use it

Use this capability when you need “Write values to a range” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `range` — **required**. A1-notation range, e.g. "Sheet1!A1:C10", "'My sheet'!B2:D" (quote titles with spaces) or a bare sheet title for the whole sheet.
- `values` — **required**. 2-D array of cell values, outer array = rows: [["Name","Score"],["Ada",42]]. null leaves the existing cell untouched.
- `value_input_option` — optional. USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings.
- `include_values_in_response` — optional. Return the written cells (as rendered) in the response.

## What it returns

Overwrites one A1 range with a 2-D values matrix (rows first) and returns updatedRange/updatedRows/updatedColumns/updatedCells. The matrix is anchored at the range's top-left corner; cells beyond the matrix keep their old content, and a null entry skips (does not clear) that cell — use clear_values to empty cells. value_input_option USER_ENTERED (default) parses input like typing in the UI: "=SUM(A1:A10)" becomes a live formula, "1,234" and "2026-01-15" become number/date per the spreadsheet locale; RAW stores everything as literal values. For several ranges use batch_write_values (one quota unit instead of N).

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Write values to a range in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

A `null` entry skips a cell rather than clearing it (use clear_values to empty cells), and USER_ENTERED interprets numbers and dates per the spreadsheet's locale.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read values](./read-values.md) — `read_values`
- [Write values to many ranges](./batch-write-values.md) — `batch_write_values`
- [Append rows](./append-values.md) — `append_values`
- [Clear values](./clear-values.md) — `clear_values`

## Technical details

- **Impact:** destructive operation
- **Group:** Values
- **Description source:** `write_values` registration in `src/tools/values.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
