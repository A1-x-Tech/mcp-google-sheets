import { test } from "node:test";
import assert from "node:assert/strict";
import { registerRuleTools } from "./rules.js";

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
    setDataValidation: make("setDataValidation"),
    addProtectedRange: make("addProtectedRange"),
    updateProtectedRange: make("updateProtectedRange"),
    deleteProtectedRange: make("deleteProtectedRange"),
    addConditionalFormat: make("addConditionalFormat"),
    updateConditionalFormat: make("updateConditionalFormat"),
    deleteConditionalFormat: make("deleteConditionalFormat"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerRuleTools(server as never, client as never);
  return { calls, tools };
}

test("registers the three rule tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "manage_conditional_formats",
    "manage_protected_ranges",
    "set_data_validation",
  ]);
});

test("set_data_validation forwards the rule normalized (and clears without a condition)", async () => {
  const { calls, tools } = harness();
  await tools.set_data_validation({
    spreadsheet_id: "s",
    range: { sheet_id: 0, start_row_index: 1 },
    condition_type: "ONE_OF_LIST",
    condition_values: ["Yes", "No"],
    strict: true,
    show_custom_ui: true,
  });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.conditionType, "ONE_OF_LIST");
  assert.deepEqual(params.conditionValues, ["Yes", "No"]);
  assert.equal(params.strict, true);
  assert.equal(params.showCustomUi, true);
  assert.deepEqual(params.range, {
    sheetId: 0,
    startRowIndex: 1,
    endRowIndex: undefined,
    startColumnIndex: undefined,
    endColumnIndex: undefined,
  });

  await tools.set_data_validation({ spreadsheet_id: "s", range: { sheet_id: 0 } });
  const clear = calls[1].params[0] as Record<string, unknown>;
  assert.equal(clear.conditionType, undefined, "no condition = clear the validation");
});

test("manage_protected_ranges routes add/update/delete", async () => {
  const { calls, tools } = harness();
  await tools.manage_protected_ranges({
    spreadsheet_id: "s",
    action: "add",
    range: { sheet_id: 0, start_row_index: 0, end_row_index: 1 },
    description: "Header",
    editor_users: ["a@example.com"],
  });
  assert.equal(calls[0].method, "addProtectedRange");
  const add = calls[0].params[0] as Record<string, unknown>;
  assert.equal(add.description, "Header");
  assert.deepEqual(add.editorUsers, ["a@example.com"]);

  await tools.manage_protected_ranges({
    spreadsheet_id: "s",
    action: "update",
    protected_range_id: 7,
    warning_only: true,
  });
  assert.equal(calls[1].method, "updateProtectedRange");
  const update = calls[1].params[0] as Record<string, unknown>;
  assert.equal(update.protectedRangeId, 7);
  assert.equal(update.warningOnly, true);

  await tools.manage_protected_ranges({ spreadsheet_id: "s", action: "delete", protected_range_id: 7 });
  assert.deepEqual(calls[2], { method: "deleteProtectedRange", params: ["s", 7] });
});

test("protected-range update/delete without an id fail without calling the client", async () => {
  const { calls, tools } = harness();
  const update = await tools.manage_protected_ranges({ spreadsheet_id: "s", action: "update" });
  assert.equal(update.isError, true);
  assert.match(update.content[0].text, /requires protected_range_id/);
  const del = await tools.manage_protected_ranges({ spreadsheet_id: "s", action: "delete" });
  assert.equal(del.isError, true);
  assert.equal(calls.length, 0);
});

test("manage_conditional_formats routes add/update/delete with converted ranges", async () => {
  const { calls, tools } = harness();
  await tools.manage_conditional_formats({
    spreadsheet_id: "s",
    action: "add",
    ranges: [{ sheet_id: 0, start_row_index: 0, end_row_index: 10 }],
    condition_type: "NUMBER_GREATER",
    condition_values: ["100"],
    background_color: "#FF0000",
    index: 1,
  });
  assert.equal(calls[0].method, "addConditionalFormat");
  const add = calls[0].params[0] as Record<string, unknown>;
  assert.equal(add.index, 1);
  assert.equal(add.conditionType, "NUMBER_GREATER");
  assert.deepEqual(add.ranges, [
    { sheetId: 0, startRowIndex: 0, endRowIndex: 10, startColumnIndex: undefined, endColumnIndex: undefined },
  ]);
  assert.equal(add.backgroundColor, "#FF0000");

  await tools.manage_conditional_formats({
    spreadsheet_id: "s",
    action: "update",
    sheet_id: 2,
    index: 0,
    ranges: [{ sheet_id: 2 }],
    condition_type: "BLANK",
    bold: true,
  });
  assert.equal(calls[1].method, "updateConditionalFormat");
  const update = calls[1].params[0] as Record<string, unknown>;
  assert.equal(update.sheetId, 2);
  assert.equal(update.index, 0);

  await tools.manage_conditional_formats({ spreadsheet_id: "s", action: "delete", sheet_id: 2, index: 0 });
  assert.deepEqual(calls[2], { method: "deleteConditionalFormat", params: ["s", 2, 0] });
});

test("conditional-format actions with missing params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const add = await tools.manage_conditional_formats({ spreadsheet_id: "s", action: "add" });
  assert.equal(add.isError, true);
  assert.match(add.content[0].text, /requires ranges and condition_type/);

  const update = await tools.manage_conditional_formats({
    spreadsheet_id: "s",
    action: "update",
    ranges: [{ sheet_id: 0 }],
    condition_type: "BLANK",
  });
  assert.equal(update.isError, true);
  assert.match(update.content[0].text, /requires sheet_id and index/);

  const del = await tools.manage_conditional_formats({ spreadsheet_id: "s", action: "delete" });
  assert.equal(del.isError, true);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "setDataValidation" });
  const res = await tools.set_data_validation({ spreadsheet_id: "s", range: { sheet_id: 0 } });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
