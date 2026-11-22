import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE categories
    ADD COLUMN is_launch_focus boolean NOT NULL DEFAULT false,
    ADD COLUMN launch_rank integer NOT NULL DEFAULT 100
  `.execute(db);

  await sql`
    UPDATE categories
    SET is_launch_focus = true,
        launch_rank = CASE slug
          WHEN 'web-development' THEN 1
          WHEN 'product-design' THEN 2
          WHEN 'marketing' THEN 3
          WHEN 'mobile-development' THEN 4
          WHEN 'writing-editing' THEN 5
          WHEN 'video-photography' THEN 6
          ELSE 100
        END
    WHERE slug IN (
      'web-development',
      'product-design',
      'marketing',
      'mobile-development',
      'writing-editing',
      'video-photography'
    )
  `.execute(db);

  await sql`
    ALTER TABLE freelancer_profiles
    ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
    ADD COLUMN featured_rank integer NOT NULL DEFAULT 100,
    ADD COLUMN stripe_account_id text,
    ADD COLUMN stripe_details_submitted boolean NOT NULL DEFAULT false,
    ADD COLUMN stripe_payouts_enabled boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX freelancer_profiles_stripe_account_idx
    ON freelancer_profiles (stripe_account_id)
    WHERE stripe_account_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX categories_launch_focus_idx
    ON categories (is_launch_focus, launch_rank, sort_order)
  `.execute(db);

  await sql`
    CREATE TABLE category_skills (
      category_id uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
      skill_id uuid NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
      PRIMARY KEY (category_id, skill_id)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS category_skills`.execute(db);
  await sql`DROP INDEX IF EXISTS categories_launch_focus_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS freelancer_profiles_stripe_account_idx`.execute(db);
  await sql`
    ALTER TABLE freelancer_profiles
    DROP COLUMN IF EXISTS stripe_payouts_enabled,
    DROP COLUMN IF EXISTS stripe_details_submitted,
    DROP COLUMN IF EXISTS stripe_account_id,
    DROP COLUMN IF EXISTS featured_rank,
    DROP COLUMN IF EXISTS is_featured
  `.execute(db);
  await sql`
    ALTER TABLE categories
    DROP COLUMN IF EXISTS launch_rank,
    DROP COLUMN IF EXISTS is_launch_focus
  `.execute(db);
}
