import { test } from "node:test";
import assert from "node:assert/strict";
import { registerObjectTools } from "./objects.js";

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
    addTable: make("addTable"),
    updateTable: make("updateTable"),
    deleteTable: make("deleteTable"),
    addChart: make("addChart"),
    updateChart: make("updateChart"),
    deleteChart: make("deleteChart"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerObjectTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two object tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["manage_charts", "manage_tables"]);
});

test("manage_tables routes add/update/delete with converted ranges", async () => {
  const { calls, tools } = harness();
  await tools.manage_tables({
    spreadsheet_id: "s",
    action: "add",
    name: "Tasks",
    range: { sheet_id: 0, start_row_index: 0, end_row_index: 10, start_column_index: 0, end_column_index: 3 },
    column_properties: [{ columnIndex: 0, columnName: "Task", columnType: "TEXT" }],
  });
  assert.equal(calls[0].method, "addTable");
  const add = calls[0].params[0] as Record<string, unknown>;
  assert.equal(add.name, "Tasks");
  assert.deepEqual(add.range, {
    sheetId: 0,
    startRowIndex: 0,
    endRowIndex: 10,
    startColumnIndex: 0,
    endColumnIndex: 3,
  });
  assert.deepEqual(add.columnProperties, [{ columnIndex: 0, columnName: "Task", columnType: "TEXT" }]);

  await tools.manage_tables({ spreadsheet_id: "s", action: "update", table_id: "t1", name: "Renamed" });
  assert.equal(calls[1].method, "updateTable");
  const update = calls[1].params[0] as Record<string, unknown>;
  assert.equal(update.tableId, "t1");
  assert.equal(update.name, "Renamed");
  assert.equal(update.range, undefined);

  await tools.manage_tables({ spreadsheet_id: "s", action: "delete", table_id: "t1" });
  assert.deepEqual(calls[2], { method: "deleteTable", params: ["s", "t1"] });
});

test("table actions with missing params fail without calling the client", async () => {
  const { calls, tools } = harness();
  const add = await tools.manage_tables({ spreadsheet_id: "s", action: "add", name: "NoRange" });
  assert.equal(add.isError, true);
  assert.match(add.content[0].text, /requires name and range/);
  const update = await tools.manage_tables({ spreadsheet_id: "s", action: "update", name: "x" });
  assert.equal(update.isError, true);
  assert.match(update.content[0].text, /requires table_id/);
  const del = await tools.manage_tables({ spreadsheet_id: "s", action: "delete" });
  assert.equal(del.isError, true);
  assert.equal(calls.length, 0);
});

test("manage_charts add converts ranges and the anchor", async () => {
  const { calls, tools } = harness();
  await tools.manage_charts({
    spreadsheet_id: "s",
    action: "add",
    chart_type: "COLUMN",
    title: "Sales",
    domain_range: { sheet_id: 0, start_column_index: 0, end_column_index: 1 },
    series_ranges: [{ sheet_id: 0, start_column_index: 1, end_column_index: 2 }],
    anchor: { sheet_id: 0, row_index: 5, column_index: 3 },
  });
  assert.equal(calls[0].method, "addChart");
  const add = calls[0].params[0] as Record<string, unknown>;
  assert.equal(add.chartType, "COLUMN");
  assert.equal(add.title, "Sales");
  assert.deepEqual(add.anchor, { sheetId: 0, rowIndex: 5, columnIndex: 3 });
  assert.deepEqual(add.seriesRanges, [
    { sheetId: 0, startRowIndex: undefined, endRowIndex: undefined, startColumnIndex: 1, endColumnIndex: 2 },
  ]);
});

test("manage_charts update/delete need chart_id; raw spec passes through", async () => {
  const { calls, tools } = harness();

  const update = await tools.manage_charts({ spreadsheet_id: "s", action: "update" });
  assert.equal(update.isError, true);
  assert.match(update.content[0].text, /requires chart_id/);
  const del = await tools.manage_charts({ spreadsheet_id: "s", action: "delete" });
  assert.equal(del.isError, true);
  assert.equal(calls.length, 0);

  await tools.manage_charts({
    spreadsheet_id: "s",
    action: "update",
    chart_id: 9,
    spec: { title: "Raw", histogramChart: {} },
  });
  assert.equal(calls[0].method, "updateChart");
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.chartId, 9);
  assert.deepEqual(params.spec, { title: "Raw", histogramChart: {} });

  await tools.manage_charts({ spreadsheet_id: "s", action: "delete", chart_id: 9 });
  assert.deepEqual(calls[1], { method: "deleteChart", params: ["s", 9] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "addChart" });
  const res = await tools.manage_charts({
    spreadsheet_id: "s",
    action: "add",
    chart_type: "LINE",
    series_ranges: [{ sheet_id: 0 }],
    new_sheet: true,
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
