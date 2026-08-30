# Google Sheets: Manage charts — MCP tool

**Google Sheets MCP tool:** Manages embedded charts.

Technical name: `manage_charts`

## What task it solves

> I want to add and manage charts.

Manages embedded charts. action=add builds a chart from chart_type (COLUMN/BAR/LINE/AREA/STEPPED_AREA/SCATTER/PIE), domain_range (x-axis labels / pie labels), series_ranges (one grid range per data series; PIE takes exactly one) and optional title/legend_position/header_count (rows of the ranges treated as headers, default 1) — place it with anchor {sheet_id,row_index,column_index} (the cell under the chart's top-left corner) or new_sheet=true for its own chart sheet; the reply carries the new chartId. Ranges should be single columns (or rows) including the header cell. For chart kinds beyond the basic set (combo, waterfall, histogram, org …) pass a raw Sheets API ChartSpec via spec instead — it overrides the simplified fields. action=update REPLACES the whole spec of an existing chart (chart_id + the same spec-building fields; there is no partial chart update). action=delete removes the chart by chart_id. Find chartIds via get_spreadsheet (sheets[].charts).

## When to use it

Use this capability when you need “Manage charts” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the charts.
- `chart_id` — optional. update/delete: the chartId from get_spreadsheet or the add reply.
- `chart_type` — optional. add/update: the chart kind (required unless spec is given).
- `title` — optional. Chart title.
- `domain_range` — optional. The x-axis (or pie label) values, incl. header cell.
- `series_ranges` — optional. One range per data series, incl. header cells (PIE: exactly one).
- `legend_position` — optional. BOTTOM_LEGEND, LEFT_LEGEND, RIGHT_LEGEND, TOP_LEGEND or NO_LEGEND (default: API's choice).
- `header_count` — optional. How many leading rows of the ranges are headers (default 1).
- `spec` — optional. Raw Sheets API ChartSpec — full control; overrides the simplified fields above.
- `anchor` — optional. add: place the chart over the grid, top-left at this cell.
- `new_sheet` — optional. add: put the chart on its own new chart sheet instead.

## What it returns

Manages embedded charts. action=add builds a chart from chart_type (COLUMN/BAR/LINE/AREA/STEPPED_AREA/SCATTER/PIE), domain_range (x-axis labels / pie labels), series_ranges (one grid range per data series; PIE takes exactly one) and optional title/legend_position/header_count (rows of the ranges treated as headers, default 1) — place it with anchor {sheet_id,row_index,column_index} (the cell under the chart's top-left corner) or new_sheet=true for its own chart sheet; the reply carries the new chartId. Ranges should be single columns (or rows) including the header cell. For chart kinds beyond the basic set (combo, waterfall, histogram, org …) pass a raw Sheets API ChartSpec via spec instead — it overrides the simplified fields. action=update REPLACES the whole spec of an existing chart (chart_id + the same spec-building fields; there is no partial chart update). action=delete removes the chart by chart_id. Find chartIds via get_spreadsheet (sheets[].charts).

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage charts in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

`update` replaces the entire chart spec (there is no partial chart update), and chart kinds beyond the basic set need a raw `spec` object.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Manage tables](./manage-tables.md) — `manage_tables`

## Technical details

- **Impact:** destructive operation
- **Group:** Tables and charts
- **Description source:** `manage_charts` registration in `src/tools/objects.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
