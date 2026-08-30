import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import { DESTRUCTIVE, fail, ok, spreadsheetIdSchema } from "./util.js";

export function registerSharingTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "manage_permissions",
    {
      title: "Manage spreadsheet access",
      // list is a read, but grant/revoke change who can reach the data and
      // revoke removes access outright — annotate for the worst case.
      annotations: DESTRUCTIVE,
      description:
        "Shares the spreadsheet (Drive permissions on the file — the OAuth token needs a Drive scope; the spreadsheets scope alone gets 403 here while every Sheets tool still works). action=list shows who has access: id, type, role, emailAddress/domain per permission; one page per call (shared-drive files cap a page at 100) — when the reply carries nextPageToken, pass it back as page_token for the rest. action=grant gives role reader/commenter/writer to type user/group (email_address required), domain (domain required, e.g. \"example.com\") or anyone (makes the link public — use deliberately); send_notification_email (default true for users) and email_message control the notification, allow_file_discovery lets domain/anyone grants surface in search. action=update changes an existing permission's role (permission_id + role). action=revoke removes a permission (permission_id) — the person loses access immediately. Ownership transfer is not supported by this server. Protecting individual ranges from co-editors is manage_protected_ranges, not this tool.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["list", "grant", "update", "revoke"]).describe("What to do with the file's permissions."),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("list: max permissions per page (1..100; shared-drive files default to 100)."),
        page_token: z.string().optional().describe("list: nextPageToken from the previous page."),
        role: z
          .enum(["reader", "commenter", "writer"])
          .optional()
          .describe("grant/update: the access level to give."),
        type: z
          .enum(["user", "group", "domain", "anyone"])
          .optional()
          .describe("grant: who the grantee is."),
        email_address: z.string().email().optional().describe("grant (user/group): the grantee's email."),
        domain: z.string().optional().describe('grant (domain): the domain, e.g. "example.com".'),
        allow_file_discovery: z
          .boolean()
          .optional()
          .describe("grant (domain/anyone): let the file appear in search results (default false)."),
        send_notification_email: z
          .boolean()
          .optional()
          .describe("grant: send the standard sharing notification (default true for users/groups)."),
        email_message: z.string().optional().describe("grant: custom text for the notification email."),
        permission_id: z
          .string()
          .optional()
          .describe("update/revoke: the permission's id from action=list (or the grant reply)."),
      },
    },
    async (args) => {
      try {
        switch (args.action) {
          case "list":
            return ok(
              await client.listPermissions({
                spreadsheetId: args.spreadsheet_id,
                pageSize: args.page_size,
                pageToken: args.page_token,
              }),
            );
          case "grant":
            if (!args.role || !args.type) return fail(new Error('action "grant" requires role and type.'));
            return ok(
              await client.grantPermission({
                spreadsheetId: args.spreadsheet_id,
                role: args.role,
                type: args.type,
                emailAddress: args.email_address,
                domain: args.domain,
                allowFileDiscovery: args.allow_file_discovery,
                sendNotificationEmail: args.send_notification_email,
                emailMessage: args.email_message,
              }),
            );
          case "update":
            if (!args.permission_id || !args.role) {
              return fail(new Error('action "update" requires permission_id and role.'));
            }
            return ok(
              await client.updatePermission({
                spreadsheetId: args.spreadsheet_id,
                permissionId: args.permission_id,
                role: args.role,
              }),
            );
          case "revoke":
            if (!args.permission_id) return fail(new Error('action "revoke" requires permission_id.'));
            return ok(await client.revokePermission(args.spreadsheet_id, args.permission_id));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
