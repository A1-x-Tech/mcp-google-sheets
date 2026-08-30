import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { GridRangeParams } from "../client.js";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */
export const spreadsheetIdSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      "The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.",
    );

/** An A1-notation range — the addressing scheme of the values endpoints. */
export const a1RangeSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      "A1-notation range, e.g. \"Sheet1!A1:C10\", \"'My sheet'!B2:D\" (quote titles with spaces) or a bare sheet title for the whole sheet.",
    );

/** The numeric sheetId — the stable address of a tab (titles change, ids never do). */
export const sheetIdSchema = () =>
  z
    .number()
    .int()
    .min(0)
    .describe(
      "The numeric sheetId (NOT the title) from get_spreadsheet sheets[].properties.sheetId; the first sheet of a new spreadsheet is 0.",
    );

/**
 * The batchUpdate cell rectangle: 0-based, start inclusive, end exclusive; an
 * omitted edge extends to the sheet's bound. Fresh object per call (factory).
 */
export const gridRangeSchema = () =>
  z
    .object({
      sheet_id: z.number().int().min(0).describe("The numeric sheetId from get_spreadsheet (not the title)."),
      start_row_index: z.number().int().min(0).optional().describe("First row, 0-based inclusive (omit = from the top)."),
      end_row_index: z.number().int().min(0).optional().describe("End row, exclusive (omit = to the last row)."),
      start_column_index: z.number().int().min(0).optional().describe("First column, 0-based inclusive (A=0)."),
      end_column_index: z.number().int().min(0).optional().describe("End column, exclusive (omit = to the last column)."),
    })
    .describe(
      "Cell rectangle in grid coordinates: rows 1-10 × columns A-B = {start_row_index:0, end_row_index:10, start_column_index:0, end_column_index:2}.",
    );

/** The zod-inferred shape of gridRangeSchema — what tool handlers receive. */
export type GridRangeArg = z.infer<ReturnType<typeof gridRangeSchema>>;

/** Maps the snake_case grid-range argument to the client's normalized params. */
export function toGridRange(range: GridRangeArg): GridRangeParams {
  return {
    sheetId: range.sheet_id,
    startRowIndex: range.start_row_index,
    endRowIndex: range.end_row_index,
    startColumnIndex: range.start_column_index,
    endColumnIndex: range.end_column_index,
  };
}

/** A "#RRGGBB" hex color; the client converts it to the API's float RGB. */
export const hexColorSchema = () =>
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be "#RRGGBB", e.g. "#1A73E8"')
    .describe('Hex color "#RRGGBB", e.g. "#FF0000".');

/** A 2-D matrix of cell values (outer array = rows by default). */
export const valuesSchema = () =>
  z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .min(1)
    .describe(
      "2-D array of cell values, outer array = rows: [[\"Name\",\"Score\"],[\"Ada\",42]]. null leaves the existing cell untouched.",
    );

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The Sheets API mixes reads and writes, so each tool picks one of four presets:
 * READ_ONLY (pure reads), WRITE (creates new state; replaying duplicates it),
 * UPDATE (overwrites existing fields; replaying the same update converges) and
 * DESTRUCTIVE (removes existing state; replaying hits different targets).
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
