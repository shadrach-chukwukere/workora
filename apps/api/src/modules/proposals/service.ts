import type { Transaction } from "kysely";
import { db } from "../../database/connection.js";
import type { DB } from "../../database/types.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../plugins/error-handler.js";
import type { AuthedUser } from "../../middleware/authenticate.js";
import { parsePage } from "../common/index.js";
import type { CreateProposalInput, MyProposalsQuery } from "./schemas.js";
import * as repo from "./repository.js";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

type JoinedProposalRow = Awaited<ReturnType<typeof repo.getJoinedProposalById>> extends infer R ? NonNullable<R> : never;

function toProposalDto(row: JoinedProposalRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    freelancer_id: row.freelancer_id,
    cover_letter: row.cover_letter,
    bid_type: row.bid_type,
    bid_amount_minor: row.bid_amount_minor,
    duration_days: row.duration_days,
    status: row.status,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    project: {
      id: row.project_id,
      title: row.project_title,
      summary: row.project_summary,
      status: row.project_status,
      budget_type: row.project_budget_type,
      budget_min_minor: row.project_budget_min_minor,
      budget_max_minor: row.project_budget_max_minor,
      currency: row.project_currency,
      published_at: row.project_published_at,
      client_id: row.project_client_id,
    },
    client: {
      id: row.project_client_id,
      name: row.client_name,
      image: row.client_image,
      company_name: row.client_company_name,
    },
  };
}

/** POST /projects/:id/proposals */
export async function createProposal(user: AuthedUser, projectId: string, input: CreateProposalInput) {
  const dbi = await db();

  return dbi.transaction().execute(async (trx) => {
    // Lock the project so its status can't flip between the check and the insert.
    const project = await repo.lockProjectById(trx, projectId);
    if (!project) {
      throw notFound("Project not found");
    }
    if (project.status !== "open") {
      throw badRequest("Project is not open for proposals", { projectStatus: project.status });
    }
    if (project.client_id === user.id) {
      throw forbidden("You cannot submit a proposal on a project you posted");
    }

    const existing = await repo.findProposalByProjectAndFreelancer(trx, projectId, user.id);
    if (existing) {
      throw conflict("You have already submitted a proposal for this project", { proposalId: existing.id });
    }

    let proposal;
    try {
      proposal = await repo.insertProposal(trx, {
        projectId,
        freelancerId: user.id,
        coverLetter: input.coverLetter,
        bidType: input.bidType,
        bidAmountMinor: input.bidAmountMinor,
        durationDays: input.durationDays,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("You have already submitted a proposal for this project");
      }
      throw error;
    }

    await repo.incrementProjectProposalsCount(trx, projectId);
    return proposal;
  });
}

/** GET /proposals/me */
export async function listMyProposals(user: AuthedUser, query: MyProposalsQuery & { page?: string; perPage?: string; limit?: string }) {
  const dbi = await db();
  const { limit, offset, page } = parsePage(query);
  const sort = query.sort ?? "newest";

  const [rows, total] = await Promise.all([
    repo.listProposalsByFreelancer(dbi, { freelancerId: user.id, status: query.status, sort, limit, offset }),
    repo.countProposalsByFreelancer(dbi, { freelancerId: user.id, status: query.status }),
  ]);

  return {
    proposals: rows.map(toProposalDto),
    pagination: {
      page,
      perPage: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** DELETE /proposals/:id — owner freelancer or admin; pending|shortlisted -> withdrawn */
export async function withdrawProposal(user: AuthedUser, proposalId: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    const proposal = await repo.lockProposalById(trx, proposalId);
    if (!proposal) {
      throw notFound("Proposal not found");
    }
    const isAdmin = user.accountType === "admin";
    const isOwner = proposal.freelancer_id === user.id;
    if (!isAdmin && !isOwner) {
      throw forbidden("You can only withdraw your own proposals");
    }
    if (proposal.status !== "pending" && proposal.status !== "shortlisted") {
      throw conflict("Only pending or shortlisted proposals can be withdrawn", { status: proposal.status });
    }
    const updated = await repo.updateProposalStatus(trx, proposalId, "withdrawn");
    await repo.decrementProjectProposalsCount(trx, proposal.project_id);
    return updated;
  });
}

/** Loads the proposal (locked) + its project; verifies requester is the owning project's client. Must be called in a transaction. */
async function lockClientOwnedProposal(trx: Transaction<DB>, user: AuthedUser, proposalId: string) {
  const proposal = await repo.lockProposalById(trx, proposalId);
  if (!proposal) {
    throw notFound("Proposal not found");
  }
  const project = await repo.getProjectById(trx, proposal.project_id);
  if (!project) {
    throw notFound("Project not found");
  }
  if (project.client_id !== user.id) {
    throw forbidden("Only the project owner can manage proposals on this project");
  }
  return { proposal, project };
}

function assertShortlistable(status: string, action: string): void {
  if (status !== "pending" && status !== "shortlisted") {
    throw conflict(`Only pending or shortlisted proposals can be ${action}`, { status });
  }
}

/** POST /proposals/:id/shortlist — project owner client only */
export async function shortlistProposal(user: AuthedUser, proposalId: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    const { proposal, project } = await lockClientOwnedProposal(trx, user, proposalId);
    assertShortlistable(proposal.status, "shortlisted");
    const updated = await repo.updateProposalStatus(trx, proposalId, "shortlisted");
    await repo.insertNotification(trx, {
      userId: proposal.freelancer_id,
      type: "proposal",
      title: "Your proposal was shortlisted",
      body: `The client shortlisted your proposal for "${project.title}".`,
      url: `/proposals/${proposalId}`,
      entityType: "proposal",
      entityId: proposalId,
    });
    return updated;
  });
}

