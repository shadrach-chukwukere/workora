import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { sql } from "kysely";
import { buildApp } from "../src/app.js";
import { db } from "../src/database/connection.js";
import { env, mcpResourceUrl } from "../src/config/env.js";
import { MCP_SCOPES } from "../src/modules/oauth/scopes.js";
import { sha256 } from "../src/modules/oauth/service.js";
import { AGENT_OPERATION_NAMES } from "../src/modules/agent/operations.js";

const testEmail = `agent-test-${randomUUID()}@example.invalid`;
const otherEmail = `agent-other-${randomUUID()}@example.invalid`;
const testClientId = `workora-test-${randomUUID()}`;
const accessToken = `test-access-${randomUUID()}`;
const fullToken = `test-full-${randomUUID()}`;
const expiredToken = `test-expired-${randomUUID()}`;
const revokedToken = `test-revoked-${randomUUID()}`;
let userId = "";
let otherUserId = "";
let conversationId = "";

async function mcp(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const app = await buildApp({ logger: false });
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/mcp",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
      ...headers,
    },
    payload: body,
  });
  await app.close();
  return response;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

before(async () => {
  const instance = await db();
  const inserted = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('Agent Test User', ${testEmail}, 'freelancer', true) RETURNING id
  `.execute(instance);
  userId = inserted.rows[0]!.id;
  const other = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('Agent Other User', ${otherEmail}, 'client', true) RETURNING id
  `.execute(instance);
  otherUserId = other.rows[0]!.id;
  await sql`
    INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris)
    VALUES (${testClientId}, 'Test Agent', ${JSON.stringify(["https://example.com/callback"])})
  `.execute(instance);
  for (const [token, scopes, expires, revoked] of [
    [accessToken, ["profile:read", "messages:read"], "NOW() + INTERVAL '1 hour'", "NULL"],
    [fullToken, [...MCP_SCOPES], "NOW() + INTERVAL '1 hour'", "NULL"],
    [expiredToken, [...MCP_SCOPES], "NOW() - INTERVAL '1 hour'", "NULL"],
    [revokedToken, [...MCP_SCOPES], "NOW() + INTERVAL '1 hour'", "NOW()"],
  ] as const) {
    await sql`
      INSERT INTO mcp_oauth_tokens (token_hash, user_id, client_id, scopes, resource, family_id, expires_at, refresh_expires_at, revoked_at)
      VALUES (
        ${sha256(token)}, ${userId}, ${testClientId}, ${JSON.stringify(scopes)}, ${mcpResourceUrl}, ${randomUUID()},
        ${sql.raw(expires)}, ${sql.raw("NOW() + INTERVAL '1 day'")}, ${sql.raw(revoked)}
      )
    `.execute(instance);
  }
  // A conversation owned by a different user: user A must never read it.
  const conversation = await sql<{ id: string }>`
    INSERT INTO conversations (kind) VALUES ('direct') RETURNING id
  `.execute(instance);
  conversationId = conversation.rows[0]!.id;
  await sql`
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (${conversationId}, ${otherUserId})
  `.execute(instance);
});

after(async () => {
  const instance = await db();
  await sql`DELETE FROM users WHERE id IN (${userId}, ${otherUserId})`.execute(instance);
  await sql`DELETE FROM mcp_oauth_clients WHERE client_id = ${testClientId}`.execute(instance);
  await sql`DELETE FROM agent_idempotency WHERE user_id = ${userId}`.execute(instance);
});

