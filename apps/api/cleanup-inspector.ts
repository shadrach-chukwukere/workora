import { sql } from "kysely";
import { db } from "./src/database/connection.js";
import { sha256 } from "./src/modules/oauth/service.js";

const token = "inspector-test-f432e75b-0e3c-4d9a-82be-eb36dd58eebb";
const instance = await db();
await sql`DELETE FROM mcp_oauth_tokens WHERE token_hash = ${sha256(token)}`.execute(instance);
await sql`DELETE FROM mcp_oauth_clients WHERE client_id LIKE 'inspector-%'`.execute(instance);
console.log("test token/client removed");
