import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Freelancing-style connections: a user can follow another freelancer or client.
 * `follower_id` is the viewer; `following_id` is the profile being followed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS connections (
      follower_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id <> following_id)
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS connections_following_idx ON connections (following_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS connections`.execute(db);
}
