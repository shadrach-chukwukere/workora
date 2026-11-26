import { config } from "dotenv";
import pg from "pg";

config({ path: new URL("./.env", import.meta.url) });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function show(title, sql) {
  try {
    const res = await client.query(sql);
    console.log(`\n=== ${title} (${res.rowCount}) ===`);
    for (const row of res.rows) console.log(JSON.stringify(row));
  } catch (err) {
    console.log(`\n=== ${title} ERROR ===`, err.message);
  }
}

await show("recent audit logs", `SELECT created_at, user_id, client_id, action, detail FROM mcp_audit_logs ORDER BY created_at DESC LIMIT 40`);
await show("claude-like clients", `SELECT client_id, client_name, redirect_uris, created_at FROM mcp_oauth_clients WHERE client_name ILIKE '%claude%' OR client_id LIKE 'https://%' ORDER BY created_at DESC LIMIT 20`);
await show("recent codes", `SELECT created_at, client_id, redirect_uri, resource, used_at, expires_at FROM mcp_oauth_codes ORDER BY created_at DESC LIMIT 20`);
await show("recent connections", `SELECT created_at, user_id, client_id, client_name, revoked_at FROM mcp_connections ORDER BY created_at DESC LIMIT 20`);

await client.end();
