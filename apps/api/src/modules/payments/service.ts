import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError, notFound } from "../../plugins/error-handler.js";
import type { DB } from "../../database/types.js";
import type { Kysely } from "kysely";
import * as repo from "./repository.js";

/**
 * PAYMENTS ARE IN DEMO MODE FOR THIS WORKSPACE.
 * No Stripe/Paystack API call is ever made. Every external interaction is replaced
 * by a local state transition plus a synthetic reference. Do not enable this in production.
 */

// Platform commission applied by the demo milestone-pay pipeline (10%).
const PLATFORM_FEE_BPS = 1000;

type Conn = Kysely<DB>;

export async function listOwnPaymentMethods(db: Conn, userId: string) {
  // DEMO UX: lazily seed one demo VISA ····4169 the first time a brand-new user lists methods.
  await repo.seedDemoPaymentMethodIfEmpty(db, userId);
  return repo.listPaymentMethods(db, userId);
}

export async function addPaymentMethod(
  db: Conn,
  userId: string,
  input: { provider: "stripe" | "paystack"; brand?: string; lastFour?: string; expMonth?: number; expYear?: number },
) {
  const lastFour = input.lastFour ?? String(crypto.randomInt(0, 10000)).padStart(4, "0");
  const brand = input.brand?.trim() || (input.provider === "stripe" ? "VISA (demo)" : "Card (demo)");
  // Synthetic provider token — NEVER a real PAN. e.g. demo-visa-4169 / demo-paystack-a1b2
  const brandSlug =
    brand
      .split(" ")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || input.provider;
  const token = input.provider === "stripe" && brandSlug === "visa"
    ? `demo-visa-${lastFour}`
    : `demo-${input.provider}-${crypto.randomBytes(2).toString("hex")}`;

  const existing = await repo.countPaymentMethods(db, userId);
  return repo.insertPaymentMethod(db, {
    userId,
    provider: input.provider,
    providerMethodId: token,
    brand,
    lastFour,
    expMonth: input.expMonth ?? 12,
    expYear: input.expYear ?? new Date().getFullYear() + 3,
    isDefault: existing === 0,
  });
}

export async function removePaymentMethod(db: Conn, userId: string, id: string) {
  const method = await repo.findPaymentMethodOwned(db, id, userId);
  if (!method) {
    throw notFound("Payment method not found");
  }
  await repo.deletePaymentMethod(db, method.id);
  return { deleted: true };
}

