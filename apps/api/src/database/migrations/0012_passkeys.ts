import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * WebAuthn passkeys. Credential IDs and public keys are stored base64url-encoded.
 * Challenges are short-lived and kept in the existing `verifications` table.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS passkeys (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id     text NOT NULL UNIQUE,
      public_key        text NOT NULL,
      counter           bigint NOT NULL DEFAULT 0,
      transports        text,
      device_type       text NOT NULL DEFAULT 'single_device',
      backed_up         boolean NOT NULL DEFAULT false,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS passkeys_user_id_idx ON passkeys (user_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS passkeys`.execute(db);
}
