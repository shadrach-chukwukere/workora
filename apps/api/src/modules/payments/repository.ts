import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "../../database/types.js";

/** Data access for the payments module. Functions accept either the pooled Kysely instance or a transaction. */
export type Conn = Kysely<DB>;

export function listPaymentMethods(db: Conn, userId: string) {
  return db
    .selectFrom("payment_methods")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("is_default", "desc")
    .orderBy("created_at", "asc")
    .execute();
}

/** Lazily seeds the demo VISA ····4169 row for a brand-new user (idempotent via UNIQUE(user_id, provider_method_id)). */
export async function seedDemoPaymentMethodIfEmpty(db: Conn, userId: string) {
  await sql`
    INSERT INTO payment_methods (user_id, provider, provider_method_id, brand, last_four, exp_month, exp_year, is_default)
    SELECT ${userId}, 'stripe', 'demo-visa-4169', 'VISA (demo)', '4169', 12, ${new Date().getFullYear() + 3}, true
    WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE user_id = ${userId})
    ON CONFLICT (user_id, provider_method_id) DO NOTHING
  `.execute(db);
}

export function countPaymentMethods(db: Conn, userId: string) {
  return db
    .selectFrom("payment_methods")
    .where("user_id", "=", userId)
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow()
    .then((row) => Number(row.count));
}

