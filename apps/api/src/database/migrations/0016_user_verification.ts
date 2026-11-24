import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * User-level identity verification.
 *
 * `email_verified` belongs to Better Auth and must not be reused. `verified`
 * is the marketplace flag set only after an admin has manually reviewed the
 * submitted documents (or a Yoti IDV session that was also reviewed).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_provider text,
    ADD COLUMN IF NOT EXISTS verification_method text,
    ADD COLUMN IF NOT EXISTS verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS yoti_session_id text
  `.execute(db);

  // Existing verified freelancers and admins keep their access.
  await sql`
    UPDATE users u
    SET verified = true,
        verification_provider = 'workora',
        verification_method = 'legacy',
        verified_at = COALESCE(fp.verified_at, u.updated_at, u.created_at, now())
    FROM freelancer_profiles fp
    WHERE fp.user_id = u.id
      AND fp.verified_identity = true
      AND u.verified = false
  `.execute(db);

  await sql`
    UPDATE users
    SET verified = true,
        verification_provider = 'workora',
        verification_method = 'legacy',
        verified_at = COALESCE(updated_at, created_at, now())
    WHERE account_type = 'admin'
      AND verified = false
  `.execute(db);

  await sql`
    ALTER TABLE verification_requests
    ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'workora',
    ADD COLUMN IF NOT EXISTS yoti_session_id text,
    ADD COLUMN IF NOT EXISTS yoti_state text,
    ADD COLUMN IF NOT EXISTS yoti_summary jsonb
  `.execute(db);

  // Yoti media is fetched through the backend SDK instead of being stored as
  // a public URL, so url can be null for those rows.
  await sql`
    ALTER TABLE verification_documents
    ALTER COLUMN url DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'identity_document',
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
    ADD COLUMN IF NOT EXISTS storage text NOT NULL DEFAULT 'blob',
    ADD COLUMN IF NOT EXISTS yoti_media_id text
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS verification_documents_yoti_media_idx
    ON verification_documents (request_id, yoti_media_id)
    WHERE yoti_media_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS verification_requests_user_status_idx
    ON verification_requests (user_id, status, submitted_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS verification_requests_user_status_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS verification_documents_yoti_media_idx`.execute(db);
  await sql`
    ALTER TABLE verification_documents
    DROP COLUMN IF EXISTS yoti_media_id,
    DROP COLUMN IF EXISTS storage,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS category
  `.execute(db);
  await sql`
    ALTER TABLE verification_requests
    DROP COLUMN IF EXISTS yoti_summary,
    DROP COLUMN IF EXISTS yoti_state,
    DROP COLUMN IF EXISTS yoti_session_id,
    DROP COLUMN IF EXISTS provider,
    DROP COLUMN IF EXISTS method
  `.execute(db);
  await sql`
    ALTER TABLE users
    DROP COLUMN IF EXISTS yoti_session_id,
    DROP COLUMN IF EXISTS verified_at,
    DROP COLUMN IF EXISTS verification_method,
    DROP COLUMN IF EXISTS verification_provider,
    DROP COLUMN IF EXISTS verified
  `.execute(db);
}
