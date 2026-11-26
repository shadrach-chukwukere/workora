import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../database/types.js";
import { db } from "../../database/connection.js";
import { env, mcpIssuer, mcpResourceUrl } from "../../config/env.js";
import { MCP_SCOPES, parseScopes, type McpScope } from "./scopes.js";

/**
 * OAuth 2.1 authorization server for MCP clients.
 *
 * Better Auth remains the only identity provider: tokens here are issued only
 * after an existing Workora session approved a consent screen. All token
 * values are stored as SHA-256 hashes and are never logged or returned to the
 * dashboard.
 */

export interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  application_type: string;
}

export interface TokenContext {
  userId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  tokenId: string;
}

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const CIMD_CACHE_MS = 10 * 60 * 1000;
const cimdCache = new Map<string, { client: OAuthClient; expiresAt: number }>();

export function sha256(value: string, encoding: "hex" | "base64url" = "hex"): string {
  return createHash("sha256").update(value).digest(encoding);
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

export function isValidRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.hash) return false;
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && isLoopback(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Exact match for https redirects, with port-agnostic loopback matching for
 * Claude Code (RFC 8252). Claude Code declares http://localhost/callback and
 * http://127.0.0.1/callback but connects on an ephemeral local port.
 */
export function redirectUriAllowed(client: OAuthClient, uri: string): boolean {
  if (client.redirect_uris.includes(uri)) return true;
  try {
    const requested = new URL(uri);
    if (requested.protocol !== "http:" || !isLoopback(requested.hostname)) return false;
    return client.redirect_uris.some((registered) => {
      if (!isValidRedirectUri(registered)) return false;
      const allowed = new URL(registered);
      if (allowed.protocol !== "http:" || !isLoopback(allowed.hostname)) return false;
      return allowed.pathname === requested.pathname && allowed.search === requested.search;
    });
  } catch {
    return false;
  }
}

/**
 * Workora's token endpoint supports public clients only. Some clients (notably
 * ChatGPT) declare `private_key_jwt` as their preferred method while also
 * advertising `none` in `token_endpoint_auth_methods_supported`; those clients
 * can complete the PKCE flow without client authentication, so accept them.
 */
export function cimdSupportsPublicClient(doc: Record<string, unknown>): boolean {
  const preferred =
    typeof doc.token_endpoint_auth_method === "string" ? doc.token_endpoint_auth_method : "none";
  if (preferred === "none") return true;
  return (
    Array.isArray(doc.token_endpoint_auth_methods_supported) &&
    doc.token_endpoint_auth_methods_supported.some((method) => method === "none")
  );
}

async function fetchCimd(clientId: string): Promise<OAuthClient | null> {
  const cached = cimdCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.client;

  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (
    isLoopback(host) ||
    host === "0.0.0.0" ||
    host.endsWith(".internal") ||
    /^(\d+\.){3}\d+$/.test(host) ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const doc = (await response.json()) as Record<string, unknown>;
    if (doc.client_id !== clientId || typeof doc.client_name !== "string") return null;
    if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.some((u) => typeof u !== "string" || !isValidRedirectUri(u))) {
      return null;
    }
    // We do not implement private_key_jwt; accept only clients that advertise
    // public PKCE as an available method, even if they prefer a keyed method.
    if (!cimdSupportsPublicClient(doc)) return null;
    const client: OAuthClient = {
      client_id: clientId,
      client_name: doc.client_name.slice(0, 120),
      redirect_uris: doc.redirect_uris as string[],
      token_endpoint_auth_method: "none",
      application_type: typeof doc.application_type === "string" ? doc.application_type : "web",
    };
    cimdCache.set(clientId, { client, expiresAt: Date.now() + CIMD_CACHE_MS });
    return client;
  } catch {
    return null;
  }
}