export function insertPaymentMethod(
  db: Conn,
  row: {
    userId: string;
    provider: "stripe" | "paystack";
    providerMethodId: string;
    brand: string | null;
    lastFour: string | null;
    expMonth: number | null;
    expYear: number | null;
    isDefault: boolean;
  },
) {
  return db
    .insertInto("payment_methods")
    .values({
      user_id: row.userId,
      provider: row.provider,
      provider_method_id: row.providerMethodId,
      brand: row.brand,
      last_four: row.lastFour,
      exp_month: row.expMonth,
      exp_year: row.expYear,
      is_default: row.isDefault,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findPaymentMethodOwned(db: Conn, id: string, userId: string) {
  return db
    .selectFrom("payment_methods")
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
}

export function deletePaymentMethod(db: Conn, id: string) {
  return db.deleteFrom("payment_methods").where("id", "=", id).execute();
}

export function insertPayment(
  db: Conn,
  row: {
    userId: string;
    provider: "stripe" | "paystack";
    kind: "milestone" | "subscription" | "topup";
    providerRef: string;
    amountMinor: number;
    currency: string;
    contractId: string | null;
    milestoneId: string | null;
    metadata: Record<string, unknown>;
  },
) {
  return db
    .insertInto("payments")
    .values({
      user_id: row.userId,
      provider: row.provider,
      kind: row.kind,
      provider_ref: row.providerRef,
      amount_minor: row.amountMinor,
      currency: row.currency,
      status: "pending",
      contract_id: row.contractId,
      milestone_id: row.milestoneId,
      metadata: row.metadata as never,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findPaymentById(db: Conn, id: string) {
  return db.selectFrom("payments").selectAll().where("id", "=", id).executeTakeFirst();
}

export function findPaymentByProviderRef(db: Conn, providerRef: string) {
  return db.selectFrom("payments").selectAll().where("provider_ref", "=", providerRef).executeTakeFirst();
}

export function findPaymentOwnedByProviderRef(db: Conn, providerRef: string, userId: string) {
  return db
    .selectFrom("payments")
    .selectAll()
    .where("provider_ref", "=", providerRef)
    .where("user_id", "=", userId)
    .executeTakeFirst();
}

export function markPaymentSucceeded(db: Conn, id: string) {
  return db
    .updateTable("payments")
    .set({ status: "succeeded", updated_at: new Date() })
    .where("id", "=", id)
    .where("status", "=", "pending")
    .returningAll()
    .executeTakeFirst();
}

export function findMilestoneWithContract(db: Conn, milestoneId: string) {
  return db
    .selectFrom("contract_milestones as m")
    .innerJoin("contracts as c", "c.id", "m.contract_id")
    .select([
      "m.id as milestone_id",
      "m.contract_id as contract_id",
      "m.title as milestone_title",
      "m.amount_minor as milestone_amount_minor",
      "m.status as milestone_status",
      "c.client_id as client_id",
      "c.freelancer_id as freelancer_id",
      "c.currency as contract_currency",
      "c.title_snapshot as contract_title",
    ])
    .where("m.id", "=", milestoneId)
    .executeTakeFirst();
}

export function findContractById(db: Conn, id: string) {
  return db.selectFrom("contracts").selectAll().where("id", "=", id).executeTakeFirst();
}

export function setMilestoneStatus(
  db: Conn,
  milestoneId: string,
  status: "approved" | "paid",
  timestampColumn: "approved_at" | "paid_at",
) {
  return db
    .updateTable("contract_milestones")
    .set({ status, [timestampColumn]: new Date(), updated_at: new Date() } as never)
    .where("id", "=", milestoneId)
    .execute();
}

export function insertContractEvent(
  db: Conn,
  row: { contractId: string; actorId: string | null; kind: string; payload: Record<string, unknown> },
) {
  return db
    .insertInto("contract_events")
    .values({
      contract_id: row.contractId,
      actor_id: row.actorId,
      kind: row.kind,
      payload: row.payload as never,
    })
    .execute();
}

export function insertPlatformFee(
  db: Conn,
  row: { contractId: string | null; milestoneId: string | null; amountMinor: number; rateBps: number; currency: string },
) {
  return db
    .insertInto("platform_fees")
    .values({
      contract_id: row.contractId,
      milestone_id: row.milestoneId,
      amount_minor: row.amountMinor,
      rate_bps: row.rateBps,
      currency: row.currency,
    })
    .execute();
}

export function insertTransaction(
  db: Conn,
  row: {
    userId: string;
    type: "milestone" | "commission" | "refund" | "withdrawal" | "topup" | "payout" | "payment";
    amountMinor: number;
    currency: string;
    counterpartyId: string | null;
    contractId: string | null;
    paymentId: string | null;
    description: string;
    status?: "pending" | "completed" | "failed";
  },
) {
  return db
    .insertInto("transactions")
    .values({
      user_id: row.userId,
      type: row.type,
      amount_minor: row.amountMinor,
      currency: row.currency,
      status: row.status ?? "completed",
      counterparty_id: row.counterpartyId,
      contract_id: row.contractId,
      payment_id: row.paymentId,
      description: row.description,
    })
    .execute();
}

export function bumpFreelancerEarnings(db: Conn, freelancerId: string, netMinor: number) {
  return sql`UPDATE freelancer_profiles SET earnings_minor = earnings_minor + ${netMinor}, updated_at = now() WHERE user_id = ${freelancerId}`.execute(
    db,
  );
}

export function bumpClientSpend(db: Conn, clientId: string, amountMinor: number) {
  return sql`UPDATE client_profiles SET spent_minor = spent_minor + ${amountMinor}, updated_at = now() WHERE user_id = ${clientId}`.execute(
    db,
  );
}

export interface TransactionFilters {
  type?: "milestone" | "commission" | "refund" | "withdrawal" | "topup" | "payout" | "payment";
  status?: "pending" | "completed" | "failed";
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
}

export function listTransactions(db: Conn, userId: string, filters: TransactionFilters) {
  let query = db
    .selectFrom("transactions")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(filters.limit)
    .offset(filters.offset);
  let countQuery = db
    .selectFrom("transactions")
    .where("user_id", "=", userId)
    .select((eb) => eb.fn.countAll<string>().as("count"));

  if (filters.type) {
    query = query.where("type", "=", filters.type);
    countQuery = countQuery.where("type", "=", filters.type);
  }
  if (filters.status) {
    query = query.where("status", "=", filters.status);
    countQuery = countQuery.where("status", "=", filters.status);
  }
  if (filters.dateFrom) {
    query = query.where("created_at", ">=", filters.dateFrom);
    countQuery = countQuery.where("created_at", ">=", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.where("created_at", "<=", filters.dateTo);
    countQuery = countQuery.where("created_at", "<=", filters.dateTo);
  }

  return Promise.all([query.execute(), countQuery.executeTakeFirstOrThrow()]).then(
    ([rows, countRow]) => ({ rows, total: Number(countRow.count) }),
  );
}

export function findTransactionOwned(db: Conn, id: string, userId: string) {
  return db
    .selectFrom("transactions")
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
}

/** Demo earnings breakdown, derived entirely from the transactions/payouts tables. Amounts are signed (+ credit / − debit). */
export async function earningsBreakdown(db: Conn, userId: string) {
  const balance = await sql<{ net: string | null; volume: string | null }>`
    SELECT COALESCE(SUM(amount_minor), 0)::text AS net, COALESCE(SUM(ABS(amount_minor)), 0)::text AS volume
    FROM transactions
    WHERE user_id = ${userId} AND status = 'completed'
  `.execute(db);

  const pending = await sql<{ pending: string | null }>`
    SELECT COALESCE(SUM(amount_minor), 0)::text AS pending
    FROM payouts
    WHERE user_id = ${userId} AND status IN ('pending', 'processing')
  `.execute(db);

  return {
    availableBalanceMinor: Number(balance.rows[0]?.net ?? 0),
    lifetimeVolumeMinor: Number(balance.rows[0]?.volume ?? 0),
    pendingPayoutsMinor: Number(pending.rows[0]?.pending ?? 0),
  };
}

export function insertProcessedWebhook(db: Conn, id: string, provider: "stripe" | "paystack", payload: Record<string, unknown>) {
  return sql`
    INSERT INTO processed_webhooks (id, provider, payload)
    VALUES (${id}, ${provider}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `.execute(db);
}

export function processedWebhookExists(db: Conn, id: string) {
  return db
    .selectFrom("processed_webhooks")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
}
