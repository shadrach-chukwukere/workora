import type { Kysely, Transaction } from "kysely";
import { sql } from "kysely";
import type { DB } from "../../database/types.js";

export type Executor = Kysely<DB> | Transaction<DB>;

export async function getContractById(executor: Executor, contractId: string) {
  return executor.selectFrom("contracts").selectAll().where("id", "=", contractId).executeTakeFirst();
}

/** Locks the contract row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockContractById(trx: Transaction<DB>, contractId: string) {
  return trx.selectFrom("contracts").selectAll().where("id", "=", contractId).forUpdate().executeTakeFirst();
}

export async function listMilestones(executor: Executor, contractId: string) {
  return executor
    .selectFrom("contract_milestones")
    .selectAll()
    .where("contract_id", "=", contractId)
    .orderBy("sequencing", "asc")
    .orderBy("created_at", "asc")
    .execute();
}

/** Sum of non-cancelled milestone amounts for a contract. */
export async function sumActiveMilestones(executor: Executor, contractId: string): Promise<number> {
  const row = await executor
    .selectFrom("contract_milestones")
    .select(({ fn }) => fn.sum("amount_minor").as("sum"))
    .where("contract_id", "=", contractId)
    .where("status", "!=", "cancelled")
    .executeTakeFirstOrThrow();
  return row.sum === null || row.sum === undefined ? 0 : Number(row.sum);
}

export async function maxSequencing(executor: Executor, contractId: string): Promise<number> {
  const row = await executor
    .selectFrom("contract_milestones")
    .select(({ fn }) => fn.max("sequencing").as("max_seq"))
    .where("contract_id", "=", contractId)
    .executeTakeFirst();
  return Number(row?.max_seq ?? 0) || 0;
}

export async function insertMilestone(
  executor: Executor,
  input: { contractId: string; title: string; description?: string | undefined; amountMinor: number; dueDate?: string | undefined; sequencing: number },
) {
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

export async function getMilestoneById(executor: Executor, milestoneId: string) {
  return executor.selectFrom("contract_milestones").selectAll().where("id", "=", milestoneId).executeTakeFirst();
}

/** Locks the milestone row (SELECT ... FOR UPDATE). Must be called inside a transaction. */
export async function lockMilestoneById(trx: Transaction<DB>, milestoneId: string) {
  return trx.selectFrom("contract_milestones").selectAll().where("id", "=", milestoneId).forUpdate().executeTakeFirst();
}

export async function markMilestoneInReview(trx: Transaction<DB>, milestoneId: string) {
  return trx
    .updateTable("contract_milestones")
    .set({ status: "in_review", in_review_at: new Date() })
    .where("id", "=", milestoneId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function markMilestonePaid(trx: Transaction<DB>, milestoneId: string) {
  const now = new Date();
  return trx
    .updateTable("contract_milestones")
    .set({ status: "paid", approved_at: now, paid_at: now })
    .where("id", "=", milestoneId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function markMilestoneRevision(trx: Transaction<DB>, milestoneId: string) {
  return trx
    .updateTable("contract_milestones")
    .set({ status: "revision" })
    .where("id", "=", milestoneId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function insertDeliverable(
  executor: Executor,
  input: { contractId: string; milestoneId: string; title: string; note?: string | undefined; url?: string | undefined; submittedBy: string },
) {
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

export async function listDeliverables(executor: Executor, contractId: string, milestoneId: string) {
  return executor
    .selectFrom("contract_deliverables")
    .selectAll()
    .where("contract_id", "=", contractId)
    .where("milestone_id", "=", milestoneId)
    .orderBy("submitted_at", "asc")
    .execute();
}

export async function insertPlatformFee(
  executor: Executor,
  input: { contractId: string; milestoneId: string; amountMinor: number; rateBps: number; currency: string },
) {
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

export async function insertTransaction(
  executor: Executor,
  input: {
    userId: string;
    type: "milestone" | "commission" | "refund" | "withdrawal" | "topup" | "payout" | "payment";
    amountMinor: number;
    currency: string;
    status?: "pending" | "completed" | "failed" | undefined;
    counterpartyId?: string | null | undefined;
    contractId?: string | null | undefined;
    description: string;
  },
) {
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

export async function addFreelancerEarnings(trx: Transaction<DB>, freelancerId: string, netMinor: number): Promise<void> {
  await sql`UPDATE freelancer_profiles SET earnings_minor = earnings_minor + ${netMinor} WHERE user_id = ${freelancerId}`.execute(trx);
}

/** Mirrors the payment from the client's spend ledger. */
export async function addClientSpent(trx: Transaction<DB>, clientId: string, grossMinor: number): Promise<void> {
  await sql`UPDATE client_profiles SET spent_minor = spent_minor + ${grossMinor} WHERE user_id = ${clientId}`.execute(trx);
}

export async function insertContractEvent(
  executor: Executor,
  input: { contractId: string; actorId: string | null; kind: string; payload: Record<string, unknown> },
) {
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

type NotificationType = "proposal" | "contract" | "message" | "payment" | "review" | "verification" | "system" | "dispute";

export async function insertNotification(
  executor: Executor,
  input: { userId: string; type: NotificationType; title: string; body: string; url?: string | null; entityType?: string | null; entityId?: string | null },
) {
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
