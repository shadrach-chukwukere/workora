import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { sql } from "kysely";
import { buildApp } from "../src/app.js";
import { db } from "../src/database/connection.js";
import { env, mcpResourceUrl } from "../src/config/env.js";
import { sha256 } from "../src/modules/oauth/service.js";
import { AGENT_OPERATION_NAMES } from "../src/modules/agent/operations.js";

const testEmail = `agent-test-${randomUUID()}@example.invalid`;
const testClientId = `workora-test-${randomUUID()}`;
const accessToken = `test-access-${randomUUID()}`;
let userId = "";

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

before(async () => {
  const instance = await db();
  const inserted = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('Agent Test User', ${testEmail}, 'freelancer', true)
    RETURNING id
  `.execute(instance);
  userId = inserted.rows[0]!.id;
  await sql`
    INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris)
    VALUES (${testClientId}, 'Test Agent', ${JSON.stringify(["https://example.com/callback"])})
  `.execute(instance);
  await sql`
    INSERT INTO mcp_oauth_tokens (token_hash, user_id, client_id, scopes, resource, family_id, expires_at, refresh_expires_at)
    VALUES (
      ${sha256(accessToken)}, ${userId}, ${testClientId},
      ${JSON.stringify(["profile:read", "messages:read"])}, ${mcpResourceUrl}, ${randomUUID()},
      NOW() + INTERVAL '1 hour', NOW() + INTERVAL '1 day'
    )
  `.execute(instance);
});

after(async () => {
  const instance = await db();
  await sql`DELETE FROM users WHERE id = ${userId}`.execute(instance);
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

  it("allows anonymous public reads and rejects unauthenticated private reads", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const publicResponse = await app.inject({ method: "GET", url: "/api/v1/agent/jobs?perPage=1" });
    const privateResponse = await app.inject({ method: "GET", url: "/api/v1/agent/me" });
    await app.close();
    assert.equal(publicResponse.statusCode, 200);
    assert.equal(privateResponse.statusCode, 401);
  });

  it("rejects expired, revoked and wrong-scope bearer tokens", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const wrongScope = await app.inject({
      method: "GET",
      url: "/api/v1/agent/proposals",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/agent/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    await app.close();
    assert.equal(wrongScope.statusCode, 403);
    assert.equal(wrongScope.json<{ error: { code: string } }>().error.code, "INSUFFICIENT_SCOPE");
    assert.equal(invalid.statusCode, 401);
  });
});

describe("MCP Streamable HTTP", () => {
  it("lists all tools with input/output schemas and annotations", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    assert.equal(response.statusCode, 200);
    const tools = response.json<{ result: { tools: Array<{ name: string; inputSchema: unknown; outputSchema?: unknown; annotations: unknown }> } }>().result.tools;
    assert.deepEqual(tools.map((tool) => tool.name), [...AGENT_OPERATION_NAMES]);
    for (const tool of tools) {
      assert.ok(tool.inputSchema, `${tool.name} has an input schema`);
      assert.ok(tool.outputSchema, `${tool.name} has an output schema`);
      assert.ok(tool.annotations, `${tool.name} has annotations`);
    }
  });

  it("calls a public read tool anonymously", async () => {
    const response = await mcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_jobs", arguments: { perPage: 1 } },
    });
    assert.equal(response.statusCode, 200);
    const result = response.json<{ result: { isError?: boolean; structuredContent?: { success: boolean } } }>().result;
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent?.success, true);
  });

  it("returns a 401 challenge for protected tool calls without a token", async () => {
    const response = await mcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "publish_job", arguments: { projectId: randomUUID() } },
    });
    assert.equal(response.statusCode, 401);
    assert.match(response.headers["www-authenticate"] ?? "", /resource_metadata=/);
  });

  it("enforces scope on tool calls with a valid token", async () => {
    const response = await mcp(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "publish_job", arguments: { projectId: randomUUID() } } },
      { authorization: `Bearer ${accessToken}` },
    );
    assert.equal(response.statusCode, 403);
    assert.match(response.headers["www-authenticate"] ?? "", /insufficient_scope/);
  });

  it("validates tool input without leaking stack traces", async () => {
    const response = await mcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_job_details", arguments: { projectId: "not-a-uuid" } },
    });
    assert.equal(response.statusCode, 200);
    const result = response.json<{ result: { isError: boolean; structuredContent: { error: { code: string }; message: string } } }>().result;
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "VALIDATION_ERROR");
    assert.doesNotMatch(result.structuredContent.message, /at Object|node_modules|\.ts:/);
  });

  it("blocks cross-origin browser calls", async () => {
    const response = await mcp(
      { jsonrpc: "2.0", id: 6, method: "tools/list", params: {} },
      { origin: "https://evil.example" },
    );
    assert.equal(response.statusCode, 403);
  });
});
