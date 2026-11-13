import { sql } from "kysely";
export function listPaymentMethods(db, userId) {
    return db
        .selectFrom("payment_methods")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("is_default", "desc")
        .orderBy("created_at", "asc")
        .execute();
}
/** Lazily seeds the demo VISA ····4169 row for a brand-new user (idempotent via UNIQUE(user_id, provider_method_id)). */
export async function seedDemoPaymentMethodIfEmpty(db, userId) {
    await sql `
    INSERT INTO payment_methods (user_id, provider, provider_method_id, brand, last_four, exp_month, exp_year, is_default)
    SELECT ${userId}, 'stripe', 'demo-visa-4169', 'VISA (demo)', '4169', 12, ${new Date().getFullYear() + 3}, true
    WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE user_id = ${userId})
    ON CONFLICT (user_id, provider_method_id) DO NOTHING
  `.execute(db);
}
export function countPaymentMethods(db, userId) {
    return db
        .selectFrom("payment_methods")
        .where("user_id", "=", userId)
        .select((eb) => eb.fn.countAll().as("count"))
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count));
}
export function insertPaymentMethod(db, row) {
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
export function findPaymentMethodOwned(db, id, userId) {
    return db
        .selectFrom("payment_methods")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
}
export function deletePaymentMethod(db, id) {
    return db.deleteFrom("payment_methods").where("id", "=", id).execute();
}
export function insertPayment(db, row) {
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
        metadata: row.metadata,
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
export function findPaymentById(db, id) {
    return db.selectFrom("payments").selectAll().where("id", "=", id).executeTakeFirst();
}
export function findPaymentByProviderRef(db, providerRef) {
    return db.selectFrom("payments").selectAll().where("provider_ref", "=", providerRef).executeTakeFirst();
}
export function findPaymentOwnedByProviderRef(db, providerRef, userId) {
    return db
        .selectFrom("payments")
        .selectAll()
        .where("provider_ref", "=", providerRef)
        .where("user_id", "=", userId)
        .executeTakeFirst();
}
export function markPaymentSucceeded(db, id) {
    return db
        .updateTable("payments")
        .set({ status: "succeeded", updated_at: new Date() })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst();
}
export function findMilestoneWithContract(db, milestoneId) {
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
export function findContractById(db, id) {
    return db.selectFrom("contracts").selectAll().where("id", "=", id).executeTakeFirst();
}
export function setMilestoneStatus(db, milestoneId, status, timestampColumn) {
    return db
        .updateTable("contract_milestones")
        .set({ status, [timestampColumn]: new Date(), updated_at: new Date() })
        .where("id", "=", milestoneId)
        .execute();
}
export function insertContractEvent(db, row) {
    return db
        .insertInto("contract_events")
        .values({
        contract_id: row.contractId,
        actor_id: row.actorId,
        kind: row.kind,
        payload: row.payload,
    })
        .execute();
}
export function insertPlatformFee(db, row) {
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
export function insertTransaction(db, row) {
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
export function bumpFreelancerEarnings(db, freelancerId, netMinor) {
    return sql `UPDATE freelancer_profiles SET earnings_minor = earnings_minor + ${netMinor}, updated_at = now() WHERE user_id = ${freelancerId}`.execute(db);
}
export function bumpClientSpend(db, clientId, amountMinor) {
    return sql `UPDATE client_profiles SET spent_minor = spent_minor + ${amountMinor}, updated_at = now() WHERE user_id = ${clientId}`.execute(db);
}
export function listTransactions(db, userId, filters) {
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
        .select((eb) => eb.fn.countAll().as("count"));
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
    return Promise.all([query.execute(), countQuery.executeTakeFirstOrThrow()]).then(([rows, countRow]) => ({ rows, total: Number(countRow.count) }));
}
export function findTransactionOwned(db, id, userId) {
    return db
        .selectFrom("transactions")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
}
/** Demo earnings breakdown, derived entirely from the transactions/payouts tables. Amounts are signed (+ credit / − debit). */
export async function earningsBreakdown(db, userId) {
    const balance = await sql `
    SELECT COALESCE(SUM(amount_minor), 0)::text AS net, COALESCE(SUM(ABS(amount_minor)), 0)::text AS volume
    FROM transactions
    WHERE user_id = ${userId} AND status = 'completed'
  `.execute(db);
    const pending = await sql `
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
export function insertProcessedWebhook(db, id, provider, payload) {
    return sql `
    INSERT INTO processed_webhooks (id, provider, payload)
    VALUES (${id}, ${provider}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `.execute(db);
}
export function processedWebhookExists(db, id) {
    return db
        .selectFrom("processed_webhooks")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();
}
