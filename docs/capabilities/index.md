# Google Sheets MCP capabilities

This catalog contains 20 public pages—one for every registered MCP tool in `mcp-google-sheets`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Spreadsheets

- [Create a spreadsheet](./create-spreadsheet.md) — Creates a new Google Sheets spreadsheet and returns it: spreadsheetId, spreadsheetUrl, properties (title, locale, timeZone) and sheets[] with each sheet's numeric sheetId. **Impact:** changes data.
- [Get spreadsheet metadata](./get-spreadsheet.md) — Returns the spreadsheet's structure: properties (title, locale, timeZone), sheets[] with properties (sheetId, title, index, gridProperties incl. rowCount/columnCount and frozenRowCount/frozenColumnCount), plus each sheet's protectedRanges, conditionalFormats, tables and charts, and the spreadsheet's namedRanges. **Impact:** read-only.
- [Search spreadsheets](./search-spreadsheets.md) — Finds Google Sheets spreadsheets the authorized user can open (own files and shared drives; trashed files are excluded): id, name, createdTime, modifiedTime, owners and webViewLink per file, newest-modified first by default. **Impact:** read-only.

## Values

- [Append rows](./append-values.md) — Appends rows after the last row of the data table that contains the given range — pass the table's region (e.g. "Sheet1!A1:D1" or just "Sheet1") and the API finds the first free row itself; the response's updates.updatedRange shows where the rows actually landed. **Impact:** changes data.
- [Clear values](./clear-values.md) — Empties the VALUES of one or more A1 ranges in a single call — cell contents and formulas are gone (no undo through the API), while formatting, data validation, notes, conditional formats and merges all stay. **Impact:** destructive operation.
- [Read values](./read-values.md) — Reads one or more A1 ranges in a single call (one request against the quota, however many ranges) and returns valueRanges[] — each with its resolved range and a 2-D values array (outer = rows unless major_dimension=COLUMNS). **Impact:** read-only.
- [Write values to a range](./write-values.md) — Overwrites one A1 range with a 2-D values matrix (rows first) and returns updatedRange/updatedRows/updatedColumns/updatedCells. **Impact:** destructive operation.
- [Write values to many ranges](./batch-write-values.md) — Overwrites several A1 ranges in ONE call — one write against the per-minute quota instead of one per range, so always prefer this over looping write_values. **Impact:** destructive operation.

## Sheets

- [Manage sheets](./manage-sheets.md) — Manages the sheets (tabs) of a spreadsheet. **Impact:** destructive operation.

## Formatting and layout

- [Format cells](./format-cells.md) — Applies cell formatting to a range: background_color, text color/bold/italic/strikethrough/underline/font_size/font_family, horizontal/vertical alignment, wrap_strategy, and number format (number_format_type NUMBER/PERCENT/CURRENCY/DATE/TIME/DATE_TIME/SCIENTIFIC/TEXT with an optional number_format_pattern like "#,##0.00" or "dd.mm.yyyy"). **Impact:** destructive operation.
- [Freeze rows and columns](./set-frozen.md) — Freezes the first N rows and/or columns of a sheet so they stay visible while scrolling (typical: frozen_rows=1 pins the header). **Impact:** destructive operation.
- [Manage rows and columns](./manage-dimensions.md) — Row/column operations on a run of rows (dimension=ROWS) or columns (dimension=COLUMNS), addressed by sheet_id + 0-based start_index (inclusive) and end_index (exclusive) — e.g. columns A-C = start 0, end 3. **Impact:** destructive operation.
- [Set cell borders](./set-borders.md) — Draws borders around and/or inside a grid range. **Impact:** destructive operation.

## Rules and protection

- [Manage conditional formatting](./manage-conditional-formats.md) — Manages conditional-format rules that style cells when a condition holds (boolean rules; gradient color scales need raw_request). **Impact:** destructive operation.
- [Manage protected ranges](./manage-protected-ranges.md) — Manages protections that stop other editors from changing cells. **Impact:** destructive operation.
- [Set data validation](./set-data-validation.md) — Sets — or clears — a data-validation rule on a grid range. **Impact:** destructive operation.

## Tables and charts

- [Manage charts](./manage-charts.md) — Manages embedded charts. **Impact:** destructive operation.
- [Manage tables](./manage-tables.md) — Manages structured tables (the "Convert to table" feature: named ranges with per-column types, filters and formatting). **Impact:** destructive operation.

## Sharing

- [Manage spreadsheet access](./manage-permissions.md) — Shares the spreadsheet (Drive permissions on the file — the OAuth token needs a Drive scope; the spreadsheets scope alone gets 403 here while every Sheets tool still works). **Impact:** destructive operation.

## Additional API methods

- [Raw Google Sheets API call](./raw-request.md) — Escape hatch to call any Google Sheets API v4 path directly, for requests the typed tools don't cover — e.g. a batchUpdate with mergeCells, named ranges, banding, basic filters, slicers, sortRange, findReplace, gradient conditional-format rules, developer metadata, or several requests in one atomic call: path "v4/spreadsheets/<spreadsheetId>:batchUpdate", method POST, body {"requests":[...]}. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-sheets)
