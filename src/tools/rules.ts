import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSheetsClient } from "../client.js";
import {
  DESTRUCTIVE,
  fail,
  gridRangeSchema,
  hexColorSchema,
  ok,
  sheetIdSchema,
  spreadsheetIdSchema,
  toGridRange,
  UPDATE,
} from "./util.js";

/**
 * A Sheets API BooleanCondition type, passed through to the wire. Kept as a
 * string (not an enum) because the vocabulary is long and still growing; the
 * description lists the common values so the model can pick without guessing.
 */
const conditionTypeSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      "Sheets API condition type, e.g. ONE_OF_LIST, ONE_OF_RANGE, NUMBER_GREATER, NUMBER_LESS, NUMBER_BETWEEN, NUMBER_EQ, TEXT_CONTAINS, TEXT_STARTS_WITH, TEXT_EQ, TEXT_IS_EMAIL, DATE_AFTER, DATE_BEFORE, DATE_BETWEEN, DATE_IS_VALID, BLANK, NOT_BLANK, BOOLEAN, CUSTOM_FORMULA.",
    );

const conditionValuesSchema = () =>
  z
    .array(z.string())
    .optional()
    .describe(
      'Condition arguments: list items for ONE_OF_LIST (["Yes","No"]), one number for NUMBER_GREATER (["100"]), two for NUMBER_BETWEEN, "=A1>B1"-style formula for CUSTOM_FORMULA and ONE_OF_RANGE ("=Sheet1!A1:A10"), relative dates as values. Omit for BLANK / NOT_BLANK / DATE_IS_VALID.',
    );

