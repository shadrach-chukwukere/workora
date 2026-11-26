import { config } from "dotenv";
import pg from "pg";
config({ path: new URL("./.env", import.meta.url) });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const [title, sql] of [
  ["all oauth clients", `SELECT client_id, client_name, redirect_uris, created_at FROM mcp_oauth_clients ORDER BY created_at DESC LIMIT 60`],
  ["oauth audit events", `SELECT created_at, user_id, client_id, action, detail FROM mcp_audit_logs WHERE action LIKE 'client.%' OR action LIKE 'code.%' OR action LIKE 'token.%' OR action LIKE 'connection.%' ORDER BY created_at DESC LIMIT 100`],
  ["counts", `SELECT (SELECT count(*) FROM mcp_oauth_clients) clients, (SELECT count(*) FROM mcp_oauth_codes) codes, (SELECT count(*) FROM mcp_oauth_tokens) tokens, (SELECT count(*) FROM mcp_connections) connections`],
]) {
  const res = await client.query(sql);
  console.log(`\n=== ${title} (${res.rowCount}) ===`);
  for (const row of res.rows) console.log(JSON.stringify(row));
}
await client.end();