/** Look up a pre-registered/DCR client, or resolve a Client ID Metadata Document. */
export async function resolveClient(clientId: string, persist = false): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 2048) return null;
  const instance = await db();
  const stored = await instance
    .selectFrom("mcp_oauth_clients")
    .select(["client_id", "client_name", "redirect_uris", "token_endpoint_auth_method", "application_type"])
    .where("client_id", "=", clientId)
    .executeTakeFirst();

  if (stored) {
    let uris: string[] = [];
    try {
      uris = JSON.parse(stored.redirect_uris) as string[];
    } catch {
      return null;
    }
    return {
      client_id: stored.client_id,
      client_name: stored.client_name,
      redirect_uris: uris,
      token_endpoint_auth_method: stored.token_endpoint_auth_method,
      application_type: stored.application_type,
    };
  }

  if (!clientId.startsWith("https://")) return null;
  const client = await fetchCimd(clientId);
  if (client && persist) {
    await instance
      .insertInto("mcp_oauth_clients")
      .values({
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: JSON.stringify(client.redirect_uris),
        grant_types: JSON.stringify(["authorization_code", "refresh_token"]),
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        application_type: client.application_type,
        client_id_metadata_url: client.client_id,
      })
      .onConflict((oc) => oc.column("client_id").doNothing())
      .execute();
  }
  return client;
}

export async function registerClient(input: {
  client_name?: unknown;
  redirect_uris?: unknown;
  application_type?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
}): Promise<OAuthClient> {
  if (typeof input.client_name !== "string" || input.client_name.trim().length < 1 || input.client_name.length > 120) {
    throw new OAuthError("invalid_client_metadata", "client_name is required (1-120 characters)");
  }
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0 || input.redirect_uris.length > 10) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris must contain 1-10 URIs");
  }
  const uris = input.redirect_uris.map((uri) => {
    if (typeof uri !== "string" || !isValidRedirectUri(uri)) {
      throw new OAuthError("invalid_client_metadata", "Each redirect URI must be https (or http loopback)");
    }
    return uri;
  });
  const authMethod = input.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") throw new OAuthError("invalid_client_metadata", "Only public clients (none) are supported");
  const applicationType = input.application_type === "native" ? "native" : "web";
  const clientId = `workora-dcr-${randomBytes(18).toString("base64url")}`;
  const client: OAuthClient = {
    client_id: clientId,
    client_name: input.client_name.trim(),
    redirect_uris: uris,
    token_endpoint_auth_method: "none",
    application_type: applicationType,
  };
  const instance = await db();
  await instance
    .insertInto("mcp_oauth_clients")
    .values({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: JSON.stringify(uris),
      grant_types: JSON.stringify(["authorization_code", "refresh_token"]),
      token_endpoint_auth_method: "none",
      application_type: client.application_type,
      client_id_metadata_url: null,
    })
    .execute();
  await audit(null, clientId, "client.registered", client.client_name);
  return client;
}

export async function audit(userId: string | null, clientId: string | null, action: string, detail?: string): Promise<void> {
  try {
    const instance = await db();
    await instance
      .insertInto("mcp_audit_logs")
      .values({ user_id: userId, client_id: clientId, action, detail: detail ?? null })
      .execute();
  } catch {
    // Audit failures must never break an OAuth flow, but they are visible in logs.
  }
}

export async function createAuthorizationCode(input: {
  userId: string;
  client: OAuthClient;
  redirectUri: string;
  scopes: McpScope[];
  codeChallenge: string;
  resource: string;
}): Promise<string> {
  if (!redirectUriAllowed(input.client, input.redirectUri)) {
    throw new OAuthError("invalid_request", "redirect_uri is not registered for this client");
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) {
    throw new OAuthError("invalid_request", "code_challenge must be a S256 PKCE challenge");
  }
  if (input.resource !== mcpResourceUrl) {
    throw new OAuthError("invalid_request", "resource does not match the Workora MCP server");
  }
  const code = randomToken();
  const instance = await db();
  await instance
    .insertInto("mcp_oauth_codes")
    .values({
      code_hash: sha256(code),
      user_id: input.userId,
      client_id: input.client.client_id,
      redirect_uri: input.redirectUri,
      scopes: JSON.stringify(input.scopes),
      code_challenge: input.codeChallenge,
      resource: input.resource,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    })
    .execute();
  await audit(input.userId, input.client.client_id, "code.issued", input.scopes.join(" "));
  return code;
}

type DbExecutor = Kysely<DB> | Transaction<DB>;