export function registerRuleTools(server: McpServer, client: GoogleSheetsClient): void {
  server.registerTool(
    "set_data_validation",
    {
      title: "Set data validation",
      annotations: UPDATE,
      description:
        "Sets — or clears — a data-validation rule on a grid range. With condition_type set, every cell in the range gets the rule: ONE_OF_LIST with condition_values plus show_custom_ui=true is the classic in-cell dropdown; ONE_OF_RANGE takes a \"=Sheet1!A1:A10\" formula; NUMBER_/TEXT_/DATE_ conditions restrict input; CUSTOM_FORMULA takes a formula evaluated per cell. strict=true rejects invalid input outright, strict=false only shows a warning; input_message is the help text shown on the cell. OMIT condition_type (and the other rule fields) to REMOVE validation from the range. Overwrites any previous rule on the range — one rule per cell.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        range: gridRangeSchema(),
        condition_type: conditionTypeSchema().optional(),
        condition_values: conditionValuesSchema(),
        input_message: z.string().optional().describe("Help text shown when the cell is selected."),
        strict: z.boolean().optional().describe("true rejects invalid input; false (default) shows a warning."),
        show_custom_ui: z
          .boolean()
          .optional()
          .describe("Show a dropdown UI for ONE_OF_LIST / ONE_OF_RANGE conditions."),
      },
    },
    async ({ spreadsheet_id, range, condition_type, condition_values, input_message, strict, show_custom_ui }) => {
      try {
        return ok(
          await client.setDataValidation({
            spreadsheetId: spreadsheet_id,
            range: toGridRange(range),
            conditionType: condition_type,
            conditionValues: condition_values,
            inputMessage: input_message,
            strict,
            showCustomUi: show_custom_ui,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "manage_protected_ranges",
    {
      title: "Manage protected ranges",
      // add/update are guard rails, but delete removes a protection outright —
      // annotate for the worst case.
      annotations: DESTRUCTIVE,
      description:
        "Manages protections that stop other editors from changing cells. action=add protects a grid range (or a named range via named_range_id; a range with only sheet_id protects the whole sheet): warning_only=true merely warns before edits, otherwise only the listed editor_users/editor_groups (emails) plus the owner may edit — note the calling user is NOT added automatically. Returns the new protectedRangeId in the replies. action=update changes description/warning_only/editors of an existing protection (protected_range_id required; provided fields replace the old values). action=delete removes the protection — the cells and data stay, but anyone with edit access can change them again. Find existing protectedRangeIds via get_spreadsheet.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["add", "update", "delete"]).describe("What to do with the protections."),
        range: gridRangeSchema().optional().describe("add: the cells to protect."),
        named_range_id: z.string().optional().describe("add: protect a named range instead of a grid range."),
        description: z.string().optional().describe("Label shown in the Sheets UI protections list."),
        warning_only: z
          .boolean()
          .optional()
          .describe("true = anyone can still edit after a warning; false = only the listed editors."),
        editor_users: z
          .array(z.string().email())
          .optional()
          .describe("Emails of users allowed to edit the protected cells."),
        editor_groups: z.array(z.string().email()).optional().describe("Emails of Google Groups allowed to edit."),
        protected_range_id: z
          .number()
          .int()
          .optional()
          .describe("update/delete: the protection's id from get_spreadsheet or the add reply."),
      },
    },
    async (args) => {
      try {
        switch (args.action) {
          case "add":
            return ok(
              await client.addProtectedRange({
                spreadsheetId: args.spreadsheet_id,
                range: args.range ? toGridRange(args.range) : undefined,
                namedRangeId: args.named_range_id,
                description: args.description,
                warningOnly: args.warning_only,
                editorUsers: args.editor_users,
                editorGroups: args.editor_groups,
              }),
            );
          case "update":
            if (args.protected_range_id === undefined) {
              return fail(new Error('action "update" requires protected_range_id.'));
            }
            return ok(
              await client.updateProtectedRange({
                spreadsheetId: args.spreadsheet_id,
                protectedRangeId: args.protected_range_id,
                description: args.description,
                warningOnly: args.warning_only,
                editorUsers: args.editor_users,
                editorGroups: args.editor_groups,
              }),
            );
          case "delete":
            if (args.protected_range_id === undefined) {
              return fail(new Error('action "delete" requires protected_range_id.'));
            }
            return ok(await client.deleteProtectedRange(args.spreadsheet_id, args.protected_range_id));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "manage_conditional_formats",
    {
      title: "Manage conditional formatting",
      annotations: DESTRUCTIVE,
      description:
        "Manages conditional-format rules that style cells when a condition holds (boolean rules; gradient color scales need raw_request). Rules are addressed by SHEET + INDEX in that sheet's rule list — get current rules and indexes from get_spreadsheet (sheets[].conditionalFormats), and re-read after every mutation because add/delete shift later indexes. action=add inserts a rule at index (default 0 = highest priority; rules are evaluated in order and the first match wins): needs ranges, condition_type (+condition_values; CUSTOM_FORMULA with a \"=...\" formula is the most flexible) and at least one format field (background_color, text_color, bold, italic). action=update replaces the ENTIRE rule at sheet_id+index with the newly provided one. action=delete removes the rule at sheet_id+index.",
      inputSchema: {
        spreadsheet_id: spreadsheetIdSchema(),
        action: z.enum(["add", "update", "delete"]).describe("What to do with the rules."),
        sheet_id: sheetIdSchema().optional().describe("update/delete: the sheet whose rule list is addressed."),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Rule position in the sheet's list. add: insert position (default 0); update/delete: required."),
        ranges: z.array(gridRangeSchema()).optional().describe("add/update: the cells the rule applies to."),
        condition_type: conditionTypeSchema().optional(),
        condition_values: conditionValuesSchema(),
        background_color: hexColorSchema().optional().describe('Fill for matching cells, "#RRGGBB".'),
        text_color: hexColorSchema().optional().describe('Text color for matching cells, "#RRGGBB".'),
        bold: z.boolean().optional().describe("Bold text for matching cells."),
        italic: z.boolean().optional().describe("Italic text for matching cells."),
      },
    },
    async (args) => {
      try {
        switch (args.action) {
          case "add":
          case "update": {
            if (!args.ranges || !args.condition_type) {
              return fail(new Error(`action "${args.action}" requires ranges and condition_type.`));
            }
            const rule = {
              ranges: args.ranges.map(toGridRange),
              conditionType: args.condition_type,
              conditionValues: args.condition_values,
              backgroundColor: args.background_color,
              textColor: args.text_color,
              bold: args.bold,
              italic: args.italic,
            };
            if (args.action === "add") {
              return ok(
                await client.addConditionalFormat({ spreadsheetId: args.spreadsheet_id, index: args.index, ...rule }),
              );
            }
            if (args.sheet_id === undefined || args.index === undefined) {
              return fail(new Error('action "update" requires sheet_id and index.'));
            }
            return ok(
              await client.updateConditionalFormat({
                spreadsheetId: args.spreadsheet_id,
                sheetId: args.sheet_id,
                index: args.index,
                ...rule,
              }),
            );
          }
          case "delete":
            if (args.sheet_id === undefined || args.index === undefined) {
              return fail(new Error('action "delete" requires sheet_id and index.'));
            }
            return ok(await client.deleteConditionalFormat(args.spreadsheet_id, args.sheet_id, args.index));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
