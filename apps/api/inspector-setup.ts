import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { sql } from "kysely";
import { db } from "./src/database/connection.js";
import { mcpResourceUrl, env } from "./src/config/env.js";
import { sha256 } from "./src/modules/oauth/service.js";
import { MCP_SCOPES } from "./src/modules/oauth/scopes.js";

const token = `inspector-test-${randomUUID()}`;
const clientId = `inspector-${randomUUID()}`;
const instance = await db();
const user = (await sql<{ id: string }>`SELECT id FROM users WHERE status = 'active' LIMIT 1`.execute(instance)).rows[0]!;
await sql`INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris) VALUES (${clientId}, 'Inspector Test', ${JSON.stringify(["https://example.com/callback"])})`.execute(instance);
await sql`
  INSERT INTO mcp_oauth_tokens (token_hash, user_id, client_id, scopes, resource, family_id, expires_at, refresh_expires_at)
  VALUES (${sha256(token)}, ${user.id}, ${clientId}, ${JSON.stringify(MCP_SCOPES)}, ${mcpResourceUrl}, ${randomUUID()}, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '1 day')
`.execute(instance);
const config = {
  mcpServers: {
    workora: {
      url: "http://localhost:3010/mcp",
      type: "http",
      headers: { Authorization: `Bearer ${token}` },
    },
  },
};
writeFileSync("C:/Users/PC/AppData/Local/Temp/opencode/inspector-mcp.json", JSON.stringify(config, null, 2));
console.log("config written; issuer", env.WEB_APP_URL);
