import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db } from "./src/database/connection.js";
import { mcpResourceUrl } from "./src/config/env.js";
import { createAuthorizationCode, exchangeCode, sha256, resolveClient } from "./src/modules/oauth/service.js";

const cid = `debug-${randomUUID()}`;
const instance = await db();
await sql`INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris) VALUES (${cid}, 'Debug', ${JSON.stringify(["https://example.com/cb"])})`.execute(instance);
const client = await resolveClient(cid);
const user = (await sql<{ id: string }>`SELECT id FROM users LIMIT 1`.execute(instance)).rows[0]!;
const verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
const challenge = sha256(verifier, "base64url");
const code = await createAuthorizationCode({ userId: user.id, client: client!, redirectUri: "https://example.com/cb", scopes: ["profile:read"], codeChallenge: challenge, resource: mcpResourceUrl });
console.log("challenge", challenge, "code prefix", code.slice(0, 8));
try {
  const tokens = await exchangeCode({ code, codeVerifier: verifier, clientId: cid, redirectUri: "https://example.com/cb", resource: mcpResourceUrl });
  console.log("OK", tokens.token_type);
} catch (error) {
  console.log("ERR", (error as Error).message);
  const rows = await sql<{ code_hash: string; used_at: Date | null; client_id: string; redirect_uri: string }>`SELECT code_hash, used_at, client_id, redirect_uri FROM mcp_oauth_codes WHERE code_hash = ${sha256(code)}`.execute(instance);
  console.log("ROW", rows.rows[0]);
}
await sql`DELETE FROM mcp_oauth_clients WHERE client_id = ${cid}`.execute(instance);
