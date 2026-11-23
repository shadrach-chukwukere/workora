import type { Kysely } from "kysely";
import { sql } from "kysely";

/** Optional project cover image, stored as a public Vercel Blob URL. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS cover_image_url text
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE projects
    DROP COLUMN IF EXISTS cover_image_url
  `.execute(db);
}
