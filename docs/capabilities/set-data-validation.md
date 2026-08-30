# Google Sheets: Set data validation — MCP tool

**Google Sheets MCP tool:** Sets — or clears — a data-validation rule on a grid range.

Technical name: `set_data_validation`

## What task it solves

> I want to restrict what can be entered in cells.

Sets — or clears — a data-validation rule on a grid range. With condition_type set, every cell in the range gets the rule: ONE_OF_LIST with condition_values plus show_custom_ui=true is the classic in-cell dropdown; ONE_OF_RANGE takes a "=Sheet1!A1:A10" formula; NUMBER_/TEXT_/DATE_ conditions restrict input; CUSTOM_FORMULA takes a formula evaluated per cell. strict=true rejects invalid input outright, strict=false only shows a warning; input_message is the help text shown on the cell. OMIT condition_type (and the other rule fields) to REMOVE validation from the range. Overwrites any previous rule on the range — one rule per cell.

## When to use it

Use this capability when you need “Set data validation” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `range` — **required**. Cell rectangle in grid coordinates: rows 1-10 × columns A-B = {start_row_index:0, end_row_index:10, start_column_index:0, end_column_index:2}.
- `condition_type` — optional. Sheets API condition type, e.g. ONE_OF_LIST, ONE_OF_RANGE, NUMBER_GREATER, NUMBER_LESS, NUMBER_BETWEEN, NUMBER_EQ, TEXT_CONTAINS, TEXT_STARTS_WITH, TEXT_EQ, TEXT_IS_EMAIL, DATE_AFTER, DATE_BEFORE, DATE_BETWEEN, DATE_IS_VALID, BLANK, NOT_BLANK, BOOLEAN, CUSTOM_FORMULA.
- `condition_values` — optional. Condition arguments: list items for ONE_OF_LIST (["Yes","No"]), one number for NUMBER_GREATER (["100"]), two for NUMBER_BETWEEN, "=A1>B1"-style formula for CUSTOM_FORMULA and ONE_OF_RANGE ("=Sheet1!A1:A10"), relative dates as values. Omit for BLANK / NOT_BLANK / DATE_IS_VALID.
- `input_message` — optional. Help text shown when the cell is selected.
- `strict` — optional. true rejects invalid input; false (default) shows a warning.
- `show_custom_ui` — optional. Show a dropdown UI for ONE_OF_LIST / ONE_OF_RANGE conditions.

## What it returns

Sets — or clears — a data-validation rule on a grid range. With condition_type set, every cell in the range gets the rule: ONE_OF_LIST with condition_values plus show_custom_ui=true is the classic in-cell dropdown; ONE_OF_RANGE takes a "=Sheet1!A1:A10" formula; NUMBER_/TEXT_/DATE_ conditions restrict input; CUSTOM_FORMULA takes a formula evaluated per cell. strict=true rejects invalid input outright, strict=false only shows a warning; input_message is the help text shown on the cell. OMIT condition_type (and the other rule fields) to REMOVE validation from the range. Overwrites any previous rule on the range — one rule per cell.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Set data validation in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

One rule per cell: setting a new rule replaces the old one, and omitting `condition_type` clears validation from the range.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Manage protected ranges](./manage-protected-ranges.md) — `manage_protected_ranges`
- [Manage conditional formatting](./manage-conditional-formats.md) — `manage_conditional_formats`

## Technical details

- **Impact:** destructive operation
- **Group:** Rules and protection
- **Description source:** `set_data_validation` registration in `src/tools/rules.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
