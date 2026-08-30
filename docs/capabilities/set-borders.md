# Google Sheets: Set cell borders — MCP tool

**Google Sheets MCP tool:** Draws borders around and/or inside a grid range.

Technical name: `set_borders`

## What task it solves

> I want to draw cell borders.

Draws borders around and/or inside a grid range. top/bottom/left/right are the range's outer edges; inner_horizontal/inner_vertical are the grid lines between cells inside it. Each side takes {style, color?} — styles SOLID, SOLID_MEDIUM, SOLID_THICK, DOTTED, DASHED, DOUBLE, or NONE to remove that side's border. Only the provided sides change; at least one is required. Colors are "#RRGGBB" hex (default black).

## When to use it

Use this capability when you need “Set cell borders” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `range` — **required**. Cell rectangle in grid coordinates: rows 1-10 × columns A-B = {start_row_index:0, end_row_index:10, start_column_index:0, end_column_index:2}.
- `top` — optional. Border line: {style, color?}.
- `bottom` — optional. Border line: {style, color?}.
- `left` — optional. Border line: {style, color?}.
- `right` — optional. Border line: {style, color?}.
- `inner_horizontal` — optional. Horizontal lines between rows inside the range.
- `inner_vertical` — optional. Vertical lines between columns inside the range.

## What it returns

Draws borders around and/or inside a grid range. top/bottom/left/right are the range's outer edges; inner_horizontal/inner_vertical are the grid lines between cells inside it. Each side takes {style, color?} — styles SOLID, SOLID_MEDIUM, SOLID_THICK, DOTTED, DASHED, DOUBLE, or NONE to remove that side's border. Only the provided sides change; at least one is required. Colors are "#RRGGBB" hex (default black).

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Set cell borders in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Only the provided sides change; to remove a border pass that side with style `NONE`.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Format cells](./format-cells.md) — `format_cells`
- [Freeze rows and columns](./set-frozen.md) — `set_frozen`
- [Manage rows and columns](./manage-dimensions.md) — `manage_dimensions`

## Technical details

- **Impact:** destructive operation
- **Group:** Formatting and layout
- **Description source:** `set_borders` registration in `src/tools/format.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
