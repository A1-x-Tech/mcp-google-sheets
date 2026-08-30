import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleSheetsClient } from "../dist/client.js";
import { registerSpreadsheetTools } from "../dist/tools/spreadsheets.js";
import { registerValueTools } from "../dist/tools/values.js";
import { registerSheetTools } from "../dist/tools/sheets.js";
import { registerFormatTools } from "../dist/tools/format.js";
import { registerRuleTools } from "../dist/tools/rules.js";
import { registerObjectTools } from "../dist/tools/objects.js";
import { registerSharingTools } from "../dist/tools/sharing.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = [
  "append_values",
  "batch_write_values",
  "clear_values",
  "create_spreadsheet",
  "format_cells",
  "get_spreadsheet",
  "manage_charts",
  "manage_conditional_formats",
  "manage_dimensions",
  "manage_permissions",
  "manage_protected_ranges",
  "manage_sheets",
  "manage_tables",
  "raw_request",
  "read_values",
  "search_spreadsheets",
  "set_borders",
  "set_data_validation",
  "set_frozen",
  "write_values",
];

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleSheetsClient({
      accessToken: "SECRET",
      apiBase: "https://sheets.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"spreadsheetId":"s-1"}', { status: 200 });
  };
  try {
    const client = new GoogleSheetsClient({
      accessToken: "SECRET",
      apiBase: "https://sheets.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createSpreadsheet({ title: "Smoke" });
    assert.equal(seen.url, "https://sheets.googleapis.com/v4/spreadsheets");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { properties: { title: "Smoke" } });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerSpreadsheetTools(server, client);
  registerValueTools(server, client);
  registerSheetTools(server, client);
  registerFormatTools(server, client);
  registerRuleTools(server, client);
  registerObjectTools(server, client);
  registerSharingTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_SHEETS_ACCESS_TOKEN: "test-token",
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-sheets");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Sheets API v4/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const getSpreadsheet = tools.find((t) => t.name === "get_spreadsheet");
    assert.equal(getSpreadsheet.annotations?.readOnlyHint, true);
    assert.ok(getSpreadsheet.inputSchema?.properties?.spreadsheet_id, "input schema must reach the client");
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must not
 * exit(1) before the handshake, leaving the client a dead server and no reason.
 * It must start, list every tool, open the instructions with the fix, and
 * answer a tool call with the actionable error — offline: the CredentialsError
 * fires before any fetch, so this test never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_SHEETS_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke-unconfigured", version: "0.0.0" });
  await client.connect(transport);
  try {
    // The model must read the fix before it picks a tool.
    const instructions = client.getInstructions() ?? "";
    assert.match(instructions, /not connected/);
    assert.match(instructions, /GOOGLE_SHEETS_CLIENT_ID/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A tool call fails with the exact message instead of killing the server.
    const result = await client.callTool({
      name: "get_spreadsheet",
      arguments: { spreadsheet_id: "smoke-spreadsheet" },
    });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /Google OAuth credentials are required: set GOOGLE_SHEETS_CLIENT_ID/);
    assert.match(text, /restart the server/);
  } finally {
    await client.close();
  }
});
