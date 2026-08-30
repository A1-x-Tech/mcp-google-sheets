# Google Sheets: Manage spreadsheet access — MCP tool

**Google Sheets MCP tool:** Shares the spreadsheet (Drive permissions on the file — the OAuth token needs a Drive scope; the spreadsheets scope alone gets 403 here while every Sheets tool still works).

Technical name: `manage_permissions`

## What task it solves

> I want to share a spreadsheet.

Shares the spreadsheet (Drive permissions on the file — the OAuth token needs a Drive scope; the spreadsheets scope alone gets 403 here while every Sheets tool still works). action=list shows who has access: id, type, role, emailAddress/domain per permission; one page per call (shared-drive files cap a page at 100) — when the reply carries nextPageToken, pass it back as page_token for the rest. action=grant gives role reader/commenter/writer to type user/group (email_address required), domain (domain required, e.g. "example.com") or anyone (makes the link public — use deliberately); send_notification_email (default true for users) and email_message control the notification, allow_file_discovery lets domain/anyone grants surface in search. action=update changes an existing permission's role (permission_id + role). action=revoke removes a permission (permission_id) — the person loses access immediately. Ownership transfer is not supported by this server. Protecting individual ranges from co-editors is manage_protected_ranges, not this tool.

## When to use it

Use this capability when you need “Manage spreadsheet access” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the file's permissions.
- `page_size` — optional. list: max permissions per page (1..100; shared-drive files default to 100).
- `page_token` — optional. list: nextPageToken from the previous page.
- `role` — optional. grant/update: the access level to give.
- `type` — optional. grant: who the grantee is.
- `email_address` — optional. grant (user/group): the grantee's email.
- `domain` — optional. grant (domain): the domain, e.g. "example.com".
- `allow_file_discovery` — optional. grant (domain/anyone): let the file appear in search results (default false).
- `send_notification_email` — optional. grant: send the standard sharing notification (default true for users/groups).
- `email_message` — optional. grant: custom text for the notification email.
- `permission_id` — optional. update/revoke: the permission's id from action=list (or the grant reply).

## What it returns

Shares the spreadsheet (Drive permissions on the file — the OAuth token needs a Drive scope; the spreadsheets scope alone gets 403 here while every Sheets tool still works). action=list shows who has access: id, type, role, emailAddress/domain per permission; one page per call (shared-drive files cap a page at 100) — when the reply carries nextPageToken, pass it back as page_token for the rest. action=grant gives role reader/commenter/writer to type user/group (email_address required), domain (domain required, e.g. "example.com") or anyone (makes the link public — use deliberately); send_notification_email (default true for users) and email_message control the notification, allow_file_discovery lets domain/anyone grants surface in search. action=update changes an existing permission's role (permission_id + role). action=revoke removes a permission (permission_id) — the person loses access immediately. Ownership transfer is not supported by this server. Protecting individual ranges from co-editors is manage_protected_ranges, not this tool.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage spreadsheet access in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Needs a Drive scope on the OAuth token (403 without it). Ownership transfer is not supported by this server, and `type=anyone` makes the link public — grant it deliberately.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Manage protected ranges](./manage-protected-ranges.md) — `manage_protected_ranges`
- [Search spreadsheets](./search-spreadsheets.md) — `search_spreadsheets`
- [Get spreadsheet metadata](./get-spreadsheet.md) — `get_spreadsheet`

## Technical details

- **Impact:** destructive operation
- **Group:** Sharing
- **Description source:** `manage_permissions` registration in `src/tools/sharing.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
