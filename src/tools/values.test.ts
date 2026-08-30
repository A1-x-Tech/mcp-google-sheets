import { test } from "node:test";
import assert from "node:assert/strict";
import { registerValueTools } from "./values.js";

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
    getValues: make("getValues"),
    updateValues: make("updateValues"),
    batchUpdateValues: make("batchUpdateValues"),
    appendValues: make("appendValues"),
    clearValues: make("clearValues"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerValueTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five value tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "append_values",
    "batch_write_values",
    "clear_values",
    "read_values",
    "write_values",
  ]);
});

test("read_values forwards ranges and render options normalized", async () => {
  const { calls, tools } = harness();
  await tools.read_values({
    spreadsheet_id: "s",
    ranges: ["A1:B2", "Sheet2!A:A"],
    value_render_option: "FORMULA",
    major_dimension: "COLUMNS",
    date_time_render_option: "FORMATTED_STRING",
  });
  assert.equal(calls[0].method, "getValues");
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    ranges: ["A1:B2", "Sheet2!A:A"],
    valueRenderOption: "FORMULA",
    majorDimension: "COLUMNS",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
});

test("write_values forwards the matrix and input option", async () => {
  const { calls, tools } = harness();
  await tools.write_values({
    spreadsheet_id: "s",
    range: "A1:B2",
    values: [["a", 1]],
    value_input_option: "RAW",
    include_values_in_response: true,
  });
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    range: "A1:B2",
    values: [["a", 1]],
    valueInputOption: "RAW",
    includeValuesInResponse: true,
  });
});

test("batch_write_values forwards the data pairs", async () => {
  const { calls, tools } = harness();
  await tools.batch_write_values({
    spreadsheet_id: "s",
    data: [{ range: "A1", values: [["x"]] }],
  });
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    data: [{ range: "A1", values: [["x"]] }],
    valueInputOption: undefined,
  });
});

test("append_values forwards range/values/options", async () => {
  const { calls, tools } = harness();
  await tools.append_values({
    spreadsheet_id: "s",
    range: "Sheet1!A1",
    values: [["row"]],
    insert_data_option: "INSERT_ROWS",
  });
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    range: "Sheet1!A1",
    values: [["row"]],
    valueInputOption: undefined,
    insertDataOption: "INSERT_ROWS",
  });
});

test("clear_values forwards the ranges", async () => {
  const { calls, tools } = harness();
  await tools.clear_values({ spreadsheet_id: "s", ranges: ["A1:B2"] });
  assert.deepEqual(calls[0].params[0], { spreadsheetId: "s", ranges: ["A1:B2"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "appendValues" });
  const res = await tools.append_values({ spreadsheet_id: "s", range: "A1", values: [["x"]] });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
