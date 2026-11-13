import type { Kysely } from "kysely";
import { sql } from "kysely";

const UPDATED_AT_TRIGGER = "updated_at";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Better Auth identity tables, with our own column names
  await sql`
    CREATE TABLE users (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name            text NOT NULL,
      email           text NOT NULL,
      email_verified  boolean NOT NULL DEFAULT false,
      image           text,
      account_type    text NOT NULL DEFAULT 'freelancer'
                      CHECK (account_type IN ('freelancer', 'client', 'admin')),
      status          text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'suspended', 'restricted')),
      failed_logins   integer NOT NULL DEFAULT 0,
      locked_until    timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql`
    CREATE TABLE sessions (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       text NOT NULL UNIQUE,
      expires_at  timestamptz NOT NULL,
      ip_address  text,
      user_agent  text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email))`.execute(db);
  await sql`CREATE INDEX sessions_user_id_idx ON sessions (user_id)`.execute(db);

  await sql`
    CREATE TABLE accounts (
      id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id                text NOT NULL,
      provider_id               text NOT NULL,
      access_token              text,
      refresh_token             text,
      id_token                  text,
      access_token_expires_at   timestamptz,
      refresh_token_expires_at  timestamptz,
      scope                     text,
      password                  text,
      created_at                timestamptz NOT NULL DEFAULT now(),
      updated_at                timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX accounts_user_id_idx ON accounts (user_id)`.execute(db);
  await sql`CREATE INDEX accounts_provider_account_idx ON accounts (provider_id, account_id)`.execute(db);

  await sql`
    CREATE TABLE verifications (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier  text NOT NULL,
      value       text NOT NULL,
      expires_at  timestamptz NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX verifications_identifier_idx ON verifications (identifier)`.execute(db);

  // RBAC
  await sql`
    CREATE TABLE permissions (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key         text NOT NULL UNIQUE,
      description text NOT NULL
    );
  `.execute(db);

  await sql`
    CREATE TABLE roles (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key         text NOT NULL UNIQUE,
      name        text NOT NULL,
      description text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql`
    CREATE TABLE role_permissions (
      role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id  uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
  `.execute(db);

  await sql`
    CREATE TABLE user_roles (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `.execute(db);
  await sql`CREATE INDEX user_roles_role_id_idx ON user_roles (role_id)`.execute(db);

  for (const table of ["users", "sessions", "accounts", "verifications"]) {
    await sql.raw(`
      CREATE TRIGGER ${table}_${UPDATED_AT_TRIGGER}
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS user_roles, role_permissions, roles, permissions, verifications, accounts, sessions, users`.execute(db);
}
