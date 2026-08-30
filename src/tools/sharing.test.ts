import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSharingTools } from "./sharing.js";

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
    listPermissions: make("listPermissions"),
    grantPermission: make("grantPermission"),
    updatePermission: make("updatePermission"),
    revokePermission: make("revokePermission"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSharingTools(server as never, client as never);
  return { calls, tools };
}

test("registers manage_permissions", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["manage_permissions"]);
});

test("each action routes to the matching client method", async () => {
  const { calls, tools } = harness();
  await tools.manage_permissions({ spreadsheet_id: "s", action: "list" });
  assert.deepEqual(calls[0], {
    method: "listPermissions",
    params: [{ spreadsheetId: "s", pageSize: undefined, pageToken: undefined }],
  });

  await tools.manage_permissions({ spreadsheet_id: "s", action: "list", page_size: 100, page_token: "t1" });
  assert.deepEqual(calls[1], {
    method: "listPermissions",
    params: [{ spreadsheetId: "s", pageSize: 100, pageToken: "t1" }],
  });

  await tools.manage_permissions({
    spreadsheet_id: "s",
    action: "grant",
    role: "writer",
    type: "user",
    email_address: "a@example.com",
    send_notification_email: false,
  });
  assert.equal(calls[2].method, "grantPermission");
  assert.deepEqual(calls[2].params[0], {
    spreadsheetId: "s",
    role: "writer",
    type: "user",
    emailAddress: "a@example.com",
    domain: undefined,
    allowFileDiscovery: undefined,
    sendNotificationEmail: false,
    emailMessage: undefined,
  });

  await tools.manage_permissions({ spreadsheet_id: "s", action: "update", permission_id: "p1", role: "reader" });
  assert.deepEqual(calls[3].params[0], { spreadsheetId: "s", permissionId: "p1", role: "reader" });

  await tools.manage_permissions({ spreadsheet_id: "s", action: "revoke", permission_id: "p1" });
  assert.deepEqual(calls[4], { method: "revokePermission", params: ["s", "p1"] });
});

test("missing per-action params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const grant = await tools.manage_permissions({ spreadsheet_id: "s", action: "grant" });
  assert.equal(grant.isError, true);
  assert.match(grant.content[0].text, /requires role and type/);

  const update = await tools.manage_permissions({ spreadsheet_id: "s", action: "update", role: "reader" });
  assert.equal(update.isError, true);
  assert.match(update.content[0].text, /requires permission_id and role/);

  const revoke = await tools.manage_permissions({ spreadsheet_id: "s", action: "revoke" });
  assert.equal(revoke.isError, true);
  assert.match(revoke.content[0].text, /requires permission_id/);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listPermissions" });
  const res = await tools.manage_permissions({ spreadsheet_id: "s", action: "list" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