export async function initializePayment(
  db: Conn,
  userId: string,
  input: {
    kind: "milestone" | "subscription" | "topup";
    amountMinor: number;
    currency: string;
    contractId?: string;
    milestoneId?: string;
  },
) {
  // Resolve the milestone link first so we can derive the contract when only one side is given.
  let contractId = input.contractId ?? null;
  let milestoneId = input.milestoneId ?? null;

  if (milestoneId) {
    const milestone = await repo.findMilestoneWithContract(db, milestoneId);
    if (!milestone) {
      throw notFound("Milestone not found");
    }
    if (contractId && contractId !== milestone.contract_id) {
      throw new AppError(400, "BAD_REQUEST", "contractId does not match the contract of milestoneId");
    }
    contractId = milestone.contract_id;
  }
  if (contractId) {
    const contract = await repo.findContractById(db, contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
  }

  // DEMO MODE: provider_ref is synthetic; no Stripe/Paystack call is performed.
  const provider = "stripe" as const;
  const providerRef = `demo_${crypto.randomUUID()}`;

  const payment = await repo.insertPayment(db, {
    userId,
    provider,
    kind: input.kind,
    providerRef,
    amountMinor: input.amountMinor,
    currency: input.currency,
    contractId,
    milestoneId,
    metadata: { demo: true, initiatedBy: userId },
  });

  const authorizationUrl = `${env.BASE_URL}/api/v1/payments/demo-authorizations/${payment.id}/authorize`;
  return { payment, authorizationUrl, demo: true as const };
}

/**
 * DEMO authorize handler. Flips the payment to succeeded and — when the payment is linked to a
 * milestone — runs the same in_review → approved → paid pipeline the milestones module uses,
 * all inside ONE database transaction:
 *   milestone status changes + timestamps, contract_events rows, transactions rows on both
 *   sides, a platform_fees row, and profile counter updates.
 */
export async function authorizeDemoPayment(db: Conn, paymentId: string, actorId: string | null = null) {
  return db.transaction().execute(async (trx) => {
    const payment = await repo.findPaymentById(trx, paymentId);
    if (!payment) {
      return { outcome: "not_found" as const, payment: null };
    }
    if (payment.status === "succeeded") {
      // Idempotent: re-visiting the authorize link must not double-pay the milestone.
      return { outcome: "already_authorized" as const, payment };
    }
    if (payment.status !== "pending") {
      return { outcome: "not_pending" as const, payment };
    }

    const succeeded = (await repo.markPaymentSucceeded(trx, payment.id)) ?? { ...payment, status: "succeeded" as const };

    if (payment.milestone_id) {
      await runMilestonePayPipeline(trx, payment.id, payment.milestone_id, actorId ?? payment.user_id);
    }
    return { outcome: "authorized" as const, payment: succeeded };
  });
}

/** Shared milestone approve+pay pipeline (demo). Caller MUST wrap this in a transaction. */
export async function runMilestonePayPipeline(trx: Conn, paymentId: string, milestoneId: string, actorId: string | null) {
  const milestone = await repo.findMilestoneWithContract(trx, milestoneId);
  if (!milestone) {
    throw notFound("Milestone not found");
  }

  // Idempotency: if the milestone already reached paid, do nothing further.
  if (milestone.milestone_status === "paid") {
    return;
  }

  // 1) in_review → approved
  if (milestone.milestone_status === "in_review") {
    await repo.setMilestoneStatus(trx, milestone.milestone_id, "approved", "approved_at");
    await repo.insertContractEvent(trx, {
      contractId: milestone.contract_id,
      actorId,
      kind: "milestone_approved",
      payload: { milestoneId: milestone.milestone_id, paymentId, demo: true },
    });
  } else if (milestone.milestone_status !== "approved") {
    throw new AppError(409, "CONFLICT", `Milestone cannot be paid from status '${milestone.milestone_status}'`);
  }

  // 2) approved → paid
  await repo.setMilestoneStatus(trx, milestone.milestone_id, "paid", "paid_at");
  await repo.insertContractEvent(trx, {
    contractId: milestone.contract_id,
    actorId,
    kind: "milestone_paid",
    payload: { milestoneId: milestone.milestone_id, paymentId, amountMinor: milestone.milestone_amount_minor, demo: true },
  });

  // 3) money movement: platform fee, both-side ledger rows, profile counters
  const amount = milestone.milestone_amount_minor;
  const fee = Math.floor((amount * PLATFORM_FEE_BPS) / 10000);
  const net = amount - fee;
  const currency = milestone.contract_currency;

  await repo.insertPlatformFee(trx, {
    contractId: milestone.contract_id,
    milestoneId: milestone.milestone_id,
    amountMinor: fee,
    rateBps: PLATFORM_FEE_BPS,
    currency,
  });

  await repo.insertTransaction(trx, {
    userId: milestone.client_id,
    type: "payment",
    amountMinor: -amount,
    currency,
    counterpartyId: milestone.freelancer_id,
    contractId: milestone.contract_id,
    paymentId,
    description: `Milestone payment · ${milestone.milestone_title}`,
  });

  await repo.insertTransaction(trx, {
    userId: milestone.freelancer_id,
    type: "milestone",
    amountMinor: net,
    currency,
    counterpartyId: milestone.client_id,
    contractId: milestone.contract_id,
    paymentId,
    description: `Milestone payout · ${milestone.milestone_title} (net of 10% platform fee)`,
  });

  await repo.bumpFreelancerEarnings(trx, milestone.freelancer_id, net);
  await repo.bumpClientSpend(trx, milestone.client_id, amount);
}

/** POST /payments/verify — demo semantics: a known provider_ref resolves to its stored status. */
export async function verifyPaymentReference(db: Conn, userId: string, reference: string) {
  const payment = await repo.findPaymentOwnedByProviderRef(db, reference, userId);
  if (!payment) {
    throw notFound("No payment found for that reference");
  }
  return { reference, status: payment.status, payment };
}

/**
 * Demo webhook processor. UNSAFE BY DESIGN — no signature verification is performed because
 * this is a strictly demo-mode environment file. Hard-fails in production.
 */
export async function handleDemoWebhook(db: Conn, rawBody: unknown, providerHint: "stripe" | "paystack" = "stripe") {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo payments webhook cannot run in production: no signature verification is implemented");
  }

  const providerRef = extractProviderRef(rawBody);
  if (!providerRef) {
    throw new AppError(400, "BAD_REQUEST", "Webhook payload did not include a provider reference");
  }

  const deliveryId = `demo-webhook-${providerRef}`;
  const payload = (rawBody && typeof rawBody === "object" ? rawBody : { raw: rawBody }) as Record<string, unknown>;

  // Idempotent demo dedupe: one delivery per provider_ref.
  const already = await repo.processedWebhookExists(db, deliveryId);
  let payment = null;
  if (!already) {
    const found = await repo.findPaymentByProviderRef(db, providerRef);
    const provider = found?.provider ?? providerHint;
    await repo.insertProcessedWebhook(db, deliveryId, provider, payload);
    if (found && found.status === "pending") {
      await db.transaction().execute(async (trx) => {
        await repo.markPaymentSucceeded(trx, found.id);
        if (found.milestone_id) {
          await runMilestonePayPipeline(trx, found.id, found.milestone_id, null);
        }
      });
      payment = { ...found, status: "succeeded" as const };
    } else {
      payment = found ?? null;
    }
  } else {
    payment = await repo.findPaymentByProviderRef(db, providerRef);
  }

  return { received: true as const, duplicate: Boolean(already), providerRef, paymentStatus: payment?.status ?? null };
}

/** Pull a provider reference out of a few plausible demo webhook envelope shapes. */
export function extractProviderRef(body: unknown): string | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [body];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const record = node as Record<string, unknown>;
    for (const key of ["provider_ref", "providerRef", "reference"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
    for (const key of ["data", "event", "object"]) {
      if (record[key] && typeof record[key] === "object") {
        queue.push(record[key]);
      }
    }
  }
  return null;
}

export async function listOwnTransactions(
  db: Conn,
  userId: string,
  filters: {
    type?: "milestone" | "commission" | "refund" | "withdrawal" | "topup" | "payout" | "payment";
    status?: "pending" | "completed" | "failed";
    dateFrom?: Date;
    dateTo?: Date;
    limit: number;
    offset: number;
  },
) {
  const [{ rows, total }, earnings] = await Promise.all([
    repo.listTransactions(db, userId, filters),
    repo.earningsBreakdown(db, userId),
  ]);
  return { transactions: rows, total, earnings };
}
