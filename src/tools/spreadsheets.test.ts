import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSpreadsheetTools } from "./spreadsheets.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
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
    createSpreadsheet: make("createSpreadsheet"),
    getSpreadsheet: make("getSpreadsheet"),
    searchSpreadsheets: make("searchSpreadsheets"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSpreadsheetTools(server as never, client as never);
  return { calls, tools };
}

test("registers the three spreadsheet tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["create_spreadsheet", "get_spreadsheet", "search_spreadsheets"]);
});

test("create_spreadsheet forwards title/sheet_titles/locale/time_zone normalized", async () => {
  const { calls, tools } = harness();
  await tools.create_spreadsheet({
    title: "Budget",
    sheet_titles: ["Data", "Summary"],
    locale: "ru_RU",
    time_zone: "Europe/Moscow",
  });
  assert.equal(calls[0].method, "createSpreadsheet");
  assert.deepEqual(calls[0].params[0], {
    title: "Budget",
    sheetTitles: ["Data", "Summary"],
    locale: "ru_RU",
    timeZone: "Europe/Moscow",
  });
});

test("get_spreadsheet forwards the id and read options", async () => {
  const { calls, tools } = harness();
  await tools.get_spreadsheet({
    spreadsheet_id: "s-1",
    ranges: ["A1:B2"],
    include_grid_data: true,
    fields: "sheets.properties",
  });
  assert.equal(calls[0].method, "getSpreadsheet");
  assert.deepEqual(calls[0].params[0], {
    spreadsheetId: "s-1",
    ranges: ["A1:B2"],
    includeGridData: true,
    fields: "sheets.properties",
  });
});

test("search_spreadsheets forwards the filter and pagination", async () => {
  const { calls, tools } = harness();
  await tools.search_spreadsheets({ name_contains: "report", page_size: 5, page_token: "t", order_by: "name" });
  assert.deepEqual(calls[0].params[0], {
    nameContains: "report",
    pageSize: 5,
    pageToken: "t",
    orderBy: "name",
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "getSpreadsheet" });
  const res = await tools.get_spreadsheet({ spreadsheet_id: "s" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
