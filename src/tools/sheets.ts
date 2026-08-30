import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import { DESTRUCTIVE, fail, ok, sheetIdSchema, spreadsheetIdSchema } from "./util.js";

export function registerSheetTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "manage_sheets",
    {
      title: "Manage sheets",
      // One tool covers add/duplicate/rename/delete/copy_to; delete removes a
      // whole tab with its data, so the tool carries the destructive hints.
      annotations: DESTRUCTIVE,
      description:
        "Manages the sheets (tabs) of a spreadsheet. action=add creates a tab (title required; optional index position and row_count/column_count — default 1000×26). action=duplicate copies a tab within the same spreadsheet (sheet_id; optional title for the copy and index). action=rename changes a tab's title (sheet_id + title; the numeric sheetId never changes, so other tools keep working). action=delete removes the tab AND all its data — irreversible through the API, and deleting the last remaining sheet fails. action=copy_to copies a tab into ANOTHER spreadsheet (sheet_id + destination_spreadsheet_id; the copy arrives named \"Copy of ...\" — rename it there). Get sheet_id values from get_spreadsheet; every action except add returns batchUpdate replies with the affected sheet's properties.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["add", "duplicate", "rename", "delete", "copy_to"]).describe("What to do with the sheets."),
        sheet_id: sheetIdSchema().optional().describe("duplicate/rename/delete/copy_to: the target sheet."),
        title: z
          .string()
          .min(1)
          .optional()
          .describe("add: the new tab's title (required). rename: the new title (required). duplicate: the copy's title."),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("add/duplicate: 0-based tab position for the new sheet (omit = after the existing tabs)."),
        row_count: z.number().int().min(1).optional().describe("add: grid rows for the new sheet (default 1000)."),
        column_count: z.number().int().min(1).optional().describe("add: grid columns for the new sheet (default 26)."),
        destination_spreadsheet_id: z
          .string()
          .min(1)
          .optional()
          .describe("copy_to: the spreadsheet to copy the sheet into."),
      },
    },
    async ({ spreadsheet_id, action, sheet_id, title, index, row_count, column_count, destination_spreadsheet_id }) => {
      try {
        switch (action) {
          case "add":
            if (!title) return fail(new Error('action "add" requires title.'));
            return ok(
              await client.addSheet({
                spreadsheetId: spreadsheet_id,
                title,
                index,
                rowCount: row_count,
                columnCount: column_count,
              }),
            );
          case "duplicate":
            if (sheet_id === undefined) return fail(new Error('action "duplicate" requires sheet_id.'));
            return ok(
              await client.duplicateSheet({
                spreadsheetId: spreadsheet_id,
                sheetId: sheet_id,
                newTitle: title,
                insertIndex: index,
              }),
            );
          case "rename":
            if (sheet_id === undefined || !title) {
              return fail(new Error('action "rename" requires sheet_id and title.'));
            }
            return ok(await client.renameSheet({ spreadsheetId: spreadsheet_id, sheetId: sheet_id, title }));
          case "delete":
            if (sheet_id === undefined) return fail(new Error('action "delete" requires sheet_id.'));
            return ok(await client.deleteSheet(spreadsheet_id, sheet_id));
          case "copy_to":
            if (sheet_id === undefined || !destination_spreadsheet_id) {
              return fail(new Error('action "copy_to" requires sheet_id and destination_spreadsheet_id.'));
            }
            return ok(
              await client.copySheetTo({
                spreadsheetId: spreadsheet_id,
                sheetId: sheet_id,
                destinationSpreadsheetId: destination_spreadsheet_id,
              }),
            );
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
