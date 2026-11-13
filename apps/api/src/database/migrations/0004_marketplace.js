import { sql } from "kysely";
export async function up(db) {
    await sql `
    CREATE TABLE projects (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id       uuid NOT NULL REFERENCES users (id),
      title           text NOT NULL,
      summary         text NOT NULL,
      description     text NOT NULL,
      category_id     uuid REFERENCES categories (id) ON DELETE SET NULL,
      status          text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'flagged')),
      budget_type     text NOT NULL CHECK (budget_type IN ('fixed', 'hourly')),
      budget_min_minor bigint CHECK (budget_min_minor IS NULL OR budget_min_minor >= 0),
      budget_max_minor bigint CHECK (budget_max_minor IS NULL OR budget_max_minor >= 0),
      currency        char(3) NOT NULL DEFAULT 'USD',
      experience_level text CHECK (experience_level IN ('entry', 'intermediate', 'expert')),
      duration_bucket text CHECK (duration_bucket IN ('lt-1m', '1-3m', '3-6m', 'gt-6m')),
      proposals_count integer NOT NULL DEFAULT 0,
      invited_only    boolean NOT NULL DEFAULT false,
      published_at    timestamptz,
      deadline        date,
      close_reason    text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      CHECK (budget_max_minor IS NULL OR budget_min_minor IS NULL OR budget_max_minor >= budget_min_minor)
    );
  `.execute(db);
    await sql `CREATE INDEX projects_client_status_idx ON projects (client_id, status)`.execute(db);
    await sql `CREATE INDEX projects_status_published_idx ON projects (status, published_at DESC)`.execute(db);
    await sql `CREATE INDEX projects_category_idx ON projects (category_id)`.execute(db);
    await sql `
    CREATE TABLE project_skills (
      project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      skill_id    uuid NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
      position    integer NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, skill_id)
    );
  `.execute(db);
    await sql `CREATE INDEX project_skills_skill_idx ON project_skills (skill_id)`.execute(db);
    await sql `
    CREATE TABLE saved_projects (
      user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, project_id)
    );
  `.execute(db);
    await sql `CREATE INDEX saved_projects_project_idx ON saved_projects (project_id)`.execute(db);
    await sql `
    CREATE TABLE proposals (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id       uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      freelancer_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      cover_letter     text NOT NULL,
      bid_type         text NOT NULL CHECK (bid_type IN ('fixed', 'hourly')),
      bid_amount_minor bigint NOT NULL CHECK (bid_amount_minor > 0),
      duration_days    integer CHECK (duration_days IS NULL OR duration_days > 0),
      status           text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
      submitted_at     timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, freelancer_id)
    );
  `.execute(db);
    await sql `CREATE INDEX proposals_freelancer_status_idx ON proposals (freelancer_id, status)`.execute(db);
    await sql `CREATE INDEX proposals_project_status_idx ON proposals (project_id, status)`.execute(db);
    await sql `
    CREATE TABLE proposal_attachments (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id  uuid NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
      file_name    text NOT NULL,
      url          text NOT NULL,
      size_bytes   integer NOT NULL CHECK (size_bytes >= 0),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX proposal_attachments_proposal_idx ON proposal_attachments (proposal_id)`.execute(db);
    await sql `
    CREATE TABLE contracts (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id       uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      client_id        uuid NOT NULL REFERENCES users (id),
      freelancer_id    uuid NOT NULL REFERENCES users (id),
      proposal_id      uuid UNIQUE REFERENCES proposals (id) ON DELETE SET NULL,
      title_snapshot   text NOT NULL,
      total_minor      bigint NOT NULL CHECK (total_minor > 0),
      currency         char(3) NOT NULL DEFAULT 'USD',
      status           text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'completed', 'cancelled', 'paused', 'disputed')),
      started_at       timestamptz NOT NULL DEFAULT now(),
      ended_at         timestamptz,
      cancel_reason    text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX contracts_project_idx ON contracts (project_id)`.execute(db);
    await sql `CREATE INDEX contracts_client_status_idx ON contracts (client_id, status)`.execute(db);
    await sql `CREATE INDEX contracts_freelancer_status_idx ON contracts (freelancer_id, status)`.execute(db);
    await sql `
    CREATE TABLE contract_milestones (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id   uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      title         text NOT NULL,
      description   text NOT NULL DEFAULT '',
      amount_minor  bigint NOT NULL CHECK (amount_minor >= 0),
      sequencing    integer NOT NULL DEFAULT 1,
      status        text NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming', 'funded', 'in_review', 'revision', 'approved', 'paid', 'cancelled')),
      due_date      date,
      funded_at     timestamptz,
      in_review_at  timestamptz,
      approved_at   timestamptz,
      paid_at       timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX contract_milestones_contract_idx ON contract_milestones (contract_id, sequencing)`.execute(db);
    await sql `CREATE INDEX contract_milestones_status_idx ON contract_milestones (status)`.execute(db);
    await sql `
    CREATE TABLE contract_deliverables (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id   uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      milestone_id  uuid REFERENCES contract_milestones (id) ON DELETE SET NULL,
      title         text NOT NULL,
      note          text NOT NULL DEFAULT '',
      url           text,
      submitted_by  uuid NOT NULL REFERENCES users (id),
      submitted_at  timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX contract_deliverables_contract_idx ON contract_deliverables (contract_id)`.execute(db);
    await sql `
    CREATE TABLE contract_events (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id  uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      actor_id     uuid REFERENCES users (id) ON DELETE SET NULL,
      kind         text NOT NULL,
      payload      jsonb NOT NULL DEFAULT '{}',
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
    await sql `CREATE INDEX contract_events_contract_idx ON contract_events (contract_id, created_at)`.execute(db);
    for (const table of ["projects", "proposals", "contracts", "contract_milestones"]) {
        await sql.raw(`
      CREATE TRIGGER ${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `).execute(db);
    }
}
export async function down(db) {
    await sql `DROP TABLE IF EXISTS contract_events, contract_deliverables, contract_milestones, contracts,
    proposal_attachments, proposals, saved_projects, project_skills, projects`.execute(db);
}
