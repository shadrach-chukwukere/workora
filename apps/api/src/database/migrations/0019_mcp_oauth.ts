import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * OAuth 2.1 / MCP integration state.
 *
 * Better Auth continues to own end-user sessions and passwords; these tables
 * only describe third-party AI clients, short-lived authorization codes,
 * opaque bearer tokens and the user's connection/audit history.
 * Token values are stored only as SHA-256 hashes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
      id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id                 text NOT NULL UNIQUE,
      client_name               text NOT NULL,
      redirect_uris             text NOT NULL,
      grant_types               text NOT NULL DEFAULT '["authorization_code","refresh_token"]',
      token_endpoint_auth_method text NOT NULL DEFAULT 'none',
      application_type          text NOT NULL DEFAULT 'web',
      client_id_metadata_url    text,
      created_at                timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
      code_hash      text PRIMARY KEY,
      user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id      text NOT NULL,
      redirect_uri   text NOT NULL,
      scopes         text NOT NULL,
      code_challenge text NOT NULL,
      resource       text NOT NULL,
      expires_at     timestamptz NOT NULL,
      used_at        timestamptz,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS mcp_oauth_codes_user_idx ON mcp_oauth_codes (user_id, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash        text NOT NULL UNIQUE,
      refresh_hash      text UNIQUE,
      user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id         text NOT NULL,
      scopes            text NOT NULL,
      resource          text NOT NULL,
      family_id         uuid NOT NULL,
      expires_at        timestamptz NOT NULL,
      refresh_expires_at timestamptz NOT NULL,
      revoked_at        timestamptz,
      last_used_at      timestamptz,
      created_at        timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_idx ON mcp_oauth_tokens (user_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_refresh_family_idx ON mcp_oauth_tokens (family_id)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS mcp_connections (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id   text NOT NULL,
      client_name text NOT NULL,
      scopes      text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at  timestamptz,
      UNIQUE (user_id, client_id)
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS mcp_connections_user_idx ON mcp_connections (user_id, revoked_at, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS mcp_audit_logs (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
      client_id  text,
      action     text NOT NULL,
      detail     text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS mcp_audit_logs_user_idx ON mcp_audit_logs (user_id, created_at DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["mcp_audit_logs", "mcp_connections", "mcp_oauth_tokens", "mcp_oauth_codes", "mcp_oauth_clients"]) {
    await sql`DROP TABLE IF EXISTS ${sql.ref(table)}`.execute(db);
  }
}
