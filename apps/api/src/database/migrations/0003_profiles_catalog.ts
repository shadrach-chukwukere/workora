import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE categories (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug         text NOT NULL,
      name         text NOT NULL,
      description  text NOT NULL DEFAULT '',
      parent_id    uuid REFERENCES categories(id) ON DELETE SET NULL,
      kind         text NOT NULL DEFAULT 'category' CHECK (kind IN ('category', 'specialty')),
      sort_order   integer NOT NULL DEFAULT 100,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE UNIQUE INDEX categories_slug_lower_idx ON categories (lower(slug))`.execute(db);

  await sql`
    CREATE TABLE skills (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug        text NOT NULL,
      name        text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE UNIQUE INDEX skills_slug_lower_idx ON skills (lower(slug))`.execute(db);

  await sql`
    CREATE TABLE freelancer_profiles (
      user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      headline            text NOT NULL,
      about               text NOT NULL DEFAULT '',
      hourly_rate_minor   bigint CHECK (hourly_rate_minor IS NULL OR hourly_rate_minor > 0),
      currency            char(3) NOT NULL DEFAULT 'USD',
      availability        text NOT NULL DEFAULT 'available'
                          CHECK (availability IN ('available', 'limited', 'unavailable')),
      response_time_hours integer NOT NULL DEFAULT 24 CHECK (response_time_hours > 0),
      location            text,
      timezone            text,
      experience_level    text CHECK (experience_level IN ('entry', 'intermediate', 'expert')),
      verified_identity   boolean NOT NULL DEFAULT false,
      verified_at         timestamptz,
      rating_avg          numeric(3,2),
      rating_count        integer NOT NULL DEFAULT 0,
      completed_count     integer NOT NULL DEFAULT 0,
      earnings_minor      bigint NOT NULL DEFAULT 0,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql`
    CREATE TABLE client_profiles (
      user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      company_name   text,
      company_size   text CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
      industry       text,
      website        text,
      about          text NOT NULL DEFAULT '',
      rating_avg     numeric(3,2),
      rating_count   integer NOT NULL DEFAULT 0,
      spent_minor    bigint NOT NULL DEFAULT 0,
      projects_count integer NOT NULL DEFAULT 0,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql`
    CREATE TABLE freelancer_skills (
      freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id) ON DELETE CASCADE,
      skill_id      uuid NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
      PRIMARY KEY (freelancer_id, skill_id)
    );
  `.execute(db);
  await sql`CREATE INDEX freelancer_skills_skill_idx ON freelancer_skills (skill_id)`.execute(db);

  await sql`
    CREATE TABLE portfolio_projects (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id) ON DELETE CASCADE,
      title         text NOT NULL,
      summary       text NOT NULL,
      description   text NOT NULL DEFAULT '',
      role          text,
      year          integer CHECK (year BETWEEN 1990 AND 2100),
      project_url   text,
      image_url     text,
      sort_order    integer NOT NULL DEFAULT 0,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX portfolio_projects_freelancer_idx ON portfolio_projects (freelancer_id)`.execute(db);

  await sql`
    CREATE TABLE work_experiences (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id) ON DELETE CASCADE,
      company       text NOT NULL,
      role          text NOT NULL,
      start_date    date NOT NULL,
      end_date      date,
      description   text NOT NULL DEFAULT '',
      created_at    timestamptz NOT NULL DEFAULT now(),
      CHECK (end_date IS NULL OR end_date >= start_date)
    );
  `.execute(db);
  await sql`CREATE INDEX work_experiences_freelancer_idx ON work_experiences (freelancer_id)`.execute(db);

  await sql`
    CREATE TABLE education (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id) ON DELETE CASCADE,
      school        text NOT NULL,
      degree        text NOT NULL,
      field         text,
      start_year    integer NOT NULL,
      end_year      integer,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX education_freelancer_idx ON education (freelancer_id)`.execute(db);

  await sql`
    CREATE TABLE certifications (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id) ON DELETE CASCADE,
      name          text NOT NULL,
      issuer        text,
      year          integer,
      credential_url text,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX certifications_freelancer_idx ON certifications (freelancer_id)`.execute(db);

  for (const table of ["freelancer_profiles", "client_profiles", "portfolio_projects"]) {
    await sql.raw(`
      CREATE TRIGGER ${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS certifications, education, work_experiences, portfolio_projects,
    freelancer_skills, client_profiles, freelancer_profiles, skills, categories`.execute(db);
}
