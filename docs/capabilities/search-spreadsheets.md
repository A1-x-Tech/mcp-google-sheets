# Google Sheets: Search spreadsheets — MCP tool

**Google Sheets MCP tool:** Finds Google Sheets spreadsheets the authorized user can open (own files and shared drives; trashed files are excluded): id, name, createdTime, modifiedTime, owners and webViewLink per file, newest-modified first by default.

Technical name: `search_spreadsheets`

## What task it solves

> I want to find a spreadsheet by name.

Finds Google Sheets spreadsheets the authorized user can open (own files and shared drives; trashed files are excluded): id, name, createdTime, modifiedTime, owners and webViewLink per file, newest-modified first by default. name_contains filters by name substring; omit it to list everything. Paginate with page_token from nextPageToken. This is the one read that goes through the Drive API internally, so the OAuth token needs a Drive scope (drive, drive.readonly or drive.file for app-created files) — with only the spreadsheets scope it fails with 403 while every other tool still works.

## When to use it

Use this capability when you need “Search spreadsheets” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `name_contains` — optional. Case-insensitive name substring to filter by (omit to list all spreadsheets).
- `page_size` — optional. Max files per page (1..1000; default 100).
- `page_token` — optional. nextPageToken from the previous page.
- `order_by` — optional. Drive sort key, e.g. "modifiedTime desc" (default), "name", "createdTime desc", "viewedByMeTime desc".

## What it returns

Finds Google Sheets spreadsheets the authorized user can open (own files and shared drives; trashed files are excluded): id, name, createdTime, modifiedTime, owners and webViewLink per file, newest-modified first by default. name_contains filters by name substring; omit it to list everything. Paginate with page_token from nextPageToken. This is the one read that goes through the Drive API internally, so the OAuth token needs a Drive scope (drive, drive.readonly or drive.file for app-created files) — with only the spreadsheets scope it fails with 403 while every other tool still works.

## What changes in Google Sheets

The tool reads Google Sheets data and does not change it.

## Example request

> Search spreadsheets in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

Needs a Drive scope (drive, drive.readonly, or drive.file for app-created files) on the OAuth token; with only the spreadsheets scope the call fails with 403 while every other Sheets tool still works.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a spreadsheet](./create-spreadsheet.md) — `create_spreadsheet`
- [Get spreadsheet metadata](./get-spreadsheet.md) — `get_spreadsheet`

## Technical details

- **Impact:** read-only
- **Group:** Spreadsheets
- **Description source:** `search_spreadsheets` registration in `src/tools/spreadsheets.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