describe("agent REST surface", () => {
  it("serves a valid OpenAPI 3.1 document generated from shared schemas", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/v1/openapi.json" });
    await app.close();
    assert.equal(response.statusCode, 200);
    const doc = response.json<{ openapi: string; paths: Record<string, unknown>; components: { securitySchemes: unknown } }>();
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.paths["/agent/jobs"]);
    assert.ok(doc.paths["/agent/messages"]);
    assert.ok(doc.components.securitySchemes);
  });

  it("advertises correct OAuth 2.1 discovery metadata", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const as = (await app.inject({ method: "GET", url: "/api/v1/oauth/metadata" })).json<{
      issuer: string;
      token_endpoint: string;
      code_challenge_methods_supported: string[];
      client_id_metadata_document_supported: boolean;
    }>();
    const rs = (await app.inject({ method: "GET", url: "/api/v1/oauth/protected-resource" })).json<{
      resource: string;
      authorization_servers: string[];
    }>();
    await app.close();
    assert.equal(as.issuer, env.WEB_APP_URL);
    assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
    assert.equal(as.client_id_metadata_document_supported, true);
    assert.equal(rs.resource, `${env.WEB_APP_URL}/api/mcp`);
    assert.deepEqual(rs.authorization_servers, [env.WEB_APP_URL]);
  });

  it("rejects every unauthenticated agent REST call", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const publicRead = await app.inject({ method: "GET", url: "/api/v1/agent/jobs?perPage=1" });
    const privateRead = await app.inject({ method: "GET", url: "/api/v1/agent/me" });
    const write = await app.inject({ method: "POST", url: "/api/v1/agent/messages", payload: {} });
    await app.close();
    for (const response of [publicRead, privateRead, write]) assert.equal(response.statusCode, 401);
  });

  it("lets an authenticated user execute a permitted read", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/v1/agent/jobs?perPage=1", headers: auth(fullToken) });
    await app.close();
    assert.equal(response.statusCode, 200);
    assert.equal(response.json<{ success: boolean }>().success, true);
  });

  it("rejects expired, revoked, invalid and wrong-scope tokens", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    for (const token of [expiredToken, revokedToken, "not-a-real-token"]) {
      const response = await app.inject({ method: "GET", url: "/api/v1/agent/me", headers: auth(token) });
      assert.equal(response.statusCode, 401, token);
    }
    const wrongScope = await app.inject({ method: "GET", url: "/api/v1/agent/proposals", headers: auth(accessToken) });
    await app.close();
    assert.equal(wrongScope.statusCode, 403);
    assert.equal(wrongScope.json<{ error: { code: string } }>().error.code, "INSUFFICIENT_SCOPE");
  });

  it("prevents user A from reading user B's private conversation", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/agent/messages/${conversationId}`,
      headers: auth(fullToken),
    });
    await app.close();
    assert.equal(response.statusCode, 403);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "FORBIDDEN");
  });

  it("rejects a role-restricted operation for a freelancer token", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/v1/agent/projects", headers: auth(fullToken) });
    await app.close();
    assert.equal(response.statusCode, 403);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "FORBIDDEN");
  });
});

describe("MCP Streamable HTTP", () => {
  it("requires a token before protocol negotiation", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    assert.equal(response.statusCode, 401);
    assert.match(response.headers["www-authenticate"] ?? "", /resource_metadata=/);
  });

  it("lists all tools with input/output schemas and annotations", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, auth(fullToken));
    assert.equal(response.statusCode, 200);
    const tools = response.json<{ result: { tools: Array<{ name: string; inputSchema: unknown; outputSchema?: unknown; annotations: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean } }> } }>().result.tools;
    assert.deepEqual(tools.map((tool) => tool.name), [...AGENT_OPERATION_NAMES]);
    for (const tool of tools) {
      assert.ok(tool.name.length <= 64);
      assert.ok(tool.inputSchema, `${tool.name} has an input schema`);
      assert.ok(tool.outputSchema, `${tool.name} has an output schema`);
      assert.ok(tool.annotations.title, `${tool.name} has a title`);
      assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
      assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    }
  });

  it("executes a read tool for an authenticated user", async () => {
    const response = await mcp(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_jobs", arguments: { perPage: 1 } } },
      auth(fullToken),
    );
    assert.equal(response.statusCode, 200);
    const result = response.json<{ result: { isError?: boolean; structuredContent?: { success: boolean } } }>().result;
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent?.success, true);
  });

  it("returns a 401 challenge for tool calls with no token and 403 for wrong scope", async () => {
    const noToken = await mcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "publish_job", arguments: { projectId: randomUUID() } },
    });
    assert.equal(noToken.statusCode, 401);
    const wrongScope = await mcp(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "publish_job", arguments: { projectId: randomUUID() } } },
      auth(accessToken),
    );
    assert.equal(wrongScope.statusCode, 403);
    assert.match(wrongScope.headers["www-authenticate"] ?? "", /insufficient_scope/);
  });

  it("validates tool input without leaking stack traces", async () => {
    const response = await mcp(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_job_details", arguments: { projectId: "bad" } } },
      auth(fullToken),
    );
    assert.equal(response.statusCode, 200);
    const result = response.json<{
      result: { isError: boolean; structuredContent?: { message?: string }; content: Array<{ text: string }> };
    }>().result;
    assert.equal(result.isError, true);
    const text = result.structuredContent?.message ?? result.content[0]?.text ?? "";
    assert.match(text, /valid|uuid|required/i);
    assert.doesNotMatch(text, /at Object|node_modules|\.ts:/);
  });

  it("blocks cross-origin browser calls", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 6, method: "tools/list", params: {} }, { origin: "https://evil.example" });
    assert.equal(response.statusCode, 403);
  });
});
