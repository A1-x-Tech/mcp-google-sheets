# Google Sheets: Read values — MCP tool

**Google Sheets MCP tool:** Reads one or more A1 ranges in a single call (one request against the quota, however many ranges) and returns valueRanges[] — each with its resolved range and a 2-D values array (outer = rows unless major_dimension=COLUMNS).

Technical name: `read_values`

## What task it solves

> I want to read values and formulas from ranges.

Reads one or more A1 ranges in a single call (one request against the quota, however many ranges) and returns valueRanges[] — each with its resolved range and a 2-D values array (outer = rows unless major_dimension=COLUMNS). Trailing empty rows/columns are omitted; a fully empty range has no values key at all. value_render_option: FORMATTED_VALUE (default, strings as displayed, honoring the cell's number format and locale), UNFORMATTED_VALUE (raw numbers/booleans), FORMULA (the formula text, e.g. "=SUM(A1:A10)" — the way to read formulas). With UNFORMATTED_VALUE, dates arrive as serial numbers unless date_time_render_option=FORMATTED_STRING.

## When to use it

Use this capability when you need “Read values” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `ranges` — **required**. One or more A1 ranges to read in a single call.
- `value_render_option` — optional. How values are rendered (default FORMATTED_VALUE); FORMULA returns formula text.
- `major_dimension` — optional. Whether the outer array is rows (default) or columns.
- `date_time_render_option` — optional. How dates/times render with UNFORMATTED_VALUE (default SERIAL_NUMBER).

## What it returns

Reads one or more A1 ranges in a single call (one request against the quota, however many ranges) and returns valueRanges[] — each with its resolved range and a 2-D values array (outer = rows unless major_dimension=COLUMNS). Trailing empty rows/columns are omitted; a fully empty range has no values key at all. value_render_option: FORMATTED_VALUE (default, strings as displayed, honoring the cell's number format and locale), UNFORMATTED_VALUE (raw numbers/booleans), FORMULA (the formula text, e.g. "=SUM(A1:A10)" — the way to read formulas). With UNFORMATTED_VALUE, dates arrive as serial numbers unless date_time_render_option=FORMATTED_STRING.

## What changes in Google Sheets

The tool reads Google Sheets data and does not change it.

## Example request

> Read values in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Trailing empty rows and columns are omitted from the result, and a fully empty range returns no `values` key at all — treat both as empty, not as an error.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Write values to a range](./write-values.md) — `write_values`
- [Write values to many ranges](./batch-write-values.md) — `batch_write_values`
- [Append rows](./append-values.md) — `append_values`
- [Clear values](./clear-values.md) — `clear_values`

## Technical details

- **Impact:** read-only
- **Group:** Values
- **Description source:** `read_values` registration in `src/tools/values.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
