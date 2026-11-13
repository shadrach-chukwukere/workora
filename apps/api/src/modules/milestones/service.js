import { db } from "../../database/connection.js";
import { badRequest, conflict, forbidden, notFound } from "../../plugins/error-handler.js";
import * as repo from "./repository.js";
const PLATFORM_FEE_RATE_BPS = 800; // 8%
function assertParticipant(contract, user) {
    // Spec: all milestone endpoints require contract participation (no admin override).
    const isParticipant = contract.client_id === user.id || contract.freelancer_id === user.id;
    if (!isParticipant) {
        throw forbidden("You are not a participant of this contract");
    }
}
/** Shared gate: contract must exist and the caller must participate. */
async function loadContractForUser(dbi, user, contractId) {
    const contract = await repo.getContractById(dbi, contractId);
    if (!contract) {
        throw notFound("Contract not found");
    }
    assertParticipant(contract, user);
    return contract;
}
/** Loads a milestone that must belong to the contract. */
async function loadMilestoneForContract(dbi, contractId, milestoneId) {
    const milestone = await repo.getMilestoneById(dbi, milestoneId);
    if (!milestone || milestone.contract_id !== contractId) {
        throw notFound("Milestone not found");
    }
    return milestone;
}
/** POST /contracts/:contractId/milestones — contract client, contract active. */
export async function createMilestone(user, contractId, input) {
    const dbi = await db();
    // Fail fast outside the transaction with a plain read...
    const contract = await loadContractForUser(dbi, user, contractId);
    if (contract.client_id !== user.id) {
        throw forbidden("Only the client of this contract can create milestones");
    }
    if (contract.status !== "active") {
        throw conflict("Milestones can only be added to active contracts", { status: contract.status });
    }
    // ...then lock the contract and re-check inside the transaction so concurrent
    // creates cannot both pass the "sum must not exceed contract total" gate.
    return dbi.transaction().execute(async (trx) => {
        const locked = await repo.lockContractById(trx, contractId);
        if (!locked) {
            throw notFound("Contract not found");
        }
        if (locked.client_id !== user.id) {
            throw forbidden("Only the client of this contract can create milestones");
        }
        if (locked.status !== "active") {
            throw conflict("Milestones can only be added to active contracts", { status: locked.status });
        }
        const allocated = await repo.sumActiveMilestones(trx, contractId);
        if (allocated + input.amountMinor > locked.total_minor) {
            throw badRequest("Milestones exceed the contract total", {
                contractTotalMinor: locked.total_minor,
                allocatedMinor: allocated,
                requestedMinor: input.amountMinor,
            });
        }
        const sequencing = input.sequencing ?? (await repo.maxSequencing(trx, contractId)) + 1;
        const created = await repo.insertMilestone(trx, {
            contractId,
            title: input.title,
            description: input.description,
            amountMinor: input.amountMinor,
            dueDate: input.dueDate,
            sequencing,
        });
        await repo.insertContractEvent(trx, {
            contractId,
            actorId: user.id,
            kind: "milestone.created",
            payload: { milestoneId: created.id, title: created.title, amountMinor: created.amount_minor, sequencing: created.sequencing },
        });
        return { milestone: created };
    });
}
/** GET /contracts/:contractId/milestones — participants; sequencing order. */
export async function listMilestones(user, contractId) {
    const dbi = await db();
    await loadContractForUser(dbi, user, contractId);
    const milestones = await repo.listMilestones(dbi, contractId);
    return { milestones };
}
/** POST /contracts/:contractId/milestones/:milestoneId/submit — freelancer; upcoming|revision -> in_review. */
export async function submitMilestone(user, contractId, milestoneId, input) {
    const dbi = await db();
    const contract = await loadContractForUser(dbi, user, contractId);
    if (contract.freelancer_id !== user.id) {
        throw forbidden("Only the freelancer on this contract can submit milestone work");
    }
    if (contract.status !== "active") {
        throw conflict("Milestones can only be submitted on active contracts", { status: contract.status });
    }
    return dbi.transaction().execute(async (trx) => {
        const lockedContract = await repo.lockContractById(trx, contractId);
        if (!lockedContract) {
            throw notFound("Contract not found");
        }
        if (lockedContract.status !== "active") {
            throw conflict("Milestones can only be submitted on active contracts", { status: lockedContract.status });
        }
        const milestone = await repo.lockMilestoneById(trx, milestoneId);
        if (!milestone || milestone.contract_id !== contractId) {
            throw notFound("Milestone not found");
        }
        if (milestone.status !== "upcoming" && milestone.status !== "revision") {
            throw conflict("Only upcoming or revision milestones can be submitted", { status: milestone.status });
        }
        const updated = await repo.markMilestoneInReview(trx, milestone.id);
        const deliverable = await repo.insertDeliverable(trx, {
            contractId,
            milestoneId: milestone.id,
            title: input.title ?? milestone.title,
            note: input.note,
            url: input.url,
            submittedBy: user.id,
        });
        await repo.insertContractEvent(trx, {
            contractId,
            actorId: user.id,
            kind: "milestone.submitted",
            payload: { milestoneId: milestone.id, deliverableId: deliverable.id, title: milestone.title },
        });
        await repo.insertNotification(trx, {
            userId: contract.client_id,
            type: "contract",
            title: "Milestone submitted for review",
            body: `The freelancer submitted "${milestone.title}" for review on contract "${contract.title_snapshot}".`,
            url: `/contracts/${contractId}/milestones`,
            entityType: "milestone",
            entityId: milestone.id,
        });
        return { milestone: updated, deliverable };
    });
}
/** POST /contracts/:contractId/milestones/:milestoneId/approve — client; in_review -> paid (demo payment), fully atomic. */
export async function approveMilestone(user, contractId, milestoneId) {
    const dbi = await db();
    const contract = await loadContractForUser(dbi, user, contractId);
    if (contract.client_id !== user.id) {
        throw forbidden("Only the client of this contract can approve milestones");
    }
    if (contract.status !== "active") {
        throw conflict("Milestones can only be approved on active contracts", { status: contract.status });
    }
    return dbi.transaction().execute(async (trx) => {
        const lockedContract = await repo.lockContractById(trx, contractId);
        if (!lockedContract) {
            throw notFound("Contract not found");
        }
        if (lockedContract.status !== "active") {
            throw conflict("Milestones can only be approved on active contracts", { status: lockedContract.status });
        }
        const milestone = await repo.lockMilestoneById(trx, milestoneId);
        if (!milestone || milestone.contract_id !== contractId) {
            throw notFound("Milestone not found");
        }
        if (milestone.status !== "in_review") {
            throw conflict("Only milestones in review can be approved", { status: milestone.status });
        }
        const grossMinor = milestone.amount_minor;
        const feeMinor = Math.round((grossMinor * PLATFORM_FEE_RATE_BPS) / 10_000);
        const netMinor = grossMinor - feeMinor;
        const currency = lockedContract.currency;
        const updated = await repo.markMilestonePaid(trx, milestone.id);
        await repo.insertPlatformFee(trx, {
            contractId,
            milestoneId: milestone.id,
            amountMinor: feeMinor,
            rateBps: PLATFORM_FEE_RATE_BPS,
            currency,
        });
        await repo.insertTransaction(trx, {
            userId: lockedContract.client_id,
            type: "milestone",
            amountMinor: grossMinor,
            currency,
            counterpartyId: lockedContract.freelancer_id,
            contractId,
            description: `Milestone payment for "${milestone.title}"`,
        });
        await repo.insertTransaction(trx, {
            userId: lockedContract.freelancer_id,
            type: "milestone",
            amountMinor: netMinor,
            currency,
            counterpartyId: lockedContract.client_id,
            contractId,
            description: `Milestone earnings for "${milestone.title}" (net of 8% platform fee)`,
        });
        await repo.insertTransaction(trx, {
            userId: lockedContract.freelancer_id,
            type: "commission",
            amountMinor: feeMinor,
            currency,
            counterpartyId: null,
            contractId,
            description: `Platform commission (8%) on milestone "${milestone.title}"`,
        });
        await repo.addFreelancerEarnings(trx, lockedContract.freelancer_id, netMinor);
        await repo.addClientSpent(trx, lockedContract.client_id, grossMinor);
        await repo.insertContractEvent(trx, {
            contractId,
            actorId: user.id,
            kind: "milestone.approved",
            payload: { milestoneId: milestone.id, amountMinor: grossMinor, approvedBy: user.id },
        });
        await repo.insertContractEvent(trx, {
            contractId,
            actorId: user.id,
            kind: "milestone.paid",
            payload: { milestoneId: milestone.id, amountMinor: grossMinor, feeMinor, netMinor, rateBps: PLATFORM_FEE_RATE_BPS, currency },
        });
        await repo.insertNotification(trx, {
            userId: lockedContract.freelancer_id,
            type: "payment",
            title: "Milestone paid",
            body: `"${milestone.title}" was approved and paid. ${netMinor} ${currency} was released to you (8% platform fee deducted).`,
            url: `/contracts/${contractId}`,
            entityType: "milestone",
            entityId: milestone.id,
        });
        return { milestone: updated, payment: { amountMinor: grossMinor, feeMinor, netMinor, rateBps: PLATFORM_FEE_RATE_BPS, currency } };
    });
}
/** POST /contracts/:contractId/milestones/:milestoneId/request-revision — client; in_review -> revision. */
export async function requestRevision(user, contractId, milestoneId, input) {
    const dbi = await db();
    const contract = await loadContractForUser(dbi, user, contractId);
    if (contract.client_id !== user.id) {
        throw forbidden("Only the client of this contract can request revisions");
    }
    if (contract.status !== "active") {
        throw conflict("Revisions can only be requested on active contracts", { status: contract.status });
    }
    return dbi.transaction().execute(async (trx) => {
        const lockedContract = await repo.lockContractById(trx, contractId);
        if (!lockedContract) {
            throw notFound("Contract not found");
        }
        if (lockedContract.status !== "active") {
            throw conflict("Revisions can only be requested on active contracts", { status: lockedContract.status });
        }
        const milestone = await repo.lockMilestoneById(trx, milestoneId);
        if (!milestone || milestone.contract_id !== contractId) {
            throw notFound("Milestone not found");
        }
        if (milestone.status !== "in_review") {
            throw conflict("Only milestones in review can be sent back for revision", { status: milestone.status });
        }
        const updated = await repo.markMilestoneRevision(trx, milestone.id);
        await repo.insertContractEvent(trx, {
            contractId,
            actorId: user.id,
            kind: "milestone.revision_requested",
            payload: { milestoneId: milestone.id, note: input.note },
        });
        await repo.insertNotification(trx, {
            userId: contract.freelancer_id,
            type: "contract",
            title: "Revision requested",
            body: `The client requested a revision on "${milestone.title}": ${input.note}`,
            url: `/contracts/${contractId}`,
            entityType: "milestone",
            entityId: milestone.id,
        });
        return { milestone: updated };
    });
}
/** GET /contracts/:contractId/milestones/:milestoneId/deliverables — participants. */
export async function listDeliverables(user, contractId, milestoneId) {
    const dbi = await db();
    await loadContractForUser(dbi, user, contractId);
    await loadMilestoneForContract(dbi, contractId, milestoneId);
    const deliverables = await repo.listDeliverables(dbi, contractId, milestoneId);
    return { deliverables };
}
