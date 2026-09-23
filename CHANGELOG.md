# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-24

### Changed

- First stable release. The code is unchanged from 0.2.0; the version now states
  what was already true of it — the tool surface, tool argument shapes,
  environment variable names and response envelopes are settled, and breaking any
  of them from here on requires a major bump.

## [0.2.0] - 2026-09-20

### Added

- In-chat Google login via `@a1-x-tech/mcp-google-auth` — 6 new onboarding
  tools: `auth_status`, `setup_instructions`, `set_client`, `start_login`
  (deliberately not read-only), `finish_login`, `logout`. The flow is loopback
  `127.0.0.1` + PKCE against a user-owned Desktop OAuth client; the code is
  exchanged locally and the client secret never passes through the chat. Each
  tool has a capability page under `docs/capabilities/`.
- Tokens from a login are stored per server in
  `~/.config/mcp-google-sheets/credentials.json` (0600) and re-read on every
  call, so a login finished mid-session works without restarting the AI client.
  `GOOGLE_SHEETS_OAUTH_PORT` pins the loopback listener port for SSH forwarding.

### Changed

- The client accepts the component's `TokenProvider` as a fallback token
  source: environment credentials (the refresh triple or `GOOGLE_SHEETS_ACCESS_TOKEN`)
  keep absolute priority and behave exactly as before; the stored in-chat login
  is used only when the environment carries no credentials. The single 401
  re-mint + replay works for provider-backed tokens too, and is skipped when
  nothing can be re-minted.
- The unconfigured `initialize` instructions lead with the in-chat login
  (`setup_instructions` → `set_client` → `start_login` → `finish_login`, no
  restart needed); setting the environment variables + restart remains the
  documented alternative.

## [0.1.0] — 2026-08-30

### Added

- First release: a full MCP server for the Google Sheets API v4 (stdio,
  TypeScript, `@modelcontextprotocol/sdk` + `zod`).
- Tools (20):
  - `create_spreadsheet`, `get_spreadsheet` (structure, sheetIds, rule/table/chart
    ids), `search_spreadsheets` (Drive-backed name search);
  - `read_values` (multi-range batchGet; formulas via `FORMULA` rendering),
    `write_values`, `batch_write_values` (one quota unit for many ranges),
    `append_values`, `clear_values`;
  - `manage_sheets` — add / duplicate / rename / delete / copy_to another
    spreadsheet;
  - `format_cells` (computed fields masks), `set_frozen`, `set_borders`,
    `manage_dimensions` — resize / auto_resize / insert / delete / hide / show /
    group / ungroup rows and columns;
  - `set_data_validation` (incl. in-cell dropdowns; omit the condition to clear),
    `manage_protected_ranges`, `manage_conditional_formats` (boolean rules by
    per-sheet index);
  - `manage_tables` (structured tables incl. typed columns), `manage_charts`
    (basic + pie from simplified params, raw ChartSpec passthrough);
  - `manage_permissions` — list / grant / update / revoke Drive permissions;
  - `raw_request` — escape hatch to any Sheets API v4 path (SSRF-guarded,
    Sheets origin only).
- OAuth2 refresh flow: access tokens are minted from
  `GOOGLE_SHEETS_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, cached until just
  before expiry, deduped across concurrent requests and re-minted once on a 401;
  a static `GOOGLE_SHEETS_ACCESS_TOKEN` works as an alternative.
- Degraded start: missing credentials never kill the process — the server
  completes the MCP handshake, serves tools/list, opens the instructions with the
  fix, and the first tool call fails with the actionable `CredentialsError`.
  Malformed config (`incomplete_oauth_config`) degrades the same way.
- Resilience: request timeout covering body reads, `Retry-After`-aware backoff,
  429 retried for every method, 5xx/network retries gated to reads so writes are
  never replayed.
- Anonymous usage telemetry (event/tool names and versions only; opt out with
  `ASKADS_TELEMETRY=0`), including `unconfigured_start`/`startup_failed`.
- Offline test suite: mocked-fetch client tests incl. the OAuth flow, fake-server
  tool tests, pinned per-tool annotations, capability-docs coverage tests, plus a
  dist smoke test that spawns the built binary and performs a real MCP handshake
  over stdio (configured and unconfigured).
- Opt-in live smoke (`GOOGLE_SHEETS_SMOKE_WRITE=1`): create a disposable
  spreadsheet → write → read back and verify → trash the file, with cleanup after
  success and failure alike.
- CI (Node 20/22/24: typecheck + build + tests) and a daily live health check
  that skips itself when repo secrets are absent.

[1.0.0]: https://github.com/A1-x-Tech/mcp-google-sheets/releases/tag/v1.0.0
[0.2.0]: https://github.com/A1-x-Tech/mcp-google-sheets/releases/tag/v0.2.0
[0.1.0]: https://github.com/A1-x-Tech/mcp-google-sheets/releases/tag/v0.1.0
