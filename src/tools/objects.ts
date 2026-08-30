import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import { DESTRUCTIVE, fail, gridRangeSchema, ok, sheetIdSchema, spreadsheetIdSchema, toGridRange } from "./util.js";

export function registerObjectTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "manage_tables",
    {
      title: "Manage tables",
      annotations: DESTRUCTIVE,
      description:
        "Manages structured tables (the \"Convert to table\" feature: named ranges with per-column types, filters and formatting). action=add creates a table over a grid range whose FIRST ROW becomes the header: name (must be unique in the spreadsheet) + range required; column_properties optionally types the columns — a list of raw TableColumnProperties objects, e.g. [{\"columnIndex\":0,\"columnName\":\"Task\",\"columnType\":\"TEXT\"},{\"columnIndex\":1,\"columnName\":\"Done\",\"columnType\":\"BOOLEAN\"}] (columnType TEXT/PERCENT/DROPDOWN/DOUBLE/CURRENCY/DATE/TIME/DATE_TIME/BOOLEAN; DROPDOWN adds dataValidationRule). The reply carries the new table with its tableId. action=update renames and/or re-ranges an existing table (table_id + name and/or range; expanding the range grows the table). action=delete removes the TABLE DEFINITION only — the cell data stays; clear the cells separately if needed. Find tableIds via get_spreadsheet (sheets[].tables).",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["add", "update", "delete"]).describe("What to do with the tables."),
        name: z.string().min(1).optional().describe("add (required) / update: the table's unique name."),
        range: gridRangeSchema().optional().describe("add (required) / update: the table's cells incl. the header row."),
        column_properties: z
          .array(z.record(z.any()))
          .optional()
          .describe(
            'add: raw TableColumnProperties list, e.g. [{"columnIndex":0,"columnName":"Task","columnType":"TEXT"}].',
          ),
        table_id: z.string().optional().describe("update/delete: the tableId from get_spreadsheet or the add reply."),
      },
    },
    async ({ spreadsheet_id, action, name, range, column_properties, table_id }) => {
      try {
        switch (action) {
          case "add":
            if (!name || !range) return fail(new Error('action "add" requires name and range.'));
            return ok(
              await client.addTable({
                spreadsheetId: spreadsheet_id,
                name,
                range: toGridRange(range),
                columnProperties: column_properties,
              }),
            );
          case "update":
            if (!table_id) return fail(new Error('action "update" requires table_id.'));
            return ok(
              await client.updateTable({
                spreadsheetId: spreadsheet_id,
                tableId: table_id,
                name,
                range: range ? toGridRange(range) : undefined,
              }),
            );
          case "delete":
            if (!table_id) return fail(new Error('action "delete" requires table_id.'));
            return ok(await client.deleteTable(spreadsheet_id, table_id));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "manage_charts",
    {
      title: "Manage charts",
      annotations: DESTRUCTIVE,
      description:
        "Manages embedded charts. action=add builds a chart from chart_type (COLUMN/BAR/LINE/AREA/STEPPED_AREA/SCATTER/PIE), domain_range (x-axis labels / pie labels), series_ranges (one grid range per data series; PIE takes exactly one) and optional title/legend_position/header_count (rows of the ranges treated as headers, default 1) — place it with anchor {sheet_id,row_index,column_index} (the cell under the chart's top-left corner) or new_sheet=true for its own chart sheet; the reply carries the new chartId. Ranges should be single columns (or rows) including the header cell. For chart kinds beyond the basic set (combo, waterfall, histogram, org …) pass a raw Sheets API ChartSpec via spec instead — it overrides the simplified fields. action=update REPLACES the whole spec of an existing chart (chart_id + the same spec-building fields; there is no partial chart update). action=delete removes the chart by chart_id. Find chartIds via get_spreadsheet (sheets[].charts).",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["add", "update", "delete"]).describe("What to do with the charts."),
        chart_id: z.number().int().optional().describe("update/delete: the chartId from get_spreadsheet or the add reply."),
        chart_type: z
          .enum(["COLUMN", "BAR", "LINE", "AREA", "STEPPED_AREA", "SCATTER", "PIE"])
          .optional()
          .describe("add/update: the chart kind (required unless spec is given)."),
        title: z.string().optional().describe("Chart title."),
        domain_range: gridRangeSchema().optional().describe("The x-axis (or pie label) values, incl. header cell."),
        series_ranges: z
          .array(gridRangeSchema())
          .optional()
          .describe("One range per data series, incl. header cells (PIE: exactly one)."),
        legend_position: z
          .string()
          .optional()
          .describe("BOTTOM_LEGEND, LEFT_LEGEND, RIGHT_LEGEND, TOP_LEGEND or NO_LEGEND (default: API's choice)."),
        header_count: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("How many leading rows of the ranges are headers (default 1)."),
        spec: z
          .record(z.any())
          .optional()
          .describe("Raw Sheets API ChartSpec — full control; overrides the simplified fields above."),
        anchor: z
          .object({
            sheet_id: sheetIdSchema(),
            row_index: z.number().int().min(0).describe("0-based row of the anchor cell."),
            column_index: z.number().int().min(0).describe("0-based column of the anchor cell."),
          })
          .optional()
          .describe("add: place the chart over the grid, top-left at this cell."),
        new_sheet: z.boolean().optional().describe("add: put the chart on its own new chart sheet instead."),
      },
    },
    async (args) => {
      const specParams = {
        chartType: args.chart_type,
        title: args.title,
        domainRange: args.domain_range ? toGridRange(args.domain_range) : undefined,
        seriesRanges: args.series_ranges?.map(toGridRange),
        legendPosition: args.legend_position,
        headerCount: args.header_count,
        spec: args.spec,
      };
      try {
        switch (args.action) {
          case "add":
            return ok(
              await client.addChart({
                spreadsheetId: args.spreadsheet_id,
                ...specParams,
                anchor: args.anchor
                  ? { sheetId: args.anchor.sheet_id, rowIndex: args.anchor.row_index, columnIndex: args.anchor.column_index }
                  : undefined,
                newSheet: args.new_sheet,
              }),
            );
          case "update":
            if (args.chart_id === undefined) return fail(new Error('action "update" requires chart_id.'));
            return ok(
              await client.updateChart({ spreadsheetId: args.spreadsheet_id, chartId: args.chart_id, ...specParams }),
            );
          case "delete":
            if (args.chart_id === undefined) return fail(new Error('action "delete" requires chart_id.'));
            return ok(await client.deleteChart(args.spreadsheet_id, args.chart_id));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
