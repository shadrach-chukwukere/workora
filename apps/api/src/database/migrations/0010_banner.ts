import type { Kysely } from "kysely";
import { sql } from "kysely";

/** Public profile banner image, stored as a Vercel Blob URL on the user row. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banner_url text
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
    DROP COLUMN IF EXISTS banner_url
  `.execute(db);
}