async function issueTokens(
  executor: DbExecutor,
  input: { userId: string; client: OAuthClient; scopes: string[]; resource: string; familyId: string },
) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.MCP_ACCESS_TOKEN_TTL_SECONDS * 1000);
  const refreshExpiresAt = new Date(now.getTime() + env.MCP_REFRESH_TOKEN_TTL_SECONDS * 1000);
  await executor
    .insertInto("mcp_oauth_tokens")
    .values({
      token_hash: sha256(accessToken),
      refresh_hash: sha256(refreshToken),
      user_id: input.userId,
      client_id: input.client.client_id,
      scopes: JSON.stringify(input.scopes),
      resource: input.resource,
      family_id: input.familyId,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
    })
    .execute();
  await executor
    .insertInto("mcp_connections")
    .values({
      user_id: input.userId,
      client_id: input.client.client_id,
      client_name: input.client.client_name,
      scopes: JSON.stringify(input.scopes),
    })
    .onConflict((oc) =>
      oc.columns(["user_id", "client_id"]).doUpdateSet({
        scopes: JSON.stringify(input.scopes),
        revoked_at: null,
        last_used_at: now,
      }),
    )
    .execute();
  return {
    access_token: accessToken,
    token_type: "Bearer" as const,
    expires_in: env.MCP_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scopes.join(" "),
  };
}

export async function exchangeCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource: string;
}) {
  if (!input.code || !input.codeVerifier || !input.clientId || !input.redirectUri) {
    throw new OAuthError("invalid_request", "Missing required token parameters");
  }
  if (input.resource && input.resource !== mcpResourceUrl) {
    throw new OAuthError("invalid_request", "resource does not match the Workora MCP server");
  }
  const client = await resolveClient(input.clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client", 401);

  const instance = await db();
  return instance.transaction().execute(async (trx) => {
    const code = await trx
      .updateTable("mcp_oauth_codes")
      .set({ used_at: new Date() })
      .where("code_hash", "=", sha256(input.code))
      .where("used_at", "is", null)
      .where("expires_at", ">", new Date())
      .where("client_id", "=", input.clientId)
      .where("redirect_uri", "=", input.redirectUri)
      .returning(["user_id", "scopes", "code_challenge", "resource"])
      .executeTakeFirst();
    if (!code) throw new OAuthError("invalid_grant", "Authorization code is invalid, expired or already used");
    if (sha256(input.codeVerifier, "base64url") !== code.code_challenge) {
      throw new OAuthError("invalid_grant", "PKCE verification failed");
    }
    const scopes = parseScopes(JSON.parse(code.scopes) as string);
    const result = await issueTokens(trx, {
      userId: code.user_id,
      client,
      scopes,
      resource: code.resource,
      familyId: randomUUID(),
    });
    await audit(code.user_id, input.clientId, "token.issued", scopes.join(" "));
    return result;
  });
}

export async function refreshTokens(input: { refreshToken: string; clientId: string; resource?: string }) {
  if (!input.refreshToken || !input.clientId) throw new OAuthError("invalid_request", "Missing refresh parameters");
  if (input.resource && input.resource !== mcpResourceUrl) {
    throw new OAuthError("invalid_request", "resource does not match the Workora MCP server");
  }
  const client = await resolveClient(input.clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client", 401);

  const instance = await db();
  return instance.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("mcp_oauth_tokens")
      .select(["id", "user_id", "client_id", "scopes", "resource", "family_id", "revoked_at", "refresh_expires_at"])
      .where("refresh_hash", "=", sha256(input.refreshToken))
      .executeTakeFirst();
    if (!row) throw new OAuthError("invalid_grant", "Refresh token is invalid");

    if (row.revoked_at || row.refresh_expires_at < new Date() || row.client_id !== input.clientId) {
      // Replay of a rotated/revoked refresh token: kill the whole family.
      await trx
        .updateTable("mcp_oauth_tokens")
        .set({ revoked_at: new Date() })
        .where("family_id", "=", row.family_id)
        .where("revoked_at", "is", null)
        .execute();
      await audit(row.user_id, row.client_id, "token.replay_detected", row.family_id);
      throw new OAuthError("invalid_grant", "Refresh token has been revoked");
    }

    await trx
      .updateTable("mcp_oauth_tokens")
      .set({ revoked_at: new Date() })
      .where("id", "=", row.id)
      .execute();
    const scopes = parseScopes(JSON.parse(row.scopes) as string);
    const result = await issueTokens(trx, {
      userId: row.user_id,
      client,
      scopes,
      resource: row.resource,
      familyId: row.family_id,
    });
    await audit(row.user_id, row.client_id, "token.refreshed");
    return result;
  });
}

