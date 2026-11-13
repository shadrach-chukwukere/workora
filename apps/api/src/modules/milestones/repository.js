import { sql } from "kysely";
export async function getContractById(executor, contractId) {
    return executor.selectFrom("contracts").selectAll().where("id", "=", contractId).executeTakeFirst();
}
/** Locks the contract row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockContractById(trx, contractId) {
    return trx.selectFrom("contracts").selectAll().where("id", "=", contractId).forUpdate().executeTakeFirst();
}
export async function listMilestones(executor, contractId) {
    return executor
        .selectFrom("contract_milestones")
        .selectAll()
        .where("contract_id", "=", contractId)
        .orderBy("sequencing", "asc")
        .orderBy("created_at", "asc")
        .execute();
}
/** Sum of non-cancelled milestone amounts for a contract. */
export async function sumActiveMilestones(executor, contractId) {
    const row = await executor
        .selectFrom("contract_milestones")
        .select(({ fn }) => fn.sum("amount_minor").as("sum"))
        .where("contract_id", "=", contractId)
        .where("status", "!=", "cancelled")
        .executeTakeFirstOrThrow();
    return row.sum === null || row.sum === undefined ? 0 : Number(row.sum);
}
export async function maxSequencing(executor, contractId) {
    const row = await executor
        .selectFrom("contract_milestones")
        .select(({ fn }) => fn.max("sequencing").as("max_seq"))
        .where("contract_id", "=", contractId)
        .executeTakeFirst();
    return Number(row?.max_seq ?? 0) || 0;
}
export async function insertMilestone(executor, input) {
    return executor
        .insertInto("contract_milestones")
        .values({
        contract_id: input.contractId,
        title: input.title,
        description: input.description ?? "",
        amount_minor: input.amountMinor,
        due_date: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
        sequencing: input.sequencing,
        status: "upcoming",
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function getMilestoneById(executor, milestoneId) {
    return executor.selectFrom("contract_milestones").selectAll().where("id", "=", milestoneId).executeTakeFirst();
}
/** Locks the milestone row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockMilestoneById(trx, milestoneId) {
    return trx.selectFrom("contract_milestones").selectAll().where("id", "=", milestoneId).forUpdate().executeTakeFirst();
}
export async function markMilestoneInReview(trx, milestoneId) {
    return trx
        .updateTable("contract_milestones")
        .set({ status: "in_review", in_review_at: new Date() })
        .where("id", "=", milestoneId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function markMilestonePaid(trx, milestoneId) {
    const now = new Date();
    return trx
        .updateTable("contract_milestones")
        .set({ status: "paid", approved_at: now, paid_at: now })
        .where("id", "=", milestoneId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function markMilestoneRevision(trx, milestoneId) {
    return trx
        .updateTable("contract_milestones")
        .set({ status: "revision" })
        .where("id", "=", milestoneId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function insertDeliverable(executor, input) {
    return executor
        .insertInto("contract_deliverables")
        .values({
        contract_id: input.contractId,
        milestone_id: input.milestoneId,
        title: input.title,
        note: input.note ?? "",
        url: input.url ?? null,
        submitted_by: input.submittedBy,
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function listDeliverables(executor, contractId, milestoneId) {
    return executor
        .selectFrom("contract_deliverables")
        .selectAll()
        .where("contract_id", "=", contractId)
        .where("milestone_id", "=", milestoneId)
        .orderBy("submitted_at", "asc")
        .execute();
}
export async function insertPlatformFee(executor, input) {
    return executor
        .insertInto("platform_fees")
        .values({
        contract_id: input.contractId,
        milestone_id: input.milestoneId,
        amount_minor: input.amountMinor,
        rate_bps: input.rateBps,
        currency: input.currency,
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function insertTransaction(executor, input) {
    return executor
        .insertInto("transactions")
        .values({
        user_id: input.userId,
        type: input.type,
        amount_minor: input.amountMinor,
        currency: input.currency,
        status: input.status ?? "completed",
        counterparty_id: input.counterpartyId ?? null,
        contract_id: input.contractId ?? null,
        description: input.description,
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function addFreelancerEarnings(trx, freelancerId, netMinor) {
    await sql `UPDATE freelancer_profiles SET earnings_minor = earnings_minor + ${netMinor} WHERE user_id = ${freelancerId}`.execute(trx);
}
/** Mirrors the payment from the client's spend ledger. */
export async function addClientSpent(trx, clientId, grossMinor) {
    await sql `UPDATE client_profiles SET spent_minor = spent_minor + ${grossMinor} WHERE user_id = ${clientId}`.execute(trx);
}
export async function insertContractEvent(executor, input) {
    await executor
        .insertInto("contract_events")
        .values({
        contract_id: input.contractId,
        actor_id: input.actorId,
        kind: input.kind,
        payload: input.payload,
    })
        .execute();
}
export async function insertNotification(executor, input) {
    await executor
        .insertInto("notifications")
        .values({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
    })
        .execute();
}
