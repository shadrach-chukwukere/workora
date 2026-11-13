import { sql } from "kysely";
export async function getContractById(executor, contractId) {
    return executor.selectFrom("contracts").selectAll().where("id", "=", contractId).executeTakeFirst();
}
/** Locks the contract row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockContractById(trx, contractId) {
    return trx.selectFrom("contracts").selectAll().where("id", "=", contractId).forUpdate().executeTakeFirst();
}
const contractListSelect = [
    "contracts.id",
    "contracts.project_id",
    "contracts.client_id",
    "contracts.freelancer_id",
    "contracts.proposal_id",
    "contracts.title_snapshot",
    "contracts.total_minor",
    "contracts.currency",
    "contracts.status",
    "contracts.started_at",
    "contracts.ended_at",
    "contracts.created_at",
    "projects.title as project_title",
    "client_user.name as client_name",
    "client_user.image as client_image",
    "freelancer_user.name as freelancer_name",
    "freelancer_user.image as freelancer_image",
    "client_profile.company_name as client_company_name",
    "client_profile.spent_minor as client_spent_minor",
    "freelancer_profile.headline as freelancer_headline",
    "freelancer_profile.completed_count as freelancer_completed_count",
];
function contractListQuery(executor) {
    return executor
        .selectFrom("contracts")
        .innerJoin("projects", "projects.id", "contracts.project_id")
        .innerJoin("users as client_user", "client_user.id", "contracts.client_id")
        .innerJoin("users as freelancer_user", "freelancer_user.id", "contracts.freelancer_id")
        .leftJoin("client_profiles as client_profile", "client_profile.user_id", "contracts.client_id")
        .leftJoin("freelancer_profiles as freelancer_profile", "freelancer_profile.user_id", "contracts.freelancer_id")
        .select(contractListSelect);
}
export async function listContractsForUser(executor, input) {
    return contractListQuery(executor)
        .where((eb) => eb.or([eb("contracts.client_id", "=", input.userId), eb("contracts.freelancer_id", "=", input.userId)]))
        .$if(input.status !== undefined, (qb) => qb.where("contracts.status", "=", input.status))
        .orderBy("contracts.created_at", "desc")
        .limit(input.limit)
        .offset(input.offset)
        .execute();
}
export async function countContractsForUser(executor, input) {
    const row = await executor
        .selectFrom("contracts")
        .select(({ fn }) => fn.countAll().as("count"))
        .where((eb) => eb.or([eb("client_id", "=", input.userId), eb("freelancer_id", "=", input.userId)]))
        .$if(input.status !== undefined, (qb) => qb.where("status", "=", input.status))
        .executeTakeFirstOrThrow();
    return Number(row.count);
}
/** Milestones summary (counts + money) for a page of contract ids, grouped per contract. */
export async function summarizeMilestones(executor, contractIds) {
    if (contractIds.length === 0) {
        return new Map();
    }
    const result = await sql `
    SELECT contract_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'paid')::int AS paid,
           COALESCE(sum(amount_minor), 0) AS total_amount_minor,
           COALESCE(sum(amount_minor) FILTER (WHERE status = 'paid'), 0) AS paid_amount_minor
    FROM contract_milestones
    WHERE contract_id IN (${sql.join(contractIds)})
    GROUP BY contract_id
  `.execute(executor);
    const map = new Map();
    for (const row of result.rows) {
        map.set(row.contract_id, {
            total: Number(row.total),
            paid: Number(row.paid),
            total_amount_minor: Number(row.total_amount_minor),
            paid_amount_minor: Number(row.paid_amount_minor),
        });
    }
    return map;
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
export async function listDeliverables(executor, contractId, milestoneId) {
    return executor
        .selectFrom("contract_deliverables")
        .selectAll()
        .where("contract_id", "=", contractId)
        .$if(milestoneId !== undefined, (qb) => qb.where("milestone_id", "=", milestoneId))
        .orderBy("submitted_at", "asc")
        .execute();
}
export async function listContractEvents(executor, contractId) {
    return executor
        .selectFrom("contract_events")
        .selectAll()
        .where("contract_id", "=", contractId)
        .orderBy("created_at", "asc")
        .execute();
}
export async function countUnfinishedMilestones(executor, contractId) {
    const row = await executor
        .selectFrom("contract_milestones")
        .select(({ fn }) => fn.countAll().as("count"))
        .where("contract_id", "=", contractId)
        .where("status", "not in", ["paid", "cancelled"])
        .executeTakeFirstOrThrow();
    return Number(row.count);
}
export async function setContractCancelled(trx, contractId, reason) {
    return trx
        .updateTable("contracts")
        .set({ status: "cancelled", cancel_reason: reason, ended_at: new Date() })
        .where("id", "=", contractId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function setContractCompleted(trx, contractId) {
    return trx
        .updateTable("contracts")
        .set({ status: "completed", ended_at: new Date() })
        .where("id", "=", contractId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function incrementFreelancerCompletedCount(trx, freelancerId) {
    await sql `UPDATE freelancer_profiles SET completed_count = completed_count + 1 WHERE user_id = ${freelancerId}`.execute(trx);
}
/** client_profiles has no completed_count column; projects_count is its completion tally. */
export async function incrementClientProjectsCount(trx, clientId) {
    await sql `UPDATE client_profiles SET projects_count = projects_count + 1 WHERE user_id = ${clientId}`.execute(trx);
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
