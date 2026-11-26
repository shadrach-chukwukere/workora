import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { sql } from "kysely";
import { buildApp } from "../src/app.js";
import { db } from "../src/database/connection.js";
import { mcpResourceUrl } from "../src/config/env.js";
import {
  createAuthorizationCode,
  exchangeCode,
  refreshTokens,
  redirectUriAllowed,
  revokeToken,
  sha256,
  verifyAccessToken,
  type OAuthClient,
} from "../src/modules/oauth/service.js";

const email = `oauth-flow-${randomUUID()}@example.invalid`;
const sessionToken = randomUUID();
const redirectUri = "https://claude.ai/api/mcp/auth_callback";
let userId = "";
let client: OAuthClient;

before(async () => {
  const instance = await db();
  const user = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('OAuth Flow User', ${email}, 'freelancer', true) RETURNING id
  `.execute(instance);
  userId = user.rows[0]!.id;
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${sessionToken}, NOW() + INTERVAL '1 hour')
  `.execute(instance);

  const app = await buildApp({ logger: false });
  await app.ready();
  const registered = await app.inject({
    method: "POST",
    url: "/api/v1/oauth/register",
    headers: { "content-type": "application/json" },
    payload: { client_name: "Claude Test Client", redirect_uris: [redirectUri, "http://localhost/callback"], token_endpoint_auth_method: "none" },
  });
  await app.close();
  assert.equal(registered.statusCode, 201, registered.body);
  const body = registered.json<{ client_id: string; client_name: string; redirect_uris: string[] }>();
  client = { client_id: body.client_id, client_name: body.client_name, redirect_uris: body.redirect_uris, token_endpoint_auth_method: "none", application_type: "web" };
});

after(async () => {
  const instance = await db();
  await sql`DELETE FROM users WHERE id = ${userId}`.execute(instance);
  if (client) await sql`DELETE FROM mcp_oauth_clients WHERE client_id = ${client.client_id}`.execute(instance);
});

describe("OAuth 2.1 authorization code flow", () => {
  it("matches hosted and port-agnostic loopback redirects", () => {
    assert.equal(redirectUriAllowed(client, redirectUri), true);
    assert.equal(redirectUriAllowed(client, "http://localhost:4321/callback"), true);
    assert.equal(redirectUriAllowed(client, "https://evil.example/callback"), false);
  });

  it("submits consent with a Workora session and returns a redirect with code and iss", async () => {
    const verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const challenge = sha256(verifier, "base64url");
    const state = randomUUID();
    const app = await buildApp({ logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/oauth/authorize",
      headers: { cookie: `better-auth.session_token=${sessionToken}`, "content-type": "application/json" },
      payload: {
        client_id: client.client_id,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "profile:read projects:read",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: mcpResourceUrl,
        approved: true,
      },
    });
    await app.close();
    assert.equal(response.statusCode, 200, response.body);
    const redirect = new URL(response.json<{ redirectUrl: string }>().redirectUrl);
    assert.equal(redirect.origin + redirect.pathname, redirectUri);
    assert.ok(redirect.searchParams.get("code"));
    assert.equal(redirect.searchParams.get("state"), state);
    assert.ok(redirect.searchParams.get("iss"));

    const tokens = await exchangeCode({
      code: redirect.searchParams.get("code")!,
      codeVerifier: verifier,
      clientId: client.client_id,
      redirectUri,
      resource: mcpResourceUrl,
    });
    assert.equal(tokens.token_type, "Bearer");
    assert.equal(tokens.scope, "profile:read projects:read");
    const ctx = await verifyAccessToken(tokens.access_token);
    assert.equal(ctx?.userId, userId);
    assert.equal(ctx?.clientId, client.client_id);

    // Claude sends form-encoded token requests.
    const code2 = await createAuthorizationCode({ userId, client, redirectUri, scopes: ["profile:read"], codeChallenge: challenge, resource: mcpResourceUrl });
    const app2 = await buildApp({ logger: false });
    await app2.ready();
    const form = await app2.inject({
      method: "POST",
      url: "/api/v1/oauth/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        grant_type: "authorization_code",
        code: code2,
        code_verifier: verifier,
        client_id: client.client_id,
        redirect_uri: redirectUri,
        resource: mcpResourceUrl,
      }).toString(),
    });
    await app2.close();
    assert.equal(form.statusCode, 200, form.body);
    const formTokens = form.json<{ access_token: string; refresh_token: string }>();
    assert.ok(formTokens.access_token);

    const refreshed = await refreshTokens({ refreshToken: formTokens.refresh_token, clientId: client.client_id, resource: mcpResourceUrl });
    assert.ok(refreshed.access_token);
    assert.notEqual(refreshed.refresh_token, formTokens.refresh_token);
    assert.equal(await verifyAccessToken(refreshed.access_token)?.userId, userId);
    assert.equal(await revokeToken({ token: refreshed.access_token }), true);
    assert.equal(await verifyAccessToken(refreshed.access_token), null);
  });

  it("rejects a bad PKCE verifier and an unapproved request", async () => {
    const code = await createAuthorizationCode({
      userId,
      client,
      redirectUri,
      scopes: ["profile:read"],
      codeChallenge: sha256("correct-verifier-value", "base64url"),
      resource: mcpResourceUrl,
    });
    await assert.rejects(
      exchangeCode({ code, codeVerifier: "wrong-verifier", clientId: client.client_id, redirectUri, resource: mcpResourceUrl }),
      /PKCE verification failed/,
    );
    const app = await buildApp({ logger: false });
    await app.ready();
    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/oauth/authorize",
      headers: { cookie: `better-auth.session_token=${sessionToken}`, "content-type": "application/json" },
      payload: {
        client_id: client.client_id,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "profile:read",
        state: "deny-state",
        code_challenge: sha256("another-verifier-value", "base64url"),
        code_challenge_method: "S256",
        approved: false,
      },
    });
    await app.close();
    assert.equal(denied.statusCode, 200);
    assert.equal(new URL(denied.json<{ redirectUrl: string }>().redirectUrl).searchParams.get("error"), "access_denied");
  });
});
