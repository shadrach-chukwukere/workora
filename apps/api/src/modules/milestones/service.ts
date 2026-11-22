import { db } from "../../database/connection.js";
import { badRequest, conflict, forbidden, notFound, serviceUnavailable } from "../../plugins/error-handler.js";
import type { AuthedUser } from "../../middleware/authenticate.js";
import type { CreateMilestoneInput, RequestRevisionInput, SubmitMilestoneInput } from "./schemas.js";
import { stripe } from "../../services/stripe.js";
import * as repo from "./repository.js";
import * as paymentRepo from "../payments/repository.js";
import * as emailNotify from "../../services/notifications.js";

const PLATFORM_FEE_RATE_BPS = 800; // 8%

function assertParticipant(contract: { client_id: string; freelancer_id: string }, user: AuthedUser): void {
  // Spec: all milestone endpoints require contract participation (no admin override).
  const isParticipant = contract.client_id === user.id || contract.freelancer_id === user.id;
  if (!isParticipant) {
    throw forbidden("You are not a participant of this contract");
  }
}

/** Shared gate: contract must exist and the caller must participate. */
async function loadContractForUser(dbi: Awaited<ReturnType<typeof db>>, user: AuthedUser, contractId: string) {
  const contract = await repo.getContractById(dbi, contractId);
  if (!contract) {
    throw notFound("Contract not found");
  }
  assertParticipant(contract, user);
  return contract;
}

/** Loads a milestone that must belong to the contract. */
async function loadMilestoneForContract(dbi: Awaited<ReturnType<typeof db>>, contractId: string, milestoneId: string) {
  const milestone = await repo.getMilestoneById(dbi, milestoneId);
  if (!milestone || milestone.contract_id !== contractId) {
    throw notFound("Milestone not found");
  }
  return milestone;
}

