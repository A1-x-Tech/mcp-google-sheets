import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSpreadsheetTools } from "./spreadsheets.js";
import { registerValueTools } from "./values.js";
import { registerSheetTools } from "./sheets.js";
import { registerFormatTools } from "./format.js";
import { registerRuleTools } from "./rules.js";
import { registerObjectTools } from "./objects.js";
import { registerSharingTools } from "./sharing.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerSpreadsheetTools(server as never, {} as never);
  registerValueTools(server as never, {} as never);
  registerSheetTools(server as never, {} as never);
  registerFormatTools(server as never, {} as never);
  registerRuleTools(server as never, {} as never);
  registerObjectTools(server as never, {} as never);
  registerSharingTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Sheets API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  create_spreadsheet: WRITE,
  get_spreadsheet: READ_ONLY,
  search_spreadsheets: READ_ONLY,
  read_values: READ_ONLY,
  write_values: UPDATE,
  batch_write_values: UPDATE,
  append_values: WRITE,
  clear_values: DESTRUCTIVE,
  manage_sheets: DESTRUCTIVE,
  format_cells: UPDATE,
  set_frozen: UPDATE,
  set_borders: UPDATE,
  manage_dimensions: DESTRUCTIVE,
  set_data_validation: UPDATE,
  manage_protected_ranges: DESTRUCTIVE,
  manage_conditional_formats: DESTRUCTIVE,
  manage_tables: DESTRUCTIVE,
  manage_charts: DESTRUCTIVE,
  manage_permissions: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all twenty tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("the pure reads stay read-only", () => {
  for (const name of ["get_spreadsheet", "search_spreadsheets", "read_values"]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
});

test("everything that can destroy data carries destructiveHint", () => {
  for (const name of ["clear_values", "manage_sheets", "manage_dimensions", "raw_request"]) {
    assert.equal(ANN[name]?.destructiveHint, true, `${name} must be destructive`);
  }
});
