import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Sheets API call",
      // Full API surface incl. batchUpdate deletions — annotate for the worst
      // case a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Sheets API v4 path directly, for requests the typed tools don\'t cover — e.g. a batchUpdate with mergeCells, named ranges, banding, basic filters, slicers, sortRange, findReplace, gradient conditional-format rules, developer metadata, or several requests in one atomic call: path "v4/spreadsheets/<spreadsheetId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string. The Bearer token is added automatically; the method defaults to GET (values updates use PUT). Sheets API paths only — Drive paths are not reachable here.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://sheets.googleapis.com, e.g. "v4/spreadsheets/<id>:batchUpdate".'),
        method: z
          .enum(["GET", "POST", "PUT"])
          .optional()
          .describe("HTTP method (the Sheets API uses only these three). Defaults to GET."),
        body: z.record(z.any()).optional().describe("JSON request body (POST/PUT only)."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
