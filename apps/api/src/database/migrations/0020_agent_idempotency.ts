import { sql, type Kysely } from "kysely";

/** Idempotency records for agent create/submit operations, scoped per user. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_idempotency (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      operation TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, operation, idempotency_key)
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS agent_idempotency_expiry_idx ON agent_idempotency (expires_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS agent_idempotency`.execute(db);
}
