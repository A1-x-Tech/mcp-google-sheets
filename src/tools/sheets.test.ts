import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSheetTools } from "./sheets.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    addSheet: make("addSheet"),
    duplicateSheet: make("duplicateSheet"),
    renameSheet: make("renameSheet"),
    deleteSheet: make("deleteSheet"),
    copySheetTo: make("copySheetTo"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSheetTools(server as never, client as never);
  return { calls, tools };
}

test("registers manage_sheets", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["manage_sheets"]);
});

test("each action routes to the matching client method", async () => {
  const { calls, tools } = harness();
  await tools.manage_sheets({ spreadsheet_id: "s", action: "add", title: "Data", index: 1, row_count: 10 });
  assert.equal(calls[0].method, "addSheet");
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    title: "Data",
    index: 1,
    rowCount: 10,
    columnCount: undefined,
  });

  await tools.manage_sheets({ spreadsheet_id: "s", action: "duplicate", sheet_id: 3, title: "Copy" });
  assert.deepEqual(calls[1].params[0], { spreadsheetId: "s", sheetId: 3, newTitle: "Copy", insertIndex: undefined });

  await tools.manage_sheets({ spreadsheet_id: "s", action: "rename", sheet_id: 3, title: "New" });
  assert.deepEqual(calls[2].params[0], { spreadsheetId: "s", sheetId: 3, title: "New" });

  await tools.manage_sheets({ spreadsheet_id: "s", action: "delete", sheet_id: 3 });
  assert.deepEqual(calls[3], { method: "deleteSheet", params: ["s", 3] });

  await tools.manage_sheets({ spreadsheet_id: "s", action: "copy_to", sheet_id: 3, destination_spreadsheet_id: "d" });
  assert.deepEqual(calls[4].params[0], { spreadsheetId: "s", sheetId: 3, destinationSpreadsheetId: "d" });
});

test("missing per-action params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const add = await tools.manage_sheets({ spreadsheet_id: "s", action: "add" });
  assert.equal(add.isError, true);
  assert.match(add.content[0].text, /requires title/);

  const dup = await tools.manage_sheets({ spreadsheet_id: "s", action: "duplicate" });
  assert.equal(dup.isError, true);
  assert.match(dup.content[0].text, /requires sheet_id/);

  const rename = await tools.manage_sheets({ spreadsheet_id: "s", action: "rename", sheet_id: 3 });
  assert.equal(rename.isError, true);
  assert.match(rename.content[0].text, /requires sheet_id and title/);

  const del = await tools.manage_sheets({ spreadsheet_id: "s", action: "delete" });
  assert.equal(del.isError, true);

  const copy = await tools.manage_sheets({ spreadsheet_id: "s", action: "copy_to", sheet_id: 3 });
  assert.equal(copy.isError, true);
  assert.match(copy.content[0].text, /destination_spreadsheet_id/);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("sheet_id 0 (the first sheet) is a valid target, not a missing one", async () => {
  const { calls, tools } = harness();
  await tools.manage_sheets({ spreadsheet_id: "s", action: "delete", sheet_id: 0 });
  assert.deepEqual(calls[0], { method: "deleteSheet", params: ["s", 0] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "deleteSheet" });
  const res = await tools.manage_sheets({ spreadsheet_id: "s", action: "delete", sheet_id: 1 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