/** POST /contracts/:contractId/milestones — contract client, contract active. */
export async function createMilestone(user: AuthedUser, contractId: string, input: CreateMilestoneInput) {
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
export async function listMilestones(user: AuthedUser, contractId: string) {
  const dbi = await db();
  await loadContractForUser(dbi, user, contractId);
  const milestones = await repo.listMilestones(dbi, contractId);
  return { milestones };
}

/** POST /contracts/:contractId/milestones/:milestoneId/submit — freelancer; funded|revision -> in_review. */
export async function submitMilestone(user: AuthedUser, contractId: string, milestoneId: string, input: SubmitMilestoneInput) {
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
    if (milestone.status !== "funded" && milestone.status !== "revision") {
      throw conflict("Only funded or revision milestones can be submitted", { status: milestone.status });
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

/** POST /contracts/:contractId/milestones/:milestoneId/approve — client; releases the funded Stripe charge. */
export async function approveMilestone(user: AuthedUser, contractId: string, milestoneId: string) {
  const dbi = await db();
  const contract = await loadContractForUser(dbi, user, contractId);

  if (contract.client_id !== user.id) {
    throw forbidden("Only the client of this contract can approve milestones");
  }
  if (contract.status !== "active") {
    throw conflict("Milestones can only be approved on active contracts", { status: contract.status });
  }

  const milestoneBeforeApproval = await loadMilestoneForContract(dbi, contractId, milestoneId);
  if (milestoneBeforeApproval.status === "paid") {
    return { milestone: milestoneBeforeApproval, payment: { alreadyPaid: true } };
  }
  if (milestoneBeforeApproval.status !== "in_review" && milestoneBeforeApproval.status !== "approved") {
    throw conflict("Only milestones in review can be approved", { status: milestoneBeforeApproval.status });
  }
  if (!stripe) {
    throw serviceUnavailable("Stripe payments are not configured. Set STRIPE_SECRET_KEY on the API.");
  }

  const payment = await paymentRepo.findSuccessfulMilestonePayment(dbi, milestoneId);
  if (!payment || Number(payment.amount_minor) !== Number(milestoneBeforeApproval.amount_minor)) {
    throw conflict("This milestone has no matching successful Stripe payment");
  }
  const connectedAccount = await paymentRepo.findFreelancerStripeAccount(dbi, contract.freelancer_id);
  if (!connectedAccount?.stripe_account_id) {
    throw conflict("The freelancer must finish Stripe payout onboarding before funds can be released");
  }
  const stripeAccount = await stripe.accounts.retrieve(connectedAccount.stripe_account_id);
  if (!stripeAccount.payouts_enabled || stripeAccount.capabilities?.transfers !== "active") {
    throw conflict("The freelancer's Stripe account is not ready to receive payouts");
  }

  const paymentMetadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata as Record<string, unknown>
      : {};
  const paymentIntentId = paymentMetadata.paymentIntentId;
  if (typeof paymentIntentId !== "string") {
    throw conflict("The Stripe payment is missing its payment intent reference");
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    throw conflict("Stripe has not confirmed the milestone payment");
  }
  const latestCharge = paymentIntent.latest_charge;
  const sourceTransaction = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
  if (!sourceTransaction) {
    throw conflict("Stripe has not provided a charge to transfer");
  }

  const grossMinor = Number(milestoneBeforeApproval.amount_minor);
  const feeMinor = Math.round((grossMinor * PLATFORM_FEE_RATE_BPS) / 10_000);
  const netMinor = grossMinor - feeMinor;
  const currency = contract.currency.trim();
  const approvalState = await dbi.transaction().execute(async (trx) => {
    const lockedContract = await repo.lockContractById(trx, contractId);
    if (!lockedContract || lockedContract.status !== "active") {
      throw conflict("Milestones can only be approved on active contracts", { status: lockedContract?.status });
    }
    const lockedMilestone = await repo.lockMilestoneById(trx, milestoneId);
    if (!lockedMilestone || lockedMilestone.contract_id !== contractId) {
      throw notFound("Milestone not found");
    }
    if (lockedMilestone.status === "paid") {
      return "paid" as const;
    }
    if (lockedMilestone.status === "in_review") {
      await repo.markMilestoneApproved(trx, milestoneId);
      await repo.insertContractEvent(trx, {
        contractId,
        actorId: user.id,
        kind: "milestone.approved",
        payload: { milestoneId, amountMinor: grossMinor, approvedBy: user.id },
      });
      return "approved" as const;
    }
    if (lockedMilestone.status === "approved") {
      return "approved" as const;
    }
    throw conflict("Only milestones in review can be approved", { status: lockedMilestone.status });
  });
  if (approvalState === "paid") {
    return { milestone: await loadMilestoneForContract(dbi, contractId, milestoneId), payment: { alreadyPaid: true } };
  }

  const transfer = await stripe.transfers.create(
    {
      amount: netMinor,
      currency: currency.toLowerCase(),
      destination: connectedAccount.stripe_account_id,
      source_transaction: sourceTransaction,
      transfer_group: `contract-${contractId}`,
      metadata: { milestoneId, workoraPaymentId: payment.id },
    },
    { idempotencyKey: `workora-release-${milestoneId}` },
  );

  await dbi.transaction().execute(async (trx) => {
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
    if (milestone.status === "paid") {
      return;
    }
    if (milestone.status !== "approved") {
      throw conflict("Milestone approval state changed before payout", { status: milestone.status });
    }

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
      paymentId: payment.id,
      description: `Milestone payment for "${milestone.title}"`,
    });
    await repo.insertTransaction(trx, {
      userId: lockedContract.freelancer_id,
      type: "milestone",
      amountMinor: netMinor,
      currency,
      counterpartyId: lockedContract.client_id,
      contractId,
      paymentId: payment.id,
      description: `Milestone earnings for "${milestone.title}" (net of 8% platform fee)`,
    });
    await repo.insertTransaction(trx, {
      userId: lockedContract.freelancer_id,
      type: "commission",
      amountMinor: feeMinor,
      currency,
      counterpartyId: null,
      contractId,
      paymentId: payment.id,
      description: `Platform commission (8%) on milestone "${milestone.title}"`,
    });

    await repo.addFreelancerEarnings(trx, lockedContract.freelancer_id, netMinor);
    await repo.addClientSpent(trx, lockedContract.client_id, grossMinor);

    await repo.insertContractEvent(trx, {
      contractId,
      actorId: user.id,
      kind: "milestone.paid",
      payload: {
        milestoneId: milestone.id,
        amountMinor: grossMinor,
        feeMinor,
        netMinor,
        rateBps: PLATFORM_FEE_RATE_BPS,
        currency,
        provider: "stripe",
        transferId: transfer.id,
      },
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

    await paymentRepo.updatePaymentMetadata(trx, payment.id, { transferId: transfer.id });
    return updated;
  });

  const paidMilestone = await loadMilestoneForContract(dbi, contractId, milestoneId);
  return {
    milestone: paidMilestone,
    payment: { amountMinor: grossMinor, feeMinor, netMinor, rateBps: PLATFORM_FEE_RATE_BPS, currency, transferId: transfer.id },
  };
}

/** POST /contracts/:contractId/milestones/:milestoneId/request-revision — client; in_review -> revision. */
export async function requestRevision(user: AuthedUser, contractId: string, milestoneId: string, input: RequestRevisionInput) {
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
export async function listDeliverables(user: AuthedUser, contractId: string, milestoneId: string) {
  const dbi = await db();
  await loadContractForUser(dbi, user, contractId);
  await loadMilestoneForContract(dbi, contractId, milestoneId);
  const deliverables = await repo.listDeliverables(dbi, contractId, milestoneId);
  return { deliverables };
}
