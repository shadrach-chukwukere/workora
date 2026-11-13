import { sql } from "kysely";
const joinedProposalSelect = [
    "proposals.id",
    "proposals.project_id",
    "proposals.freelancer_id",
    "proposals.cover_letter",
    "proposals.bid_type",
    "proposals.bid_amount_minor",
    "proposals.duration_days",
    "proposals.status",
    "proposals.submitted_at",
    "proposals.updated_at",
    "projects.title as project_title",
    "projects.summary as project_summary",
    "projects.description as project_description",
    "projects.status as project_status",
    "projects.budget_type as project_budget_type",
    "projects.budget_min_minor as project_budget_min_minor",
    "projects.budget_max_minor as project_budget_max_minor",
    "projects.currency as project_currency",
    "projects.client_id as project_client_id",
    "projects.published_at as project_published_at",
    "client_user.name as client_name",
    "client_user.image as client_image",
    "client_profile.company_name as client_company_name",
];
export async function getFreelancerVerified(executor, userId) {
    const row = await executor
        .selectFrom("freelancer_profiles")
        .select("verified_identity")
        .where("user_id", "=", userId)
        .executeTakeFirst();
    return row?.verified_identity === true;
}
export async function getProjectById(executor, projectId) {
    return executor.selectFrom("projects").selectAll().where("id", "=", projectId).executeTakeFirst();
}
/** Locks the project row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockProjectById(trx, projectId) {
    return trx.selectFrom("projects").selectAll().where("id", "=", projectId).forUpdate().executeTakeFirst();
}
export async function getProposalById(executor, proposalId) {
    return executor.selectFrom("proposals").selectAll().where("id", "=", proposalId).executeTakeFirst();
}
/** Locks the proposal row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockProposalById(trx, proposalId) {
    return trx.selectFrom("proposals").selectAll().where("id", "=", proposalId).forUpdate().executeTakeFirst();
}
export async function findProposalByProjectAndFreelancer(executor, projectId, freelancerId) {
    return executor
        .selectFrom("proposals")
        .selectAll()
        .where("project_id", "=", projectId)
        .where("freelancer_id", "=", freelancerId)
        .executeTakeFirst();
}
export async function insertProposal(executor, input) {
    return executor
        .insertInto("proposals")
        .values({
        project_id: input.projectId,
        freelancer_id: input.freelancerId,
        cover_letter: input.coverLetter,
        bid_type: input.bidType,
        bid_amount_minor: input.bidAmountMinor,
        duration_days: input.durationDays ?? null,
    })
        .returningAll()
        .executeTakeFirstOrThrow();
}
/** Proposals of one freelancer, joined with project + client summary. */
export async function listProposalsByFreelancer(executor, input) {
    return executor
        .selectFrom("proposals")
        .innerJoin("projects", "projects.id", "proposals.project_id")
        .innerJoin("users as client_user", "client_user.id", "projects.client_id")
        .leftJoin("client_profiles as client_profile", "client_profile.user_id", "projects.client_id")
        .select(joinedProposalSelect)
        .where("proposals.freelancer_id", "=", input.freelancerId)
        .$if(input.status !== undefined, (qb) => qb.where("proposals.status", "=", input.status))
        .orderBy("proposals.submitted_at", input.sort === "oldest" ? "asc" : "desc")
        .limit(input.limit)
        .offset(input.offset)
        .execute();
}
export async function countProposalsByFreelancer(executor, input) {
    const row = await executor
        .selectFrom("proposals")
        .select(({ fn }) => fn.countAll().as("count"))
        .where("freelancer_id", "=", input.freelancerId)
        .$if(input.status !== undefined, (qb) => qb.where("status", "=", input.status))
        .executeTakeFirstOrThrow();
    return Number(row.count);
}
/** Single joined proposal row (project + client summary). */
export async function getJoinedProposalById(executor, proposalId) {
    return executor
        .selectFrom("proposals")
        .innerJoin("projects", "projects.id", "proposals.project_id")
        .innerJoin("users as client_user", "client_user.id", "projects.client_id")
        .leftJoin("client_profiles as client_profile", "client_profile.user_id", "projects.client_id")
        .select(joinedProposalSelect)
        .where("proposals.id", "=", proposalId)
        .executeTakeFirst();
}
export async function updateProposalStatus(executor, proposalId, status) {
    return executor
        .updateTable("proposals")
        .set({ status })
        .where("id", "=", proposalId)
        .returningAll()
        .executeTakeFirstOrThrow();
}
export async function incrementProjectProposalsCount(executor, projectId) {
    await sql `UPDATE projects SET proposals_count = proposals_count + 1 WHERE id = ${projectId}`.execute(executor);
}
export async function decrementProjectProposalsCount(executor, projectId) {
    await sql `UPDATE projects SET proposals_count = GREATEST(proposals_count - 1, 0) WHERE id = ${projectId}`.execute(executor);
}
/** Recounts and persists the project's proposals_count. */
export async function recountProjectProposalsCount(executor, projectId) {
    await sql `UPDATE projects SET proposals_count = (SELECT count(*)::int FROM proposals WHERE project_id = ${projectId}) WHERE id = ${projectId}`.execute(executor);
}
export async function markProjectInProgress(trx, projectId) {
    await trx.updateTable("projects").set({ status: "in_progress" }).where("id", "=", projectId).execute();
    await recountProjectProposalsCount(trx, projectId);
}
export async function insertContract(trx, input) {
    return trx
        .insertInto("contracts")
        .values({
        project_id: input.projectId,
        client_id: input.clientId,
        freelancer_id: input.freelancerId,
        proposal_id: input.proposalId,
        title_snapshot: input.titleSnapshot,
        total_minor: input.totalMinor,
        currency: input.currency ?? "USD",
        status: "active",
    })
        .returningAll()
        .executeTakeFirstOrThrow();
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
