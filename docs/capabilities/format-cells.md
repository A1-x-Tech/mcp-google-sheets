# Google Sheets: Format cells — MCP tool

**Google Sheets MCP tool:** Applies cell formatting to a range: background_color, text color/bold/italic/strikethrough/underline/font_size/font_family, horizontal/vertical alignment, wrap_strategy, and number format (number_format_type NUMBER/PERCENT/CURRENCY/DATE/TIME/DATE_TIME/SCIENTIFIC/TEXT with an optional number_format_pattern like "#,##0.00" or "dd.mm.yyyy").

Technical name: `format_cells`

## What task it solves

> I want to format cells.

Applies cell formatting to a range: background_color, text color/bold/italic/strikethrough/underline/font_size/font_family, horizontal/vertical alignment, wrap_strategy, and number format (number_format_type NUMBER/PERCENT/CURRENCY/DATE/TIME/DATE_TIME/SCIENTIFIC/TEXT with an optional number_format_pattern like "#,##0.00" or "dd.mm.yyyy"). Only the provided properties are touched — the update mask is computed automatically, so existing formatting outside it survives; at least one formatting field is required. The range is a grid rectangle addressed by sheet_id + 0-based indexes (get sheet_id from get_spreadsheet). Colors are "#RRGGBB" hex strings.

## When to use it

Use this capability when you need “Format cells” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `range` — **required**. Cell rectangle in grid coordinates: rows 1-10 × columns A-B = {start_row_index:0, end_row_index:10, start_column_index:0, end_column_index:2}.
- `background_color` — optional. Hex color "#RRGGBB", e.g. "#FF0000".
- `text_color` — optional. Text color "#RRGGBB".
- `bold` — optional. Bold text.
- `italic` — optional. Italic text.
- `strikethrough` — optional. Strikethrough text.
- `underline` — optional. Underlined text.
- `font_size` — optional. Font size in points.
- `font_family` — optional. Font family, e.g. "Roboto".
- `horizontal_alignment` — optional. Horizontal alignment.
- `vertical_alignment` — optional. Vertical alignment.
- `wrap_strategy` — optional. How long text behaves: overflow into empty neighbors, clip at the edge, or wrap.
- `number_format_type` — optional. Number format category.
- `number_format_pattern` — optional. Format pattern, e.g. "#,##0.00", "0.0%", "dd.mm.yyyy" (requires number_format_type).

## What it returns

Applies cell formatting to a range: background_color, text color/bold/italic/strikethrough/underline/font_size/font_family, horizontal/vertical alignment, wrap_strategy, and number format (number_format_type NUMBER/PERCENT/CURRENCY/DATE/TIME/DATE_TIME/SCIENTIFIC/TEXT with an optional number_format_pattern like "#,##0.00" or "dd.mm.yyyy"). Only the provided properties are touched — the update mask is computed automatically, so existing formatting outside it survives; at least one formatting field is required. The range is a grid rectangle addressed by sheet_id + 0-based indexes (get sheet_id from get_spreadsheet). Colors are "#RRGGBB" hex strings.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Format cells in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Only the provided properties change (the mask is computed from them), and at least one formatting field is required; `number_format_pattern` needs `number_format_type`.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Freeze rows and columns](./set-frozen.md) — `set_frozen`
- [Set cell borders](./set-borders.md) — `set_borders`
- [Manage rows and columns](./manage-dimensions.md) — `manage_dimensions`

## Technical details

- **Impact:** destructive operation
- **Group:** Formatting and layout
- **Description source:** `format_cells` registration in `src/tools/format.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
