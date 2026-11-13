import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE conversations (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind         text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct', 'contract')),
      contract_id  uuid REFERENCES contracts (id) ON DELETE SET NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX conversations_contract_idx ON conversations (contract_id)`.execute(db);

  await sql`
    CREATE TABLE conversation_participants (
      conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
      user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at       timestamptz NOT NULL DEFAULT now(),
      last_read_at    timestamptz,
      is_muted        boolean NOT NULL DEFAULT false,
      PRIMARY KEY (conversation_id, user_id)
    );
  `.execute(db);
  await sql`CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id)`.execute(db);

  await sql`
    CREATE TABLE messages (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
      sender_id       uuid REFERENCES users (id) ON DELETE SET NULL,
      body            text NOT NULL CHECK (length(body) > 0),
      edited_at       timestamptz,
      deleted_at      timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at)`.execute(db);

  await sql`
    CREATE TABLE message_attachments (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id  uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      file_name   text NOT NULL,
      url         text NOT NULL,
      mime_type   text NOT NULL,
      size_bytes  integer NOT NULL CHECK (size_bytes >= 0),
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX message_attachments_message_idx ON message_attachments (message_id)`.execute(db);

  await sql`
    CREATE TABLE notifications (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      type          text NOT NULL
                    CHECK (type IN ('proposal', 'contract', 'message', 'payment', 'review', 'verification', 'system', 'dispute')),
      title         text NOT NULL,
      body          text NOT NULL,
      url           text,
      entity_type   text,
      entity_id     uuid,
      is_read       boolean NOT NULL DEFAULT false,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX notifications_user_idx ON notifications (user_id, is_read, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE notification_preferences (
      user_id           uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
      email_proposal    boolean NOT NULL DEFAULT true,
      email_contract    boolean NOT NULL DEFAULT true,
      email_payment     boolean NOT NULL DEFAULT true,
      email_review      boolean NOT NULL DEFAULT true,
      email_marketing   boolean NOT NULL DEFAULT false,
      updated_at        timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql.raw(`
    CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS notification_preferences, notifications, message_attachments, messages,
    conversation_participants, conversations`.execute(db);
}
