# Google Sheets: Manage protected ranges — MCP tool

**Google Sheets MCP tool:** Manages protections that stop other editors from changing cells.

Technical name: `manage_protected_ranges`

## What task it solves

> I want to protect ranges from edits.

Manages protections that stop other editors from changing cells. action=add protects a grid range (or a named range via named_range_id; a range with only sheet_id protects the whole sheet): warning_only=true merely warns before edits, otherwise only the listed editor_users/editor_groups (emails) plus the owner may edit — note the calling user is NOT added automatically. Returns the new protectedRangeId in the replies. action=update changes description/warning_only/editors of an existing protection (protected_range_id required; provided fields replace the old values). action=delete removes the protection — the cells and data stay, but anyone with edit access can change them again. Find existing protectedRangeIds via get_spreadsheet.

## When to use it

Use this capability when you need “Manage protected ranges” without doing the same work manually in the Google Sheets interface. It runs only when an AI client calls it.

## What to provide

- `spreadsheet_id` — **required**. The spreadsheet id — the long id from the URL (docs.google.com/spreadsheets/d/<spreadsheetId>/edit) or from create_spreadsheet / search_spreadsheets output.
- `action` — **required**. What to do with the protections.
- `range` — optional. add: the cells to protect.
- `named_range_id` — optional. add: protect a named range instead of a grid range.
- `description` — optional. Label shown in the Sheets UI protections list.
- `warning_only` — optional. true = anyone can still edit after a warning; false = only the listed editors.
- `editor_users` — optional. Emails of users allowed to edit the protected cells.
- `editor_groups` — optional. Emails of Google Groups allowed to edit.
- `protected_range_id` — optional. update/delete: the protection's id from get_spreadsheet or the add reply.

## What it returns

Manages protections that stop other editors from changing cells. action=add protects a grid range (or a named range via named_range_id; a range with only sheet_id protects the whole sheet): warning_only=true merely warns before edits, otherwise only the listed editor_users/editor_groups (emails) plus the owner may edit — note the calling user is NOT added automatically. Returns the new protectedRangeId in the replies. action=update changes description/warning_only/editors of an existing protection (protected_range_id required; provided fields replace the old values). action=delete removes the protection — the cells and data stay, but anyone with edit access can change them again. Find existing protectedRangeIds via get_spreadsheet.

## What changes in Google Sheets

The call changes the live spreadsheet immediately, and some of its actions remove existing data or objects outright — removed sheets, rows, values, rules or access cannot be restored through the API. Treat every destructive action as final and double-check ids and indexes (via get_spreadsheet) before calling.

## Example request

> Manage protected ranges in Google Sheets. Ask for any required identifiers that are missing.

## Errors and limitations

The calling user is not added to the editors automatically, and `warning_only` protections still allow edits after a warning. Protections do not hide data — use manage_permissions to control who sees the file.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Set data validation](./set-data-validation.md) — `set_data_validation`
- [Manage conditional formatting](./manage-conditional-formats.md) — `manage_conditional_formats`

## Technical details

- **Impact:** destructive operation
- **Group:** Rules and protection
- **Description source:** `manage_protected_ranges` registration in `src/tools/rules.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
