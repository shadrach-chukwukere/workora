import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Resume storage, AI usage metering, client talent shortlists and project
 * invitations. Experience/education/certification tables already exist from
 * 0003; this migration adds the resume file metadata and the two missing
 * collaboration primitives.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE freelancer_profiles
      ADD COLUMN IF NOT EXISTS resume_url        text,
      ADD COLUMN IF NOT EXISTS resume_file_name  text,
      ADD COLUMN IF NOT EXISTS resume_visibility text NOT NULL DEFAULT 'public'
        CHECK (resume_visibility IN ('public', 'private')),
      ADD COLUMN IF NOT EXISTS resume_updated_at timestamptz
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS shortlisted_talent (
      client_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note          text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (client_id, freelancer_id),
      CHECK (client_id <> freelancer_id)
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS shortlisted_talent_client_idx ON shortlisted_talent (client_id, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS project_invitations (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message       text NOT NULL DEFAULT '',
      status        text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, freelancer_id)
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS project_invitations_freelancer_idx ON project_invitations (freelancer_id, status, created_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS project_invitations_project_idx ON project_invitations (project_id)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind          text NOT NULL,
      model         text NOT NULL,
      input_tokens  integer,
      output_tokens integer,
      status        text NOT NULL DEFAULT 'ok',
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS ai_usage_user_day_idx ON ai_usage (user_id, created_at DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS ai_usage`.execute(db);
  await sql`DROP TABLE IF EXISTS project_invitations`.execute(db);
  await sql`DROP TABLE IF EXISTS shortlisted_talent`.execute(db);
  await sql`
    ALTER TABLE freelancer_profiles
      DROP COLUMN IF EXISTS resume_updated_at,
      DROP COLUMN IF EXISTS resume_visibility,
      DROP COLUMN IF EXISTS resume_file_name,
      DROP COLUMN IF EXISTS resume_url
  `.execute(db);
}
