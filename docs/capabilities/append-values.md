# Google Sheets: Append rows — MCP tool

**Google Sheets MCP tool:** Appends rows after the last row of the data table that contains the given range — pass the table's region (e.g. "Sheet1!A1:D1" or just "Sheet1") and the API finds the first free row itself; the response's updates.updatedRange shows where the rows actually landed.

Technical name: `append_values`

## What task it solves

> I want to append rows to a table.

Appends rows after the last row of the data table that contains the given range — pass the table's region (e.g. "Sheet1!A1:D1" or just "Sheet1") and the API finds the first free row itself; the response's updates.updatedRange shows where the rows actually landed. insert_data_option INSERT_ROWS pushes existing data below down; OVERWRITE (default behaviour) writes into the free rows after the table. Never retried after an ambiguous failure — re-appending would duplicate the rows, so check the sheet first (read_values) before re-sending.

## When to use it

Use this capability when you need “Append rows” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `range` — **required**. A1 range identifying the table to append to (the API scans it for the last data row).
- `values` — **required**. 2-D array of cell values, outer array = rows: [["Name","Score"],["Ada",42]]. null leaves the existing cell untouched.
- `value_input_option` — optional. USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings.
- `insert_data_option` — optional. OVERWRITE writes after the table (default); INSERT_ROWS inserts new rows, shifting data below.

## What it returns

Appends rows after the last row of the data table that contains the given range — pass the table's region (e.g. "Sheet1!A1:D1" or just "Sheet1") and the API finds the first free row itself; the response's updates.updatedRange shows where the rows actually landed. insert_data_option INSERT_ROWS pushes existing data below down; OVERWRITE (default behaviour) writes into the free rows after the table. Never retried after an ambiguous failure — re-appending would duplicate the rows, so check the sheet first (read_values) before re-sending.

## What changes in Google Sheets

The call writes to the live spreadsheet immediately: the affected cells or properties are overwritten with the provided values. Untouched cells and properties keep their previous state, and repeating the same call converges to the same result.

## Example request

> Append rows in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Never retried after an ambiguous failure (5xx or timeout) — re-appending would duplicate the rows, so verify with read_values before re-sending.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read values](./read-values.md) — `read_values`
- [Write values to a range](./write-values.md) — `write_values`
- [Write values to many ranges](./batch-write-values.md) — `batch_write_values`
- [Clear values](./clear-values.md) — `clear_values`

## Technical details

- **Impact:** changes data
- **Group:** Values
- **Description source:** `append_values` registration in `src/tools/values.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