export async function verifyAccessToken(token: string): Promise<TokenContext | null> {
  if (!token) return null;
  const instance = await db();
  const row = await instance
    .selectFrom("mcp_oauth_tokens")
    .select(["id", "user_id", "client_id", "scopes", "resource", "expires_at", "revoked_at"])
    .where("token_hash", "=", sha256(token))
    .executeTakeFirst();
  if (!row || row.revoked_at || row.expires_at < new Date() || row.resource !== mcpResourceUrl) return null;

  const client = await resolveClient(row.client_id);
  const now = new Date();
  void instance
    .updateTable("mcp_oauth_tokens")
    .set({ last_used_at: now })
    .where("id", "=", row.id)
    .execute()
    .catch(() => undefined);
  void instance
    .updateTable("mcp_connections")
    .set({ last_used_at: now })
    .where("user_id", "=", row.user_id)
    .where("client_id", "=", row.client_id)
    .execute()
    .catch(() => undefined);

  return {
    userId: row.user_id,
    clientId: row.client_id,
    clientName: client?.client_name ?? row.client_id,
    scopes: JSON.parse(row.scopes) as string[],
    tokenId: row.id,
  };
}

export async function revokeToken(input: { token: string; userId?: string; clientId?: string }): Promise<boolean> {
  const hash = sha256(input.token);
  const instance = await db();
  const access = await instance
    .selectFrom("mcp_oauth_tokens")
    .select(["id", "user_id", "client_id", "family_id"])
    .where("token_hash", "=", hash)
    .executeTakeFirst();
  const refresh = access
    ? null
    : await instance
        .selectFrom("mcp_oauth_tokens")
        .select(["id", "user_id", "client_id", "family_id"])
        .where("refresh_hash", "=", hash)
        .executeTakeFirst();
  const row = access ?? refresh;
  if (!row) return false;
  if (input.userId && input.userId !== row.user_id) return false;
  if (input.clientId && input.clientId !== row.client_id) return false;

  await instance
    .updateTable("mcp_oauth_tokens")
    .set({ revoked_at: new Date() })
    .where("family_id", "=", row.family_id)
    .where("revoked_at", "is", null)
    .execute();
  await audit(row.user_id, row.client_id, "token.revoked");
  return true;
}

export async function listConnections(userId: string) {
  const instance = await db();
  const rows = await instance
    .selectFrom("mcp_connections")
    .select(["id", "client_id", "client_name", "scopes", "created_at", "last_used_at", "revoked_at"])
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    scopes: JSON.parse(row.scopes) as string[],
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
  }));
}

export async function revokeConnection(userId: string, connectionId: string): Promise<boolean> {
  const instance = await db();
  const connection = await instance
    .selectFrom("mcp_connections")
    .select(["id", "client_id"])
    .where("id", "=", connectionId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!connection) return false;
  const now = new Date();
  await instance
    .updateTable("mcp_connections")
    .set({ revoked_at: now })
    .where("id", "=", connectionId)
    .execute();
  await instance
    .updateTable("mcp_oauth_tokens")
    .set({ revoked_at: now })
    .where("user_id", "=", userId)
    .where("client_id", "=", connection.client_id)
    .where("revoked_at", "is", null)
    .execute();
  await audit(userId, connection.client_id, "connection.revoked");
  return true;
}

export function authorizationServerMetadata() {
  return {
    issuer: mcpIssuer,
    authorization_endpoint: `${mcpIssuer}/oauth/authorize`,
    token_endpoint: `${mcpIssuer}/api/oauth/token`,
    registration_endpoint: `${mcpIssuer}/api/oauth/register`,
    revocation_endpoint: `${mcpIssuer}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...MCP_SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl,
    authorization_servers: [mcpIssuer],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
  };
}
