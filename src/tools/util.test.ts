import { test } from "node:test";
import assert from "node:assert/strict";
import {
  a1RangeSchema,
  DESTRUCTIVE,
  fail,
  gridRangeSchema,
  hexColorSchema,
  ok,
  READ_ONLY,
  spreadsheetIdSchema,
  toGridRange,
  UPDATE,
  valuesSchema,
  WRITE,
} from "./util.js";

test("schema factories return independent schemas (no $ref dedup)", () => {
  assert.notEqual(spreadsheetIdSchema(), spreadsheetIdSchema());
  assert.notEqual(a1RangeSchema(), a1RangeSchema());
  assert.notEqual(gridRangeSchema(), gridRangeSchema());
  assert.notEqual(hexColorSchema(), hexColorSchema());
});

test("hexColorSchema accepts #RRGGBB and rejects junk", () => {
  const c = hexColorSchema();
  assert.equal(c.safeParse("#1A73E8").success, true);
  assert.equal(c.safeParse("#ff0000").success, true);
  assert.equal(c.safeParse("FF0000").success, false);
  assert.equal(c.safeParse("#FFF").success, false);
  assert.equal(c.safeParse("red").success, false);
});

test("valuesSchema accepts mixed cell types and rejects non-matrix input", () => {
  const v = valuesSchema();
  assert.equal(v.safeParse([["a", 1, true, null]]).success, true);
  assert.equal(v.safeParse([]).success, false, "an empty matrix writes nothing — reject it");
  assert.equal(v.safeParse(["flat"]).success, false);
  assert.equal(v.safeParse([[{ nested: true }]]).success, false);
});

test("gridRangeSchema validates and toGridRange converts to camelCase", () => {
  const parsed = gridRangeSchema().parse({ sheet_id: 3, start_row_index: 0, end_row_index: 10 });
  assert.deepEqual(toGridRange(parsed), {
    sheetId: 3,
    startRowIndex: 0,
    endRowIndex: 10,
    startColumnIndex: undefined,
    endColumnIndex: undefined,
  });
  assert.equal(gridRangeSchema().safeParse({}).success, false, "sheet_id is required");
});

test("ok emits compact JSON; fail flags isError", () => {
  assert.equal((ok({ a: 1 }).content[0] as { text: string }).text, '{"a":1}');
  const f = fail(new Error("boom"));
  assert.equal(f.isError, true);
  assert.match((f.content[0] as { text: string }).text, /boom/);
});

test("fail appends the underlying cause when present", () => {
  const err = new Error("timeout", { cause: new Error("ECONNRESET") });
  const f = fail(err);
  assert.match((f.content[0] as { text: string }).text, /timeout \(ECONNRESET\)/);
});

test("the four annotation presets set all four hints explicitly", () => {
  assert.deepEqual(READ_ONLY, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(UPDATE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(DESTRUCTIVE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});
