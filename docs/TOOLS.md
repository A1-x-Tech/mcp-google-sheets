# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Google Sheets API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
deletes are destructive. Inputs use a normalized snake_case vocabulary; the
client maps them to the API's wire shapes (GridRange, CellFormat + fields masks,
`{red,green,blue}` colors from `#RRGGBB` hex) and handles OAuth entirely on its
own.

Two addressing schemes coexist and never mix:

- **Values tools** take **A1 notation** (`'Sheet name'!A1:C10`).
- **Structural tools** (sheets, formatting, rules, tables, charts) take the
  numeric **sheetId** plus 0-based half-open row/column indexes
  (`start` inclusive, `end` exclusive; omitted edge = to the sheet's bound).
  Get sheetIds from `get_spreadsheet` — titles are not addresses.

`spreadsheet_id` is the long id from the URL
(`docs.google.com/spreadsheets/d/<spreadsheetId>/edit`) or from
`create_spreadsheet` / `search_spreadsheets` output.

## Spreadsheets

| Tool | Description |
|---|---|
| `create_spreadsheet` | Creates a spreadsheet (`title`, optional `sheet_titles[]`, `locale`, `time_zone`). Returns `spreadsheetId`, `spreadsheetUrl` and `sheets[]` with their sheetIds. The file lands in My Drive root — moving it needs the Drive API (not covered). |
| `get_spreadsheet` | Structure and ids: properties, `sheets[].properties` (sheetId, title, index, gridProperties incl. frozen counts), per-sheet `protectedRanges` / `conditionalFormats` / `tables` / `charts`, `namedRanges`. `include_grid_data` embeds cells (heavy — prefer `read_values`); `fields` trims the payload. |
| `search_spreadsheets` | Drive-backed search by name substring (`name_contains`), newest-modified first, with pagination. **Needs a Drive scope** — 403 with only the spreadsheets scope. |

## Values

| Tool | Description |
|---|---|
| `read_values` | `values:batchGet` over one or more A1 ranges in one call. `value_render_option`: `FORMATTED_VALUE` (default) / `UNFORMATTED_VALUE` / `FORMULA` (reads formulas). `major_dimension`, `date_time_render_option` pass through. Trailing empty rows/cols are omitted. |
| `write_values` | `values.update` (PUT) on one A1 range. `value_input_option`: `USER_ENTERED` (default; parses `=formulas`, numbers, dates per locale) / `RAW`. `null` skips a cell, it does not clear it. |
| `batch_write_values` | `values:batchUpdate` — several `{range, values}` pairs in one call, one quota unit. Prefer over looping `write_values`. |
| `append_values` | `values:append` — appends rows after the last data row of the table containing `range`. `insert_data_option`: `OVERWRITE` / `INSERT_ROWS`. Never retried after ambiguous failures (would duplicate rows). |
| `clear_values` | `values:batchClear` — empties values/formulas of the ranges. Formatting, validation, notes and merges stay. No undo. |

## Sheets (tabs)

| Tool | Description |
|---|---|
| `manage_sheets` | `action`: `add` (title, optional index/row_count/column_count), `duplicate`, `rename`, `delete` (irreversible; fails on the last sheet), `copy_to` (into another spreadsheet; arrives as "Copy of …"). All addressed by `sheet_id`. |

## Formatting and layout

| Tool | Description |
|---|---|
| `format_cells` | `repeatCell` with a computed fields mask: background/text color (hex), bold/italic/strikethrough/underline, font size/family, alignments, wrap strategy, number format (type + pattern). Only provided fields change. |
| `set_frozen` | `updateSheetProperties` on `gridProperties.frozenRowCount` / `frozenColumnCount` (0 unfreezes). |
| `set_borders` | `updateBorders`: outer sides + inner grid lines, styles `SOLID`/`SOLID_MEDIUM`/`SOLID_THICK`/`DOTTED`/`DASHED`/`DOUBLE`/`NONE`, hex colors. |
| `manage_dimensions` | Rows/columns runs (`dimension` + `start_index`/`end_index`): `resize` (pixel_size), `auto_resize`, `insert` (`inherit_from_before`), `delete` (destroys data), `hide`/`show`, `group`/`ungroup` (collapsible outline groups, nestable). |

## Rules and protection

| Tool | Description |
|---|---|
| `set_data_validation` | `setDataValidation` on a range: `condition_type` (wire ConditionType string, e.g. `ONE_OF_LIST`, `NUMBER_BETWEEN`, `CUSTOM_FORMULA`) + `condition_values`, `strict`, `show_custom_ui` (dropdown), `input_message`. Omit the condition to **clear** validation. |
| `manage_protected_ranges` | `action`: `add` (range or `named_range_id`; `warning_only` or `editor_users`/`editor_groups`), `update` (computed fields mask), `delete`. Ids from `get_spreadsheet` or the add reply. |
| `manage_conditional_formats` | Boolean rules (`condition_type` + format: background/text color, bold, italic) addressed by **per-sheet index**; `add` (at `index`, default 0), `update` (replaces the whole rule), `delete`. Indexes shift on every mutation — re-read `get_spreadsheet`. Gradient rules → `raw_request`. |

## Tables and charts

| Tool | Description |
|---|---|
| `manage_tables` | Structured tables: `add` (name + range, first row = header, optional raw `column_properties`), `update` (rename/re-range by `table_id`), `delete` (removes the definition, keeps the data). |
| `manage_charts` | Embedded charts: `add` builds a spec from `chart_type` (`COLUMN`/`BAR`/`LINE`/`AREA`/`STEPPED_AREA`/`SCATTER`/`PIE`) + `domain_range` + `series_ranges`, placed via `anchor` or `new_sheet`; or pass a raw `spec` for any chart kind. `update` replaces the whole spec (`chart_id`); `delete` removes the chart. |

## Sharing

| Tool | Description |
|---|---|
| `manage_permissions` | Drive permissions on the file (**needs a Drive scope**): `list` (paged — follow `nextPageToken` via `page_token`), `grant` (role `reader`/`commenter`/`writer` to `user`/`group`/`domain`/`anyone`), `update` (role by `permission_id`), `revoke`. Ownership transfer is not supported. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Calls any Sheets API v4 path directly (`GET`/`POST`/`PUT`, default GET) — e.g. a `batchUpdate` with `mergeCells`, named ranges, banding, basic filters, slicers, `sortRange`, `findReplace`, gradient rules, developer metadata, or several requests in one atomic call. A path resolving to a foreign origin (including Drive) is rejected (SSRF guard), so the Bearer token never leaves `sheets.googleapis.com`. |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate it (append) or re-apply it (batchUpdate).
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401.
- **Scopes:** `https://www.googleapis.com/auth/spreadsheets` covers every Sheets tool;
  `search_spreadsheets` and `manage_permissions` additionally need a Drive scope
  (`drive`, or `drive.readonly` for search only, or `drive.file` for app-created files).
- **Quotas:** per minute — 300 reads + 300 writes per project, 60 each per user. A batch
  call counts once regardless of how many ranges/requests it carries.
- **Limits:** 10,000,000 cells per spreadsheet; `batchUpdate` requests in one call are
  applied atomically (all or none).

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_SHEETS_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_SHEETS_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_SHEETS_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_SHEETS_ACCESS_TOKEN` | yes* | — | Alternative: static access token (~1 h lifetime). Secret. |
| `GOOGLE_SHEETS_API_BASE` | no | `https://sheets.googleapis.com` | Sheets API root override. |
| `GOOGLE_SHEETS_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_SHEETS_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the refresh triple together, or the static access token.
