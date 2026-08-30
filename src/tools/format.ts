import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import {
  DESTRUCTIVE,
  fail,
  gridRangeSchema,
  hexColorSchema,
  ok,
  sheetIdSchema,
  spreadsheetIdSchema,
  toGridRange,
  UPDATE,
} from "./util.js";

/** One border side: line style + optional color. Factory — fresh schema per field. */
const borderSchema = () =>
  z
    .object({
      style: z
        .enum(["SOLID", "SOLID_MEDIUM", "SOLID_THICK", "DOTTED", "DASHED", "DOUBLE", "NONE"])
        .describe("Line style; NONE removes the border on that side."),
      color: hexColorSchema().optional(),
    })
    .describe("Border line: {style, color?}.");

export function registerFormatTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "format_cells",
    {
      title: "Format cells",
      annotations: UPDATE,
      description:
        "Applies cell formatting to a range: background_color, text color/bold/italic/strikethrough/underline/font_size/font_family, horizontal/vertical alignment, wrap_strategy, and number format (number_format_type NUMBER/PERCENT/CURRENCY/DATE/TIME/DATE_TIME/SCIENTIFIC/TEXT with an optional number_format_pattern like \"#,##0.00\" or \"dd.mm.yyyy\"). Only the provided properties are touched — the update mask is computed automatically, so existing formatting outside it survives; at least one formatting field is required. The range is a grid rectangle addressed by sheet_id + 0-based indexes (get sheet_id from get_spreadsheet). Colors are \"#RRGGBB\" hex strings.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        range: gridRangeSchema(),
        background_color: hexColorSchema().optional(),
        text_color: hexColorSchema().optional().describe('Text color "#RRGGBB".'),
        bold: z.boolean().optional().describe("Bold text."),
        italic: z.boolean().optional().describe("Italic text."),
        strikethrough: z.boolean().optional().describe("Strikethrough text."),
        underline: z.boolean().optional().describe("Underlined text."),
        font_size: z.number().int().min(1).max(400).optional().describe("Font size in points."),
        font_family: z.string().optional().describe('Font family, e.g. "Roboto".'),
        horizontal_alignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional().describe("Horizontal alignment."),
        vertical_alignment: z.enum(["TOP", "MIDDLE", "BOTTOM"]).optional().describe("Vertical alignment."),
        wrap_strategy: z
          .enum(["OVERFLOW_CELL", "CLIP", "WRAP"])
          .optional()
          .describe("How long text behaves: overflow into empty neighbors, clip at the edge, or wrap."),
        number_format_type: z
          .enum(["TEXT", "NUMBER", "PERCENT", "CURRENCY", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"])
          .optional()
          .describe("Number format category."),
        number_format_pattern: z
          .string()
          .optional()
          .describe('Format pattern, e.g. "#,##0.00", "0.0%", "dd.mm.yyyy" (requires number_format_type).'),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.formatCells({
            spreadsheetId: args.spreadsheet_id,
            range: toGridRange(args.range),
            backgroundColor: args.background_color,
            textColor: args.text_color,
            bold: args.bold,
            italic: args.italic,
            strikethrough: args.strikethrough,
            underline: args.underline,
            fontSize: args.font_size,
            fontFamily: args.font_family,
            horizontalAlignment: args.horizontal_alignment,
            verticalAlignment: args.vertical_alignment,
            wrapStrategy: args.wrap_strategy,
            numberFormatType: args.number_format_type,
            numberFormatPattern: args.number_format_pattern,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_frozen",
    {
      title: "Freeze rows and columns",
      annotations: UPDATE,
      description:
        "Freezes the first N rows and/or columns of a sheet so they stay visible while scrolling (typical: frozen_rows=1 pins the header). 0 unfreezes. At least one of frozen_rows / frozen_columns is required; the other stays as it is. You cannot freeze all rows or all columns of a sheet — at least one unfrozen row/column must remain.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        sheet_id: sheetIdSchema(),
        frozen_rows: z.number().int().min(0).optional().describe("How many top rows to freeze (0 = unfreeze)."),
        frozen_columns: z.number().int().min(0).optional().describe("How many left columns to freeze (0 = unfreeze)."),
      },
    },
    async ({ spreadsheet_id, sheet_id, frozen_rows, frozen_columns }) => {
      try {
        return ok(
          await client.setFrozen({
            spreadsheetId: spreadsheet_id,
            sheetId: sheet_id,
            frozenRowCount: frozen_rows,
            frozenColumnCount: frozen_columns,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_borders",
    {
      title: "Set cell borders",
      annotations: UPDATE,
      description:
        "Draws borders around and/or inside a grid range. top/bottom/left/right are the range's outer edges; inner_horizontal/inner_vertical are the grid lines between cells inside it. Each side takes {style, color?} — styles SOLID, SOLID_MEDIUM, SOLID_THICK, DOTTED, DASHED, DOUBLE, or NONE to remove that side's border. Only the provided sides change; at least one is required. Colors are \"#RRGGBB\" hex (default black).",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        range: gridRangeSchema(),
        top: borderSchema().optional(),
        bottom: borderSchema().optional(),
        left: borderSchema().optional(),
        right: borderSchema().optional(),
        inner_horizontal: borderSchema().optional().describe("Horizontal lines between rows inside the range."),
        inner_vertical: borderSchema().optional().describe("Vertical lines between columns inside the range."),
      },
    },
    async ({ spreadsheet_id, range, top, bottom, left, right, inner_horizontal, inner_vertical }) => {
      try {
        return ok(
          await client.setBorders({
            spreadsheetId: spreadsheet_id,
            range: toGridRange(range),
            top,
            bottom,
            left,
            right,
            innerHorizontal: inner_horizontal,
            innerVertical: inner_vertical,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "manage_dimensions",
    {
      title: "Manage rows and columns",
      // insert/resize/hide are benign, but delete removes rows/columns with
      // their data — annotate for the worst case a call can do.
      annotations: DESTRUCTIVE,
      description:
        "Row/column operations on a run of rows (dimension=ROWS) or columns (dimension=COLUMNS), addressed by sheet_id + 0-based start_index (inclusive) and end_index (exclusive) — e.g. columns A-C = start 0, end 3. action=resize sets an exact pixel_size; auto_resize fits to content; insert adds empty rows/columns at start_index (inherit_from_before=true copies formatting from the row/column before instead of after); delete removes them WITH their data (irreversible; cell references below/right shift); hide/show toggle visibility without touching data; group/ungroup add or remove a collapsible outline group over the run (groups nest — repeat group on a subrange for a deeper level).",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z
          .enum(["resize", "auto_resize", "insert", "delete", "hide", "show", "group", "ungroup"])
          .describe("What to do with the rows/columns."),
        sheet_id: sheetIdSchema(),
        dimension: z.enum(["ROWS", "COLUMNS"]).describe("Whether the run is rows or columns."),
        start_index: z.number().int().min(0).describe("First row/column of the run, 0-based inclusive."),
        end_index: z.number().int().min(1).describe("End of the run, exclusive (rows 1-3 = start 0, end 3)."),
        pixel_size: z.number().int().min(2).optional().describe("resize: the new size in pixels."),
        inherit_from_before: z
          .boolean()
          .optional()
          .describe("insert: new rows/columns copy formatting from before the insertion point (default: after)."),
      },
    },
    async ({ spreadsheet_id, action, sheet_id, dimension, start_index, end_index, pixel_size, inherit_from_before }) => {
      const base = {
        spreadsheetId: spreadsheet_id,
        sheetId: sheet_id,
        dimension,
        startIndex: start_index,
        endIndex: end_index,
      };
      try {
        switch (action) {
          case "resize":
            if (pixel_size === undefined) return fail(new Error('action "resize" requires pixel_size.'));
            return ok(await client.resizeDimensions({ ...base, pixelSize: pixel_size }));
          case "auto_resize":
            return ok(await client.autoResizeDimensions(base));
          case "insert":
            return ok(await client.insertDimensions({ ...base, inheritFromBefore: inherit_from_before }));
          case "delete":
            return ok(await client.deleteDimensions(base));
          case "hide":
            return ok(await client.setDimensionsHidden({ ...base, hidden: true }));
          case "show":
            return ok(await client.setDimensionsHidden({ ...base, hidden: false }));
          case "group":
            return ok(await client.groupDimensions(base));
          case "ungroup":
            return ok(await client.ungroupDimensions(base));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
