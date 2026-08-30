# Google Sheets: Manage conditional formatting — MCP tool

**Google Sheets MCP tool:** Manages conditional-format rules that style cells when a condition holds (boolean rules; gradient color scales need raw_request).

Technical name: `manage_conditional_formats`

## What task it solves

> I want to highlight cells by condition.

Manages conditional-format rules that style cells when a condition holds (boolean rules; gradient color scales need raw_request). Rules are addressed by SHEET + INDEX in that sheet's rule list — get current rules and indexes from get_spreadsheet (sheets[].conditionalFormats), and re-read after every mutation because add/delete shift later indexes. action=add inserts a rule at index (default 0 = highest priority; rules are evaluated in order and the first match wins): needs ranges, condition_type (+condition_values; CUSTOM_FORMULA with a "=..." formula is the most flexible) and at least one format field (background_color, text_color, bold, italic). action=update replaces the ENTIRE rule at sheet_id+index with the newly provided one. action=delete removes the rule at sheet_id+index.

## When to use it

Use this capability when you need “Manage conditional formatting” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the rules.
- `sheet_id` — optional. update/delete: the sheet whose rule list is addressed.
- `index` — optional. Rule position in the sheet's list. add: insert position (default 0); update/delete: required.
- `ranges` — optional. add/update: the cells the rule applies to.
- `condition_type` — optional. Sheets API condition type, e.g. ONE_OF_LIST, ONE_OF_RANGE, NUMBER_GREATER, NUMBER_LESS, NUMBER_BETWEEN, NUMBER_EQ, TEXT_CONTAINS, TEXT_STARTS_WITH, TEXT_EQ, TEXT_IS_EMAIL, DATE_AFTER, DATE_BEFORE, DATE_BETWEEN, DATE_IS_VALID, BLANK, NOT_BLANK, BOOLEAN, CUSTOM_FORMULA.
- `condition_values` — optional. Condition arguments: list items for ONE_OF_LIST (["Yes","No"]), one number for NUMBER_GREATER (["100"]), two for NUMBER_BETWEEN, "=A1>B1"-style formula for CUSTOM_FORMULA and ONE_OF_RANGE ("=Sheet1!A1:A10"), relative dates as values. Omit for BLANK / NOT_BLANK / DATE_IS_VALID.
- `background_color` — optional. Fill for matching cells, "#RRGGBB".
- `text_color` — optional. Text color for matching cells, "#RRGGBB".
- `bold` — optional. Bold text for matching cells.
- `italic` — optional. Italic text for matching cells.

## What it returns

Manages conditional-format rules that style cells when a condition holds (boolean rules; gradient color scales need raw_request). Rules are addressed by SHEET + INDEX in that sheet's rule list — get current rules and indexes from get_spreadsheet (sheets[].conditionalFormats), and re-read after every mutation because add/delete shift later indexes. action=add inserts a rule at index (default 0 = highest priority; rules are evaluated in order and the first match wins): needs ranges, condition_type (+condition_values; CUSTOM_FORMULA with a "=..." formula is the most flexible) and at least one format field (background_color, text_color, bold, italic). action=update replaces the ENTIRE rule at sheet_id+index with the newly provided one. action=delete removes the rule at sheet_id+index.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage conditional formatting in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Rules are addressed by per-sheet index, and every add/update/delete shifts later indexes — re-read get_spreadsheet between rule mutations. Gradient (color-scale) rules need raw_request.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Set data validation](./set-data-validation.md) — `set_data_validation`
- [Manage protected ranges](./manage-protected-ranges.md) — `manage_protected_ranges`

## Technical details

- **Impact:** destructive operation
- **Group:** Rules and protection
- **Description source:** `manage_conditional_formats` registration in `src/tools/rules.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
