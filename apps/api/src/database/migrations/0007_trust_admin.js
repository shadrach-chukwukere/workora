import { sql } from "kysely";
export async function up(db) {
    await sql `
    CREATE TABLE reviews (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id   uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      reviewer_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      reviewee_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment       text NOT NULL DEFAULT '',
      created_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (contract_id, reviewer_id)
    );
  `.execute(db);
    await sql `CREATE INDEX reviews_reviewee_idx ON reviews (reviewee_id, created_at DESC)`.execute(db);
    await sql `
    CREATE TABLE review_reports (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      review_id    uuid NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
      reporter_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      reason       text NOT NULL,
      status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX review_reports_status_idx ON review_reports (status)`.execute(db);
    await sql `
    CREATE TABLE disputes (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id      uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      opened_by        uuid NOT NULL REFERENCES users (id),
      assigned_to      uuid REFERENCES users (id) ON DELETE SET NULL,
      status           text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'under_review', 'resolved', 'withdrawn', 'closed')),
      reason           text NOT NULL,
      details          text NOT NULL,
      amount_minor     bigint NOT NULL CHECK (amount_minor >= 0),
      currency         char(3) NOT NULL DEFAULT 'USD',
      resolution        text,
      resolution_outcome text CHECK (resolution_outcome IN ('freelancer', 'client', 'split', 'no_action')),
      opened_at        timestamptz NOT NULL DEFAULT now(),
      resolved_at      timestamptz,
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX disputes_status_idx ON disputes (status, opened_at DESC)`.execute(db);
    await sql `CREATE INDEX disputes_contract_idx ON disputes (contract_id)`.execute(db);
    await sql `
    CREATE TABLE dispute_evidence (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id   uuid NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
      file_name    text NOT NULL,
      url          text NOT NULL,
      mime_type    text NOT NULL,
      uploaded_by  uuid NOT NULL REFERENCES users (id),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX dispute_evidence_dispute_idx ON dispute_evidence (dispute_id)`.execute(db);
    await sql `
    CREATE TABLE dispute_notes (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id  uuid NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
      author_id   uuid NOT NULL REFERENCES users (id),
      body        text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX dispute_notes_dispute_idx ON dispute_notes (dispute_id)`.execute(db);
    await sql `
    CREATE TABLE verification_requests (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      status        text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'info_requested', 'approved', 'rejected')),
      document_type text NOT NULL,
      submitted_at  timestamptz NOT NULL DEFAULT now(),
      decided_at    timestamptz,
      decided_by    uuid REFERENCES users (id),
      notes         text
    );
  `.execute(db);
    await sql `CREATE INDEX verification_requests_status_idx ON verification_requests (status)`.execute(db);
    await sql `
    CREATE TABLE verification_documents (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id   uuid NOT NULL REFERENCES verification_requests (id) ON DELETE CASCADE,
      file_name    text NOT NULL,
      url          text NOT NULL,
      mime_type    text NOT NULL,
      size_bytes   integer NOT NULL CHECK (size_bytes >= 0),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX verification_documents_request_idx ON verification_documents (request_id)`.execute(db);
    await sql `
    CREATE TABLE admin_logs (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id     uuid NOT NULL REFERENCES users (id),
      action       text NOT NULL,
      target_type  text NOT NULL,
      target_id    text,
      before_json  jsonb,
      after_json   jsonb,
      ip           text,
      request_id   text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX admin_logs_actor_idx ON admin_logs (actor_id, created_at DESC)`.execute(db);
    await sql `CREATE INDEX admin_logs_target_idx ON admin_logs (target_type, target_id)`.execute(db);
    await sql `
    CREATE TABLE moderation_actions (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id    uuid NOT NULL REFERENCES users (id),
      target_type text NOT NULL,
      target_id   text NOT NULL,
      action      text NOT NULL,
      reason      text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id)`.execute(db);
    await sql `
    CREATE TABLE platform_settings (
      key        text PRIMARY KEY,
      value      jsonb NOT NULL,
      updated_by uuid REFERENCES users (id),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `
    CREATE TABLE reports (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind          text NOT NULL,
      params        jsonb NOT NULL DEFAULT '{}',
      generated_by  uuid NOT NULL REFERENCES users (id),
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    for (const table of ["disputes"]) {
        await sql.raw(`
      CREATE TRIGGER ${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `).execute(db);
    }
}
export async function down(db) {
    await sql `DROP TABLE IF EXISTS reports, platform_settings, moderation_actions, admin_logs,
    verification_documents, verification_requests, dispute_notes, dispute_evidence, disputes,
    review_reports, reviews`.execute(db);
}
