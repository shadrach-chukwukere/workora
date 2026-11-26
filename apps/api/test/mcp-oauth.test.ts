import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  authorizationServerMetadata,
  cimdSupportsPublicClient,
  isValidRedirectUri,
  protectedResourceMetadata,
} from "../src/modules/oauth/service.js";
import { hasScope, isMcpScope, parseScopes } from "../src/modules/oauth/scopes.js";
import { issueConfirmation, verifyConfirmation } from "../src/modules/mcp/confirmation.js";
import { buildMcpServer, MCP_TOOL_NAMES } from "../src/modules/mcp/server.js";
import { mcpResourceUrl } from "../src/config/env.js";

test("OAuth scopes are validated and granted scopes are enforced", () => {
  assert.equal(parseScopes("projects:read jobs:write projects:read").length, 2);
  assert.equal(isMcpScope("messages:read"), true);
  assert.equal(isMcpScope("payments:write"), false);
  assert.equal(hasScope(["projects:read"], "projects:read"), true);
  assert.equal(hasScope(["projects:read"], "jobs:write"), false);
  assert.throws(() => parseScopes("projects:read payments:write"));
});

test("discovery metadata advertises the Workora resource and authorization server", () => {
  const as = authorizationServerMetadata();
  const prm = protectedResourceMetadata();
  assert.equal(as.code_challenge_methods_supported[0], "S256");
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal(as.client_id_metadata_document_supported, true);
  assert.equal(prm.resource, mcpResourceUrl);
  assert.equal(prm.authorization_servers[0], as.issuer);
  assert.ok(prm.scopes_supported.includes("jobs:write"));
});

test("CIMD accepts clients that advertise public PKCE support", () => {
  assert.equal(cimdSupportsPublicClient({ token_endpoint_auth_method: "none" }), true);
  assert.equal(
    cimdSupportsPublicClient({
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
    }),
    true,
  );
  assert.equal(
    cimdSupportsPublicClient({
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
    }),
    false,
  );
});

test("redirect URI validation allows https and loopback only", () => {
  assert.equal(isValidRedirectUri("https://chat.example.com/oauth/callback"), true);
  assert.equal(isValidRedirectUri("http://127.0.0.1:8090/callback"), true);
  assert.equal(isValidRedirectUri("http://evil.example.com/callback"), false);
  assert.equal(isValidRedirectUri("javascript:alert(1)"), false);
});

test("confirmation tokens are bound to user and exact parameters", () => {
  const params = { projectId: "11111111-1111-4111-8111-111111111111" };
  const token = issueConfirmation("publish_job", "user-1", params);
  assert.equal(verifyConfirmation(token, "publish_job", "user-1", params), true);
  assert.equal(verifyConfirmation(token, "publish_job", "user-2", params), false);
  assert.equal(verifyConfirmation(token, "invite_freelancer", "user-1", params), false);
  assert.equal(verifyConfirmation(token, "publish_job", "user-1", { projectId: "other" }), false);
  assert.equal(verifyConfirmation(`${token.slice(0, -1)}x`, "publish_job", "user-1", params), false);
});

test("MCP server advertises all tools and reports invalid input safely", async () => {
  const server = buildMcpServer(null);
  const client = new Client({ name: "workora-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const listed = await client.listTools();
  assert.deepEqual(
    [...listed.tools.map((tool) => tool.name)].sort(),
    [...MCP_TOOL_NAMES].sort(),
  );

  const invalid = await client.callTool({ name: "search_jobs", arguments: { page: 0 } });
  assert.equal(invalid.isError, true);

  const unauthenticated = await client.callTool({ name: "get_my_profile", arguments: {} });
  assert.equal(unauthenticated.isError, true);

  await client.close();
  await server.close();
});
