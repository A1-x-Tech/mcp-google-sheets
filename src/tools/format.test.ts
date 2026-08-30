import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormatTools } from "./format.js";

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
    formatCells: make("formatCells"),
    setFrozen: make("setFrozen"),
    setBorders: make("setBorders"),
    resizeDimensions: make("resizeDimensions"),
    autoResizeDimensions: make("autoResizeDimensions"),
    insertDimensions: make("insertDimensions"),
    deleteDimensions: make("deleteDimensions"),
    setDimensionsHidden: make("setDimensionsHidden"),
    groupDimensions: make("groupDimensions"),
    ungroupDimensions: make("ungroupDimensions"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerFormatTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four formatting tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["format_cells", "manage_dimensions", "set_borders", "set_frozen"]);
});

test("format_cells converts the snake_case range and forwards format fields", async () => {
  const { calls, tools } = harness();
  await tools.format_cells({
    spreadsheet_id: "s",
    range: { sheet_id: 2, start_row_index: 0, end_row_index: 1 },
    background_color: "#FF0000",
    bold: true,
    number_format_type: "PERCENT",
    number_format_pattern: "0.0%",
  });
  assert.equal(calls[0].method, "formatCells");
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.deepEqual(params.range, { sheetId: 2, startRowIndex: 0, endRowIndex: 1, startColumnIndex: undefined, endColumnIndex: undefined });
  assert.equal(params.backgroundColor, "#FF0000");
  assert.equal(params.bold, true);
  assert.equal(params.numberFormatType, "PERCENT");
  assert.equal(params.numberFormatPattern, "0.0%");
});

test("set_frozen forwards the counts normalized", async () => {
  const { calls, tools } = harness();
  await tools.set_frozen({ spreadsheet_id: "s", sheet_id: 0, frozen_rows: 1, frozen_columns: 0 });
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s",
    sheetId: 0,
    frozenRowCount: 1,
    frozenColumnCount: 0,
  });
});

test("set_borders forwards sides with the converted range", async () => {
  const { calls, tools } = harness();
  await tools.set_borders({
    spreadsheet_id: "s",
    range: { sheet_id: 0, start_row_index: 0, end_row_index: 2 },
    top: { style: "SOLID", color: "#000000" },
    inner_vertical: { style: "DASHED" },
  });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.deepEqual(params.top, { style: "SOLID", color: "#000000" });
  assert.deepEqual(params.innerVertical, { style: "DASHED" });
  assert.equal(params.bottom, undefined);
});

test("manage_dimensions routes every action to the matching client method", async () => {
  const { calls, tools } = harness();
  const base = { spreadsheet_id: "s", sheet_id: 1, dimension: "ROWS", start_index: 2, end_index: 5 };
  const expected = { spreadsheetId: "s", sheetId: 1, dimension: "ROWS", startIndex: 2, endIndex: 5 };

  await tools.manage_dimensions({ ...base, action: "resize", pixel_size: 40 });
  assert.equal(calls[0].method, "resizeDimensions");
  assert.deepEqual(calls[0].params[0], { ...expected, pixelSize: 40 });

  await tools.manage_dimensions({ ...base, action: "auto_resize" });
  assert.equal(calls[1].method, "autoResizeDimensions");

  await tools.manage_dimensions({ ...base, action: "insert", inherit_from_before: true });
  assert.deepEqual(calls[2].params[0], { ...expected, inheritFromBefore: true });

  await tools.manage_dimensions({ ...base, action: "delete" });
  assert.equal(calls[3].method, "deleteDimensions");

  await tools.manage_dimensions({ ...base, action: "hide" });
  assert.deepEqual(calls[4].params[0], { ...expected, hidden: true });

  await tools.manage_dimensions({ ...base, action: "show" });
  assert.deepEqual(calls[5].params[0], { ...expected, hidden: false });

  await tools.manage_dimensions({ ...base, action: "group" });
  assert.equal(calls[6].method, "groupDimensions");

  await tools.manage_dimensions({ ...base, action: "ungroup" });
  assert.equal(calls[7].method, "ungroupDimensions");
});

test("resize without pixel_size fails without calling the client", async () => {
  const { calls, tools } = harness();
  const res = await tools.manage_dimensions({
    spreadsheet_id: "s",
    action: "resize",
    sheet_id: 0,
    dimension: "ROWS",
    start_index: 0,
    end_index: 1,
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /requires pixel_size/);
  assert.equal(calls.length, 0);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "formatCells" });
  const res = await tools.format_cells({ spreadsheet_id: "s", range: { sheet_id: 0 }, bold: true });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
