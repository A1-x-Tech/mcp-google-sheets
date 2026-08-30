import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import { a1RangeSchema, fail, ok, READ_ONLY, spreadsheetIdSchema, WRITE } from "./util.js";

export function registerSpreadsheetTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "create_spreadsheet",
    {
      title: "Create a spreadsheet",
      annotations: WRITE,
      description:
        "Creates a new Google Sheets spreadsheet and returns it: spreadsheetId, spreadsheetUrl, properties (title, locale, timeZone) and sheets[] with each sheet's numeric sheetId. sheet_titles creates one tab per title in order (omitted = a single default \"Sheet1\"). The file lands in the authorized user's My Drive root — moving it into a folder needs the Drive API, which this server does not cover. Save the returned spreadsheetId: the Sheets API has no list endpoint of its own (search_spreadsheets exists, but it needs a Drive scope on the token).",
      inputSchema: {
        title: z.string().min(1).describe("The spreadsheet title (also the Drive file name)."),
        sheet_titles: z
          .array(z.string().min(1))
          .optional()
          .describe('Tab titles to create, in order, e.g. ["Data","Summary"]. Omitted = one default sheet.'),
        locale: z
          .string()
          .optional()
          .describe('Spreadsheet locale as ISO code, e.g. "en_US" or "ru_RU" (affects number/date parsing).'),
        time_zone: z
          .string()
          .optional()
          .describe('Time zone in CLDR format, e.g. "Europe/Moscow" (affects NOW()/TODAY()).'),
      },
    },
    async ({ title, sheet_titles, locale, time_zone }) => {
      try {
        return ok(
          await client.createSpreadsheet({ title, sheetTitles: sheet_titles, locale, timeZone: time_zone }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_spreadsheet",
    {
      title: "Get spreadsheet metadata",
      annotations: READ_ONLY,
      description:
        "Returns the spreadsheet's structure: properties (title, locale, timeZone), sheets[] with properties (sheetId, title, index, gridProperties incl. rowCount/columnCount and frozenRowCount/frozenColumnCount), plus each sheet's protectedRanges, conditionalFormats, tables and charts, and the spreadsheet's namedRanges. Call this FIRST whenever a structural tool needs a sheetId, protectedRangeId, tableId, chartId or a conditional-format rule index — titles are not addresses. By default no cell data is returned; include_grid_data=true (optionally limited to ranges) embeds cells but is heavy — prefer read_values for data. fields is a partial-response mask to trim the payload, e.g. \"sheets.properties\".",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        ranges: z
          .array(a1RangeSchema())
          .optional()
          .describe("Limit the returned sheets/grid data to these A1 ranges."),
        include_grid_data: z
          .boolean()
          .optional()
          .describe("Embed cell data (values, formats) in the response. Heavy — prefer read_values."),
        fields: z
          .string()
          .optional()
          .describe('Partial-response field mask, e.g. "sheets.properties" or "namedRanges".'),
      },
    },
    async ({ spreadsheet_id, ranges, include_grid_data, fields }) => {
      try {
        return ok(
          await client.getSpreadsheet({
            spreadsheetId: spreadsheet_id,
            ranges,
            includeGridData: include_grid_data,
            fields,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_spreadsheets",
    {
      title: "Search spreadsheets",
      annotations: READ_ONLY,
      description:
        "Finds Google Sheets spreadsheets the authorized user can open (own files and shared drives; trashed files are excluded): id, name, createdTime, modifiedTime, owners and webViewLink per file, newest-modified first by default. name_contains filters by name substring; omit it to list everything. Paginate with page_token from nextPageToken. This is the one read that goes through the Drive API internally, so the OAuth token needs a Drive scope (drive, drive.readonly or drive.file for app-created files) — with only the spreadsheets scope it fails with 403 while every other tool still works.",
      inputSchema: {
        name_contains: z
          .string()
          .optional()
          .describe("Case-insensitive name substring to filter by (omit to list all spreadsheets)."),
        page_size: z.number().int().min(1).max(1000).optional().describe("Max files per page (1..1000; default 100)."),
        page_token: z.string().optional().describe("nextPageToken from the previous page."),
        order_by: z
          .string()
          .optional()
          .describe(
            'Drive sort key, e.g. "modifiedTime desc" (default), "name", "createdTime desc", "viewedByMeTime desc".',
          ),
      },
    },
    async ({ name_contains, page_size, page_token, order_by }) => {
      try {
        return ok(
          await client.searchSpreadsheets({
            nameContains: name_contains,
            pageSize: page_size,
            pageToken: page_token,
            orderBy: order_by,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
