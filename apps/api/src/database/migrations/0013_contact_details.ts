import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Public contact details for a user. URL columns store the normalised
 * `https://…` form so the browser can use them directly as link targets.
 * All columns are nullable: empty strings from the UI are stored as NULL.
 */
const COLUMNS = ["phone", "github_url", "linkedin_url", "twitter_url", "instagram_url", "website_url", "portfolio_url"] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const column of COLUMNS) {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${sql.ref(column)} text`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const column of COLUMNS) {
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS ${sql.ref(column)}`.execute(db);
  }
}
