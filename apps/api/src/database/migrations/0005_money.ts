import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE subscription_plans (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code          text NOT NULL UNIQUE,
      name          text NOT NULL,
      audience      text NOT NULL CHECK (audience IN ('freelancer', 'client')),
      price_minor   bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
      currency      char(3) NOT NULL DEFAULT 'USD',
      interval      text NOT NULL CHECK (interval IN ('monthly', 'annual')),
      features      jsonb NOT NULL DEFAULT '[]',
      is_highlighted boolean NOT NULL DEFAULT false,
      is_active     boolean NOT NULL DEFAULT true,
      sort_order    integer NOT NULL DEFAULT 100,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);

  await sql`
    CREATE TABLE subscriptions (
      id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      plan_id                   uuid NOT NULL REFERENCES subscription_plans (id),
      status                    text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
      interval                  text NOT NULL CHECK (interval IN ('monthly', 'annual')),
      amount_minor              bigint NOT NULL CHECK (amount_minor > 0),
      currency                  char(3) NOT NULL DEFAULT 'USD',
      provider                  text NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe', 'paystack', 'manual')),
      provider_subscription_id  text UNIQUE,
      started_at                timestamptz NOT NULL DEFAULT now(),
      current_period_end        timestamptz,
      canceled_at               timestamptz,
      created_at                timestamptz NOT NULL DEFAULT now(),
      updated_at                timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, status)`.execute(db);

  await sql`
    CREATE TABLE payment_methods (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      provider          text NOT NULL CHECK (provider IN ('stripe', 'paystack')),
      provider_method_id text NOT NULL,
      brand             text,
      last_four         char(4),
      exp_month         smallint,
      exp_year          smallint,
      is_default        boolean NOT NULL DEFAULT false,
      created_at        timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, provider_method_id)
    );
  `.execute(db);

  await sql`
    CREATE TABLE processed_webhooks (
      id          text PRIMARY KEY,
      provider    text NOT NULL CHECK (provider IN ('stripe', 'paystack', 'resend')),
      received_at timestamptz NOT NULL DEFAULT now(),
      payload     jsonb NOT NULL
    );
  `.execute(db);

  await sql`
    CREATE TABLE payments (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         uuid NOT NULL REFERENCES users (id),
      provider        text NOT NULL CHECK (provider IN ('stripe', 'paystack')),
      type            text NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'payout')),
      kind            text NOT NULL CHECK (kind IN ('milestone', 'subscription', 'topup', 'payout_fee')),
      provider_ref    text NOT NULL UNIQUE,
      amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
      fee_minor       bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
      currency        char(3) NOT NULL,
      status          text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
      contract_id     uuid REFERENCES contracts (id) ON DELETE SET NULL,
      milestone_id    uuid REFERENCES contract_milestones (id) ON DELETE SET NULL,
      metadata        jsonb NOT NULL DEFAULT '{}',
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX payments_user_status_idx ON payments (user_id, status)`.execute(db);
  await sql`CREATE INDEX payments_contract_idx ON payments (contract_id)`.execute(db);

  await sql`
    CREATE TABLE payouts (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users (id),
      provider      text NOT NULL CHECK (provider IN ('stripe', 'paystack', 'manual')),
      provider_ref  text UNIQUE,
      amount_minor  bigint NOT NULL CHECK (amount_minor > 0),
      fee_minor     bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
      currency      char(3) NOT NULL,
      status        text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
      note          text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX payouts_user_status_idx ON payouts (user_id, status)`.execute(db);

  await sql`
    CREATE TABLE refunds (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id    uuid NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
      amount_minor  bigint NOT NULL CHECK (amount_minor > 0),
      reason        text NOT NULL,
      status        text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'processed')),
      requested_by  uuid NOT NULL REFERENCES users (id),
      decided_by    uuid REFERENCES users (id),
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX refunds_payment_idx ON refunds (payment_id)`.execute(db);

  await sql`
    CREATE TABLE transactions (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         uuid NOT NULL REFERENCES users (id),
      type            text NOT NULL
                      CHECK (type IN ('milestone', 'commission', 'refund', 'withdrawal', 'topup', 'payout', 'payment')),
      amount_minor    bigint NOT NULL,
      currency        char(3) NOT NULL,
      status          text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
      counterparty_id uuid REFERENCES users (id) ON DELETE SET NULL,
      contract_id     uuid REFERENCES contracts (id) ON DELETE SET NULL,
      payment_id      uuid REFERENCES payments (id) ON DELETE SET NULL,
      payout_id       uuid REFERENCES payouts (id) ON DELETE SET NULL,
      description     text NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX transactions_user_idx ON transactions (user_id, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE platform_fees (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id   uuid REFERENCES contracts (id) ON DELETE SET NULL,
      milestone_id  uuid REFERENCES contract_milestones (id) ON DELETE SET NULL,
      amount_minor  bigint NOT NULL CHECK (amount_minor >= 0),
      rate_bps      integer NOT NULL,
      currency      char(3) NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX platform_fees_contract_idx ON platform_fees (contract_id)`.execute(db);

  await sql`
    CREATE TABLE invoices (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      kind          text NOT NULL CHECK (kind IN ('subscription', 'payment')),
      ref           text NOT NULL UNIQUE,
      amount_minor  bigint NOT NULL CHECK (amount_minor > 0),
      currency      char(3) NOT NULL,
      issued_at     timestamptz NOT NULL DEFAULT now(),
      status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `.execute(db);
  await sql`CREATE INDEX invoices_user_idx ON invoices (user_id, issued_at DESC)`.execute(db);

  for (const table of ["subscriptions", "payments", "payouts", "refunds"]) {
    await sql.raw(`
      CREATE TRIGGER ${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS invoices, platform_fees, transactions, refunds, payouts, payments,
    processed_webhooks, payment_methods, subscriptions, subscription_plans`.execute(db);
}
