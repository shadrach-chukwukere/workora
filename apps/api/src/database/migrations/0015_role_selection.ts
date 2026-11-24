import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * A user's marketplace role is chosen once and then locked.
 *
 * users.account_type already defaults to 'freelancer' for OAuth sign-ups, so
 * the timestamp is what separates an explicit choice from that silent default.
 * Existing users with a profile are grandfathered in; OAuth accounts created
 * after this migration have no profile until they choose a role.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_selected_at timestamptz
  `.execute(db);

  // Website-created users before this change could land with a role but no
  // profile row (especially OAuth sign-ups). Public listings require a profile
  // row, so backfill one before grandfathering those users into the role step.
  await sql`
    INSERT INTO freelancer_profiles (user_id, headline, about)
    SELECT u.id, 'New to Workora - full profile pending', ''
    FROM users u
    WHERE u.account_type = 'freelancer'
      AND NOT EXISTS (SELECT 1 FROM freelancer_profiles fp WHERE fp.user_id = u.id)
    ON CONFLICT (user_id) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO client_profiles (user_id, about)
    SELECT u.id, ''
    FROM users u
    WHERE u.account_type = 'client'
      AND NOT EXISTS (SELECT 1 FROM client_profiles cp WHERE cp.user_id = u.id)
    ON CONFLICT (user_id) DO NOTHING
  `.execute(db);

  await sql`
    UPDATE users u
    SET role_selected_at = COALESCE(u.updated_at, u.created_at, now())
    WHERE u.role_selected_at IS NULL
      AND (
        u.account_type = 'admin'
        OR EXISTS (SELECT 1 FROM freelancer_profiles fp WHERE fp.user_id = u.id)
        OR EXISTS (SELECT 1 FROM client_profiles cp WHERE cp.user_id = u.id)
      )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS role_selected_at`.execute(db);
}