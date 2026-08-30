# Development

## Requirements

- Node.js 20+ (the published package ships compiled `dist/`; `npx` needs no separate
  install). CI runs the suite on Node 20, 22 and 24.

## Commands

```bash
npm install
npm run dev        # run from source with tsx watch
npm test           # unit tests (node:test) + dist smoke, no network
npm run typecheck  # type-check src + tests (no emit)
npm run build      # clean dist/ and compile with tsc
npm run smoke      # live check (read-only by default; see below)
```

## Local run

```bash
npm run build
GOOGLE_SHEETS_CLIENT_ID=... GOOGLE_SHEETS_CLIENT_SECRET=... GOOGLE_SHEETS_REFRESH_TOKEN=... \
  node dist/index.js
# or, for a quick session with a short-lived token:
GOOGLE_SHEETS_ACCESS_TOKEN=$(gcloud auth print-access-token) node dist/index.js
# optional: GOOGLE_SHEETS_API_BASE, GOOGLE_SHEETS_TIMEOUT_MS, GOOGLE_SHEETS_MAX_RETRIES
```

OAuth scopes: `https://www.googleapis.com/auth/spreadsheets` covers every Sheets tool;
add a Drive scope (`drive`, `drive.readonly` or `drive.file`) only if you need
`search_spreadsheets` / `manage_permissions`.

## Live smoke

`npm run smoke` is read-only by default: with a spreadsheet id (first argv or
`GOOGLE_SHEETS_SMOKE_SPREADSHEET_ID`) it fetches that spreadsheet's metadata; without one it
just mints an access token from the refresh token — either way nothing is written.

`GOOGLE_SHEETS_SMOKE_WRITE=1 npm run smoke` opts into the full write cycle on a
**disposable** resource: create a throwaway spreadsheet → write values → read back and
verify → trash the Drive file. Cleanup runs in `finally` — after success **and** after a
failed step — so nothing durable is left behind. The write cycle needs a Drive scope
(`drive.file` is enough: the file is app-created).

## Tests

Unit tests mock `globalThis.fetch` (client) or use a fake server + fake client (tools), so
the whole suite runs offline — including the OAuth refresh flow, whose token endpoint is
served by the same fetch stub. `test/dist-smoke.test.js` additionally spawns the built
`dist/index.js` and performs a real MCP handshake over stdio through the official SDK,
asserting the server identity and the full tool list. Put a `*.test.ts` next to the code it
covers; `npm run typecheck && npm test` is the gate (also run by `prepublishOnly`).

## Usage telemetry

The server sends anonymous events to `usage.gistrec.cloud` (`server_start` when a client
connects to a configured install, `unconfigured_start` when a client connects to a server
without credentials, `tool_call` with the tool **name**, and `startup_failed` with a
fixed-vocabulary reason code when the configuration is malformed) to count active installs
and tool demand. An event carries only impersonal technical fields: a random installation id
(`~/.config/mcp-google-sheets/instance-id`), the package version, the AI client's name and
version from the MCP handshake, the Node.js version and the OS.

OAuth credentials, spreadsheet data, tool arguments and prompts are never sent or stored
(implementation: `src/telemetry.ts`). Sends run in the background with a 2 s timeout and are
silently skipped on any error. Opt out for all servers of this line at once:
`ASKADS_TELEMETRY=0`.
