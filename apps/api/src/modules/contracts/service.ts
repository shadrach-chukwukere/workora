import { db } from "../../database/connection.js";
import { conflict, forbidden, notFound } from "../../plugins/error-handler.js";
import type { AuthedUser } from "../../middleware/authenticate.js";
import { parsePage } from "../common/index.js";
import type { ListContractsQuery } from "./schemas.js";
import * as repo from "./repository.js";

type ContractListRow = Awaited<ReturnType<typeof repo.listContractsForUser>>[number];

function isParticipant(contract: { client_id: string; freelancer_id: string }, user: AuthedUser): boolean {
  // Spec: participants only (no admin override on contract detail/actions).
  return contract.client_id === user.id || contract.freelancer_id === user.id;
}

function toContractListDto(row: ContractListRow, viewerId: string, milestoneSummary?: { total: number; paid: number; total_amount_minor: number; paid_amount_minor: number }) {
  const viewerRole: "client" | "freelancer" = row.client_id === viewerId ? "client" : "freelancer";
  const counterpart =
    viewerRole === "client"
      ? { id: row.freelancer_id, name: row.freelancer_name, image: row.freelancer_image, headline: row.freelancer_headline }
      : { id: row.client_id, name: row.client_name, image: row.client_image, company_name: row.client_company_name };
  return {
    id: row.id,
    project_id: row.project_id,
    proposal_id: row.proposal_id,
    title_snapshot: row.title_snapshot,
    total_minor: row.total_minor,
    currency: row.currency,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
    project: { id: row.project_id, title: row.project_title },
    viewer_role: viewerRole,
    counterpart,
    milestones: milestoneSummary ?? { total: 0, paid: 0, total_amount_minor: 0, paid_amount_minor: 0 },
  };
}

/** GET /contracts */
export async function listContracts(user: AuthedUser, query: ListContractsQuery & { page?: string; perPage?: string; limit?: string }) {
  const dbi = await db();
  const { limit, offset, page } = parsePage(query);

  const [rows, total] = await Promise.all([
    repo.listContractsForUser(dbi, { userId: user.id, status: query.status, limit, offset }),
    repo.countContractsForUser(dbi, { userId: user.id, status: query.status }),
  ]);

  const summaries = await repo.summarizeMilestones(dbi, rows.map((r) => r.id));

  return {
    contracts: rows.map((row) => toContractListDto(row, user.id, summaries.get(row.id))),
    pagination: {
      page,
      perPage: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** GET /contracts/:id — participants only */
export async function getContractDetail(user: AuthedUser, contractId: string) {
  const dbi = await db();
  const contract = await repo.getContractById(dbi, contractId);
  if (!contract) {
    throw notFound("Contract not found");
  }
  if (!isParticipant(contract, user)) {
    throw forbidden("You are not a participant of this contract");
  }

  const viewerRole: "client" | "freelancer" = contract.client_id === user.id ? "client" : "freelancer";

  const [milestones, deliverables, events, project] = await Promise.all([
    repo.listMilestones(dbi, contractId),
    repo.listDeliverables(dbi, contractId),
    repo.listContractEvents(dbi, contractId),
    dbi
      .selectFrom("projects")
      .select(["id", "title", "status"])
      .where("id", "=", contract.project_id)
      .executeTakeFirst(),
  ]);

  // Counterparts need names; fetch both light-weight user rows.
  const people = await dbi
    .selectFrom("users")
    .select(["id", "name", "image"])
    .where("id", "in", [contract.client_id, contract.freelancer_id])
    .execute();
  const byId = new Map(people.map((p) => [p.id, p]));

  const counterpartId = viewerRole === "client" ? contract.freelancer_id : contract.client_id;

  return {
    contract: {
      id: contract.id,
      project_id: contract.project_id,
      proposal_id: contract.proposal_id,
      title_snapshot: contract.title_snapshot,
      total_minor: contract.total_minor,
      currency: contract.currency,
      status: contract.status,
      cancel_reason: contract.cancel_reason,
      started_at: contract.started_at,
      ended_at: contract.ended_at,
      created_at: contract.created_at,
      updated_at: contract.updated_at,
      project,
      viewer_role: viewerRole,
      counterpart: byId.get(counterpartId) ?? { id: counterpartId, name: null, image: null },
      participants: {
        client: byId.get(contract.client_id) ?? { id: contract.client_id, name: null, image: null },
        freelancer: byId.get(contract.freelancer_id) ?? { id: contract.freelancer_id, name: null, image: null },
      },
      milestones,
      deliverables,
      events,
    },
  };
}

/** POST /contracts/:id/cancel — participants; active -> cancelled (reason stored). */
export async function cancelContract(user: AuthedUser, contractId: string, reason: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    const contract = await repo.lockContractById(trx, contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    if (!isParticipant(contract, user)) {
      throw forbidden("You are not a participant of this contract");
    }
    if (contract.status !== "active") {
      throw conflict("Only active contracts can be cancelled", { status: contract.status });
    }

    const updated = await repo.setContractCancelled(trx, contractId, reason);

    await repo.insertContractEvent(trx, {
      contractId,
      actorId: user.id,
      kind: "contract.cancelled",
      payload: { reason, status: "cancelled" },
    });

    const clientBody = `The client cancelled the contract "${contract.title_snapshot}". Reason: ${reason}`;
    const freelancerBody = `The freelancer cancelled the contract "${contract.title_snapshot}". Reason: ${reason}`;
    await repo.insertNotification(trx, {
      userId: contract.client_id,
      type: "contract",
      title: "Contract cancelled",
      body: user.id === contract.client_id ? `You cancelled the contract "${contract.title_snapshot}".` : clientBody,
      url: `/contracts/${contractId}`,
      entityType: "contract",
      entityId: contractId,
    });
    await repo.insertNotification(trx, {
      userId: contract.freelancer_id,
      type: "contract",
      title: "Contract cancelled",
      body: user.id === contract.freelancer_id ? `You cancelled the contract "${contract.title_snapshot}".` : freelancerBody,
      url: `/contracts/${contractId}`,
      entityType: "contract",
      entityId: contractId,
    });

    return { contract: updated };
  });
}

/** POST /contracts/:id/complete — client only; active + all milestones paid|cancelled. */
export async function completeContract(user: AuthedUser, contractId: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    const contract = await repo.lockContractById(trx, contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    if (contract.client_id !== user.id) {
      throw forbidden("Only the client can complete this contract");
    }
    if (contract.status !== "active") {
      throw conflict("Only active contracts can be completed", { status: contract.status });
    }

    const unfinished = await repo.countUnfinishedMilestones(trx, contractId);
    if (unfinished > 0) {
      throw conflict("All milestones must be paid or cancelled before completing the contract", { unfinishedMilestones: unfinished });
    }

    const updated = await repo.setContractCompleted(trx, contractId);

    await repo.incrementFreelancerCompletedCount(trx, contract.freelancer_id);
    await repo.incrementClientProjectsCount(trx, contract.client_id);

    await repo.insertContractEvent(trx, {
      contractId,
      actorId: user.id,
      kind: "contract.completed",
      payload: { completedAt: new Date().toISOString() },
    });

    await repo.insertNotification(trx, {
      userId: contract.freelancer_id,
      type: "contract",
      title: "Contract completed",
      body: `The client marked the contract "${contract.title_snapshot}" as completed.`,
      url: `/contracts/${contractId}`,
      entityType: "contract",
      entityId: contractId,
    });

    return { contract: updated };
  });
}
