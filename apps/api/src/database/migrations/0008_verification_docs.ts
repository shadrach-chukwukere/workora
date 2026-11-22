import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add document_url and document_name to verification_requests
  await sql`
    ALTER TABLE verification_requests
    ADD COLUMN IF NOT EXISTS document_url text,
    ADD COLUMN IF NOT EXISTS document_name text,
    ADD COLUMN IF NOT EXISTS profile_completeness integer NOT NULL DEFAULT 0
  `.execute(db);

  // Add profile_bio_complete and profile_completeness to freelancer_profiles for matching score
  await sql`
    ALTER TABLE freelancer_profiles
    ADD COLUMN IF NOT EXISTS skills_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS portfolio_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_about boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_rate boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_location boolean NOT NULL DEFAULT false
  `.execute(db);

  // Create a view for profile completeness score (used for matching/ranking)
  await sql`
    CREATE OR REPLACE VIEW freelancer_completeness AS
    SELECT
      fp.user_id,
      (
        CASE WHEN fp.headline <> '' THEN 20 ELSE 0 END +
        CASE WHEN fp.about <> '' AND length(fp.about) > 50 THEN 20 ELSE 0 END +
        CASE WHEN fp.hourly_rate_minor IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN fp.location IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN fp.verified_identity THEN 25 ELSE 0 END +
        CASE WHEN fp.rating_count > 0 THEN 10 ELSE 0 END +
        CASE WHEN fp.completed_count > 0 THEN 10 ELSE 0 END
      ) AS completeness_score,
      fp.verified_identity,
      fp.rating_avg,
      fp.rating_count,
      fp.completed_count,
      fp.earnings_minor
    FROM freelancer_profiles fp
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS freelancer_completeness`.execute(db);
  await sql`
    ALTER TABLE freelancer_profiles
    DROP COLUMN IF EXISTS skills_count,
    DROP COLUMN IF EXISTS portfolio_count,
    DROP COLUMN IF EXISTS has_about,
    DROP COLUMN IF EXISTS has_rate,
    DROP COLUMN IF EXISTS has_location
  `.execute(db);
  await sql`
    ALTER TABLE verification_requests
    DROP COLUMN IF EXISTS document_url,
    DROP COLUMN IF EXISTS document_name,
    DROP COLUMN IF EXISTS profile_completeness
  `.execute(db);
}
