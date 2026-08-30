# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Sheets MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-sheets)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-sheets)
[![CI](https://github.com/A1-x-Tech/mcp-google-sheets/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-sheets/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-sheets/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-sheets)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Sheets MCP** lets an AI app work with Google Sheets in plain language. Find a spreadsheet, read its data, write and append rows, shape sheets and formatting, build charts and share the result.

It uses the Google Sheets API with your Google account. It separates reading from writing, keeps destructive operations explicit and makes the limits of the Sheets API clear instead of implying that every spreadsheet task is possible.

- **20 tools.** Search and create spreadsheets, read and write ranges, manage sheets, formatting, data validation, protected ranges, conditional formats, structured tables, charts and access.
- **Writes are deliberate.** A write is never replayed after an ambiguous failure — a replayed append would duplicate rows — and destructive tools are marked so your AI client can ask first.
- **Sheets only.** Drive is an internal dependency for spreadsheet search and sharing alone; there is no generic Drive tool, and `raw_request` cannot reach Drive.
- **Minimal Google scopes.** `spreadsheets` covers every Sheets tool; a Drive scope is needed only for spreadsheet search and sharing.

Start with a read-only question:

> Find the quarterly budget spreadsheet and summarize what each of its sheets contains.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** Show me the structure of the sales report spreadsheet — its sheets, their sizes and frozen rows.
>
> **Assistant:** Shows the sheets with their sizes, frozen headers and the objects on them. Nothing changes.
>
> **You:** Prepare a “March” sheet as a copy of “February” and clear the numbers, keeping the layout.
>
> **Assistant:** Shows the plan — duplicate the sheet, rename it and clear the data ranges — then asks for confirmation before changing anything.
>
> **You:** Confirm.
>
> **Assistant:** Duplicates the sheet and clears the values. Formatting, data validation and frozen rows stay.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a spreadsheet changes](#how-a-spreadsheet-changes)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account and OAuth credentials from a Google Cloud project with the Google Sheets API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → Plugins → MCP servers**, select **Add server**, then add `npx -y @a1-x-tech/mcp-google-sheets@latest` with `GOOGLE_SHEETS_CLIENT_ID`, `GOOGLE_SHEETS_CLIENT_SECRET` and `GOOGLE_SHEETS_REFRESH_TOKEN`.

**From the command line:**

```bash
codex mcp add google-sheets \
  --env GOOGLE_SHEETS_CLIENT_ID=your_client_id \
  --env GOOGLE_SHEETS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SHEETS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-sheets@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_SHEETS_CLIENT_ID=your_client_id \
  --env GOOGLE_SHEETS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SHEETS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-sheets \
  -- npx -y @a1-x-tech/mcp-google-sheets@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "your_client_id",
        "GOOGLE_SHEETS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

If **Edit Config** is unavailable, edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "your_client_id",
        "GOOGLE_SHEETS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "${input:sheets_client_id}",
        "GOOGLE_SHEETS_CLIENT_SECRET": "${input:sheets_client_secret}",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "${input:sheets_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "sheets_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "sheets_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "sheets_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Find and read data

- Find the newest spreadsheet with “budget” in the name and show its structure.
- Read `'Q3'!A1:F50` and summarize the totals.
- Show the formulas behind the Summary sheet.

### Update the numbers

- Write this table into `Sheet1!A1`, formulas included.
- Append today’s figures as a new row of the log.
- Update several ranges in one batch, or clear a draft range while keeping its formatting.

### Shape and present

- Add a “March” sheet, freeze the header row and make it bold.
- Highlight negative amounts in red with a conditional format and add borders.
- Build a column chart of revenue by month on its own sheet.
- Turn the data into a structured table and add a dropdown with data validation.

### Protect and share

- Protect the totals row so only I can edit it.
- Give a colleague edit access and everyone else read-only.
- Show who currently has access to the file.

## How a spreadsheet changes

1. Values tools address cells in **A1 notation** (`'Sheet name'!A1:C10`); structural tools (sheets, formatting, rules, tables, charts) address a numeric **sheetId** with 0-based indexes. `get_spreadsheet` supplies the ids — sheet titles are not addresses.
2. A write **overwrites** its range; `append_values` adds rows after the last data row; a `null` cell is skipped, not cleared.
3. `clear_values` empties values and formulas but keeps formatting, data validation, notes and merges. There is no undo through the API — deleting a sheet, rows or columns destroys their data.
4. Batch tools carry several ranges or requests in one call and count once against the quota; a `batchUpdate` is atomic — all of its requests apply or none do.

Some spreadsheet features have no dedicated tool: merged cells, named ranges, banding, filters, slicers, find-and-replace and gradient conditional-format rules go through `raw_request`, which is limited to the Sheets API origin. A new spreadsheet lands in the My Drive root — moving it into a folder is not covered, and `manage_permissions` cannot transfer ownership.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Read metadata or values | Reads structure and cells | No change |
| Create a spreadsheet | Adds a file to My Drive | Changes Google Sheets |
| Write, batch-write or append values | Overwrites cells or adds rows | Changes a spreadsheet |
| Format, freeze, borders, dimensions, validation, rules, tables, charts | Changes presentation, structure and rules | Changes a spreadsheet |
| Clear values or delete a sheet, rows or columns | Removes data with no undo through the API | Destructive |
| Manage protected ranges and permissions | Changes who can open or edit the file | Changes access |
| Raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish an inspection from a live change.

## Getting access

Google Sheets requires OAuth 2.0 to edit spreadsheets; an API key is not enough.

1. Create or select a Google Cloud project and enable the **Google Sheets API**. Also enable the **Google Drive API** if you want spreadsheet search and sharing.
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account that owns or can edit the spreadsheets. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request the minimal scope:

   ```text
   https://www.googleapis.com/auth/spreadsheets
   ```

   It covers every Sheets tool. Only `search_spreadsheets` and `manage_permissions` need a Drive scope on top: `https://www.googleapis.com/auth/drive`, or `drive.readonly` for search alone, or `drive.file` for files created through this app.

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SHEETS_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_SHEETS_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_SHEETS_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_SHEETS_ACCESS_TOKEN` | Yes* | Short-lived (~1 h) alternative to the OAuth trio. |
| `GOOGLE_SHEETS_API_BASE` | No | Google Sheets API base URL override. |
| `GOOGLE_SHEETS_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_SHEETS_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token. Without credentials the server still starts and lists its tools; the first call names the variables to set.

## Data, limits and background work

- **Requests go to Google.** The local server refreshes Google OAuth tokens and calls the Sheets API — and, for spreadsheet search and sharing only, the Drive API. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, spreadsheet data, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies per-minute quotas.** The documented limits are 300 reads and 300 writes per minute per project, and 60 of each per user; a batch call counts once however many ranges or requests it carries. A spreadsheet holds at most 10,000,000 cells. On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are not replayed after an uncertain failure.
- **There is no background polling.** The server runs only when called. If your AI app supports scheduled tasks, it can check a spreadsheet periodically.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Sheets API reference](https://developers.google.com/sheets/api)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-sheets/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
