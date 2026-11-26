import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { parseScopes } from "./src/modules/oauth/scopes.ts";

const db = new Kysely({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: "postgres://u:p@localhost/db" }) }) });
console.log("SQL:", db.updateTable("mcp_oauth_codes").set({ used_at: new Date() }).where("code_hash", "=", "x").where("used_at", "=", null).compile().sql);
console.log("scopes from JSON array:", JSON.stringify(parseScopes(JSON.parse('["profile:read","projects:read"]'))));
console.log("scope field:", JSON.stringify(parseScopes(JSON.parse('["profile:read","projects:read"]')).join(" ")));
