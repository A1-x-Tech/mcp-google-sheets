# Google Sheets: Create a spreadsheet — MCP tool

**Google Sheets MCP tool:** Creates a new Google Sheets spreadsheet and returns it: spreadsheetId, spreadsheetUrl, properties (title, locale, timeZone) and sheets[] with each sheet's numeric sheetId.

Technical name: `create_spreadsheet`

## What task it solves

> I want to create a new spreadsheet.

Creates a new Google Sheets spreadsheet and returns it: spreadsheetId, spreadsheetUrl, properties (title, locale, timeZone) and sheets[] with each sheet's numeric sheetId. sheet_titles creates one tab per title in order (omitted = a single default "Sheet1"). The file lands in the authorized user's My Drive root — moving it into a folder needs the Drive API, which this server does not cover. Save the returned spreadsheetId: the Sheets API has no list endpoint of its own (search_spreadsheets exists, but it needs a Drive scope on the token).

## When to use it

Use this capability when you need “Create a spreadsheet” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `title` — **required**. The spreadsheet title (also the Drive file name).
- `sheet_titles` — optional. Tab titles to create, in order, e.g. ["Data","Summary"]. Omitted = one default sheet.
- `locale` — optional. Spreadsheet locale as ISO code, e.g. "en_US" or "ru_RU" (affects number/date parsing).
- `time_zone` — optional. Time zone in CLDR format, e.g. "Europe/Moscow" (affects NOW()/TODAY()).

## What it returns

Creates a new Google Sheets spreadsheet and returns it: spreadsheetId, spreadsheetUrl, properties (title, locale, timeZone) and sheets[] with each sheet's numeric sheetId. sheet_titles creates one tab per title in order (omitted = a single default "Sheet1"). The file lands in the authorized user's My Drive root — moving it into a folder needs the Drive API, which this server does not cover. Save the returned spreadsheetId: the Sheets API has no list endpoint of its own (search_spreadsheets exists, but it needs a Drive scope on the token).

## What changes in Google Sheets

The call writes to the live spreadsheet immediately: the affected cells or properties are overwritten with the provided values. Untouched cells and properties keep their previous state, and repeating the same call converges to the same result.

## Example request

> Create a spreadsheet in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

The file always lands in the authorized user's My Drive root; moving it into a folder needs the Drive API, which this server does not cover.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get spreadsheet metadata](./get-spreadsheet.md) — `get_spreadsheet`
- [Search spreadsheets](./search-spreadsheets.md) — `search_spreadsheets`

## Technical details

- **Impact:** changes data
- **Group:** Spreadsheets
- **Description source:** `create_spreadsheet` registration in `src/tools/spreadsheets.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