/** POST /proposals/:id/reject — project owner client only */
export async function rejectProposal(user: AuthedUser, proposalId: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    const { proposal } = await lockClientOwnedProposal(trx, user, proposalId);
    assertShortlistable(proposal.status, "rejected");
    return repo.updateProposalStatus(trx, proposalId, "rejected");
  });
}

/** POST /proposals/:id/accept — project owner client only; fully atomic. */
export async function acceptProposal(user: AuthedUser, proposalId: string) {
  const dbi = await db();
  return dbi.transaction().execute(async (trx) => {
    // Lock proposal, then the project it belongs to (consistent ordering).
    const proposal = await repo.lockProposalById(trx, proposalId);
    if (!proposal) {
      throw notFound("Proposal not found");
    }
    const project = await repo.lockProjectById(trx, proposal.project_id);
    if (!project) {
      throw notFound("Project not found");
    }

    if (project.client_id !== user.id) {
      throw forbidden("Only the project owner can accept this proposal");
    }
    if (proposal.status !== "pending" && proposal.status !== "shortlisted") {
      throw conflict("Only pending or shortlisted proposals can be accepted", { status: proposal.status });
    }
    if (project.status !== "open") {
      throw conflict("Project is no longer open for proposals", { projectStatus: project.status });
    }

    await repo.updateProposalStatus(trx, proposal.id, "accepted");
    await repo.markProjectInProgress(trx, project.id);

    const contract = await repo.insertContract(trx, {
      projectId: project.id,
      clientId: project.client_id,
      freelancerId: proposal.freelancer_id,
      proposalId: proposal.id,
      titleSnapshot: project.title,
      totalMinor: proposal.bid_amount_minor,
      currency: "USD",
    });

    await repo.insertContractEvent(trx, {
      contractId: contract.id,
      actorId: user.id,
      kind: "contract.created",
      payload: {
        contractId: contract.id,
        projectId: project.id,
        proposalId: proposal.id,
        projectTitle: project.title,
        totalMinor: contract.total_minor,
        currency: contract.currency,
      },
    });
    await repo.insertContractEvent(trx, {
      contractId: contract.id,
      actorId: user.id,
      kind: "proposal.accepted",
      payload: {
        contractId: contract.id,
        proposalId: proposal.id,
        projectId: project.id,
        freelancerId: proposal.freelancer_id,
        bidAmountMinor: proposal.bid_amount_minor,
      },
    });

    await repo.insertNotification(trx, {
      userId: proposal.freelancer_id,
      type: "contract",
      title: "Your proposal was accepted",
      body: `The client accepted your proposal for "${project.title}". Your contract is now active.`,
      url: `/contracts/${contract.id}`,
      entityType: "contract",
      entityId: contract.id,
    });

    return { contract };
  });
}

/** GET /proposals/:id — owner freelancer, project-owning client, or admin */
export async function getProposalDetail(user: AuthedUser, proposalId: string) {
  const dbi = await db();
  const row = await repo.getJoinedProposalById(dbi, proposalId);
  if (!row) {
    throw notFound("Proposal not found");
  }
  const isAdmin = user.accountType === "admin";
  const isProposalOwner = row.freelancer_id === user.id;
  const isProjectOwner = row.project_client_id === user.id;
  if (!isAdmin && !isProposalOwner && !isProjectOwner) {
    throw forbidden("You do not have access to this proposal");
  }
  const dto = toProposalDto(row);
  return {
    proposal: {
      ...dto,
      project: { ...dto.project, description: row.project_description },
    },
  };
}
