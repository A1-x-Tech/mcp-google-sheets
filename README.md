# mcp-google-sheets

MCP server for the **Google Sheets API v4** (stdio, TypeScript). Lets AI clients
(Claude, Cursor, Codex, …) search spreadsheets, read and write ranges, manage
sheets, formatting, validation, protected ranges, conditional formats, tables,
charts and sharing.

> Technical README for the handoff stage. Full user-facing README, marketing and
> publication are the next task.

## Install & run

```bash
npx -y @a1-x-tech/mcp-google-sheets
```

MCP client config (refresh-token flow, recommended):

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "…",
        "GOOGLE_SHEETS_CLIENT_SECRET": "…",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "…"
      }
    }
  }
}
```

Alternative: a short-lived `GOOGLE_SHEETS_ACCESS_TOKEN` (~1 h; mostly for testing).
Without credentials the server still starts and lists tools; the first call
returns the exact variables to set. Optional: `GOOGLE_SHEETS_API_BASE`,
`GOOGLE_SHEETS_TIMEOUT_MS`, `GOOGLE_SHEETS_MAX_RETRIES`.

**OAuth scopes (minimal):** `https://www.googleapis.com/auth/spreadsheets` covers
every Sheets tool. Add a Drive scope (`drive`, `drive.readonly` or `drive.file`)
only for `search_spreadsheets` / `manage_permissions`.

## Tools (20)

| Domain | Tools |
|---|---|
| Spreadsheets | `create_spreadsheet`, `get_spreadsheet`, `search_spreadsheets` |
| Values | `read_values`, `write_values`, `batch_write_values`, `append_values`, `clear_values` |
| Sheets (tabs) | `manage_sheets` (add / duplicate / rename / delete / copy_to) |
| Formatting & layout | `format_cells`, `set_frozen`, `set_borders`, `manage_dimensions` |
| Rules & protection | `set_data_validation`, `manage_protected_ranges`, `manage_conditional_formats` |
| Tables & charts | `manage_tables`, `manage_charts` |
| Sharing | `manage_permissions` |
| Escape hatch | `raw_request` (any Sheets v4 path; SSRF-guarded) |

Reference: [docs/TOOLS.md](docs/TOOLS.md) · task-oriented catalog:
[docs/capabilities](docs/capabilities/index.md) · development:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · publishing:
[docs/PUBLISHING.md](docs/PUBLISHING.md).

## Engineering notes

- **Degraded start** — never exits on missing/malformed config; the fix is carried
  into the MCP session.
- **Retry policy** — 429 always retried with `Retry-After`-aware backoff; 5xx and
  network errors retried **only for reads**; writes are never replayed after an
  ambiguous failure.
- **Auth** — access tokens minted from the refresh token, cached, deduped, one
  forced re-mint + replay on 401. Tokens never appear in logs or errors.
- **SSRF guard** — paths resolve against the API base; foreign origins are
  rejected before any request, so the Bearer token never leaves Google hosts.
- **Drive is internal-only** — used for spreadsheet search, permissions and the
  smoke cleanup; no generic Drive tools are exposed.
- **Telemetry** — anonymous usage pings (event/tool names and versions only; no
  data, no arguments). Opt out: `ASKADS_TELEMETRY=0`. Details in
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Development

```bash
npm install
npm run typecheck && npm test   # offline suite + dist smoke over a real MCP handshake
npm run smoke                    # live read-only check
GOOGLE_SHEETS_SMOKE_WRITE=1 npm run smoke  # opt-in disposable write cycle with cleanup
```

## License

MIT © A1 x Tech
