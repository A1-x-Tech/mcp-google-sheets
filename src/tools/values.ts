import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import {
  a1RangeSchema,
  DESTRUCTIVE,
  fail,
  ok,
  READ_ONLY,
  spreadsheetIdSchema,
  UPDATE,
  valuesSchema,
  WRITE,
} from "./util.js";

export function registerValueTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "read_values",
    {
      title: "Read values",
      annotations: READ_ONLY,
      description:
        "Reads one or more A1 ranges in a single call (one request against the quota, however many ranges) and returns valueRanges[] — each with its resolved range and a 2-D values array (outer = rows unless major_dimension=COLUMNS). Trailing empty rows/columns are omitted; a fully empty range has no values key at all. value_render_option: FORMATTED_VALUE (default, strings as displayed, honoring the cell's number format and locale), UNFORMATTED_VALUE (raw numbers/booleans), FORMULA (the formula text, e.g. \"=SUM(A1:A10)\" — the way to read formulas). With UNFORMATTED_VALUE, dates arrive as serial numbers unless date_time_render_option=FORMATTED_STRING.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        ranges: z.array(a1RangeSchema()).min(1).describe("One or more A1 ranges to read in a single call."),
        value_render_option: z
          .enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
          .optional()
          .describe("How values are rendered (default FORMATTED_VALUE); FORMULA returns formula text."),
        major_dimension: z
          .enum(["ROWS", "COLUMNS"])
          .optional()
          .describe("Whether the outer array is rows (default) or columns."),
        date_time_render_option: z
          .enum(["SERIAL_NUMBER", "FORMATTED_STRING"])
          .optional()
          .describe("How dates/times render with UNFORMATTED_VALUE (default SERIAL_NUMBER)."),
      },
    },
    async ({ spreadsheet_id, ranges, value_render_option, major_dimension, date_time_render_option }) => {
      try {
        return ok(
          await client.getValues({
            spreadsheetId: spreadsheet_id,
            ranges,
            valueRenderOption: value_render_option,
            majorDimension: major_dimension,
            dateTimeRenderOption: date_time_render_option,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "write_values",
    {
      title: "Write values to a range",
      annotations: UPDATE,
      description:
        "Overwrites one A1 range with a 2-D values matrix (rows first) and returns updatedRange/updatedRows/updatedColumns/updatedCells. The matrix is anchored at the range's top-left corner; cells beyond the matrix keep their old content, and a null entry skips (does not clear) that cell — use clear_values to empty cells. value_input_option USER_ENTERED (default) parses input like typing in the UI: \"=SUM(A1:A10)\" becomes a live formula, \"1,234\" and \"2026-01-15\" become number/date per the spreadsheet locale; RAW stores everything as literal values. For several ranges use batch_write_values (one quota unit instead of N).",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        range: a1RangeSchema(),
        values: valuesSchema(),
        value_input_option: z
          .enum(["USER_ENTERED", "RAW"])
          .optional()
          .describe("USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings."),
        include_values_in_response: z
          .boolean()
          .optional()
          .describe("Return the written cells (as rendered) in the response."),
      },
    },
    async ({ spreadsheet_id, range, values, value_input_option, include_values_in_response }) => {
      try {
        return ok(
          await client.updateValues({
            spreadsheetId: spreadsheet_id,
            range,
            values,
            valueInputOption: value_input_option,
            includeValuesInResponse: include_values_in_response,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "batch_write_values",
    {
      title: "Write values to many ranges",
      annotations: UPDATE,
      description:
        "Overwrites several A1 ranges in ONE call — one write against the per-minute quota instead of one per range, so always prefer this over looping write_values. data is a list of {range, values} pairs; all are written with the same value_input_option (USER_ENTERED parses formulas/numbers/dates, RAW stores literally). Returns totalUpdatedCells and a per-range responses[] breakdown. Like write_values, null entries skip cells rather than clearing them.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        data: z
          .array(
            z.object({
              range: a1RangeSchema(),
              values: valuesSchema(),
            }),
          )
          .min(1)
          .describe("The ranges to write, each with its own 2-D values matrix."),
        value_input_option: z
          .enum(["USER_ENTERED", "RAW"])
          .optional()
          .describe("USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings."),
      },
    },
    async ({ spreadsheet_id, data, value_input_option }) => {
      try {
        return ok(
          await client.batchUpdateValues({
            spreadsheetId: spreadsheet_id,
            data,
            valueInputOption: value_input_option,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "append_values",
    {
      title: "Append rows",
      annotations: WRITE,
      description:
        "Appends rows after the last row of the data table that contains the given range — pass the table's region (e.g. \"Sheet1!A1:D1\" or just \"Sheet1\") and the API finds the first free row itself; the response's updates.updatedRange shows where the rows actually landed. insert_data_option INSERT_ROWS pushes existing data below down; OVERWRITE (default behaviour) writes into the free rows after the table. Never retried after an ambiguous failure — re-appending would duplicate the rows, so check the sheet first (read_values) before re-sending.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        range: a1RangeSchema().describe(
          "A1 range identifying the table to append to (the API scans it for the last data row).",
        ),
        values: valuesSchema(),
        value_input_option: z
          .enum(["USER_ENTERED", "RAW"])
          .optional()
          .describe("USER_ENTERED (default) parses formulas/numbers/dates; RAW stores literal strings."),
        insert_data_option: z
          .enum(["OVERWRITE", "INSERT_ROWS"])
          .optional()
          .describe("OVERWRITE writes after the table (default); INSERT_ROWS inserts new rows, shifting data below."),
      },
    },
    async ({ spreadsheet_id, range, values, value_input_option, insert_data_option }) => {
      try {
        return ok(
          await client.appendValues({
            spreadsheetId: spreadsheet_id,
            range,
            values,
            valueInputOption: value_input_option,
            insertDataOption: insert_data_option,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "clear_values",
    {
      title: "Clear values",
      annotations: DESTRUCTIVE,
      description:
        "Empties the VALUES of one or more A1 ranges in a single call — cell contents and formulas are gone (no undo through the API), while formatting, data validation, notes, conditional formats and merges all stay. To also remove formatting use format_cells or raw_request; to delete whole rows/columns (not just their content) use manage_dimensions action=delete.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        ranges: z.array(a1RangeSchema()).min(1).describe("The A1 ranges to clear."),
      },
    },
    async ({ spreadsheet_id, ranges }) => {
      try {
        return ok(await client.clearValues({ spreadsheetId: spreadsheet_id, ranges }));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
