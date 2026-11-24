import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Public contact form submissions. Every message is persisted so admins can
 * review it even when email delivery is not configured.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL,
      email       text NOT NULL,
      topic       text NOT NULL,
      message     text NOT NULL,
      status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
      admin_notes text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS contact_submissions_status_created_idx
    ON contact_submissions (status, created_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS contact_submissions_created_idx
    ON contact_submissions (created_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS contact_submissions_created_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS contact_submissions_status_created_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS contact_submissions`.execute(db);
}
