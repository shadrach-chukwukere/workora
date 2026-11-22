import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError, badRequest, conflict, forbidden, notFound, serviceUnavailable } from "../../plugins/error-handler.js";
import type { DB } from "../../database/types.js";
import type { Kysely } from "kysely";
import type Stripe from "stripe";
import { stripe } from "../../services/stripe.js";
import * as repo from "./repository.js";

const PLATFORM_FEE_BPS = 800;

type Conn = Kysely<DB>;

function requireStripe(): NonNullable<typeof stripe> {
  if (!stripe) {
    throw serviceUnavailable("Stripe payments are not configured. Set STRIPE_SECRET_KEY on the API.");
  }
  return stripe;
}

export async function listOwnPaymentMethods(db: Conn, userId: string) {
  return repo.listPaymentMethods(db, userId);
}

export async function addPaymentMethod(
  db: Conn,
  userId: string,
  _input: { provider: "stripe" | "paystack"; brand?: string; lastFour?: string; expMonth?: number; expYear?: number },
) {
  void db;
  void userId;
  throw serviceUnavailable("Payment methods must be added through Stripe Checkout; direct card entry is not supported.");
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
  const stripeClient = requireStripe();
  if (input.kind !== "milestone" || !input.milestoneId) {
    throw badRequest("Only contract milestone payments are supported.");
  }

  const milestone = await repo.findMilestoneWithContract(db, input.milestoneId);
  if (!milestone) {
    throw notFound("Milestone not found");
  }
  if (milestone.client_id !== userId) {
    throw forbidden("Only the contract client can fund this milestone");
  }
  if (input.contractId && input.contractId !== milestone.contract_id) {
    throw badRequest("contractId does not match the contract of milestoneId");
  }
  if (milestone.milestone_status !== "upcoming") {
    throw conflict("Only an upcoming milestone can be funded", { status: milestone.milestone_status });
  }
  if (Number(milestone.milestone_amount_minor) <= 0) {
    throw badRequest("Milestone amount must be greater than zero");
  }
  if (input.amountMinor !== Number(milestone.milestone_amount_minor)) {
    throw badRequest("Payment amount does not match the milestone amount", {
      expectedAmountMinor: Number(milestone.milestone_amount_minor),
    });
  }
  if (input.currency.toUpperCase() !== milestone.contract_currency.trim().toUpperCase()) {
    throw badRequest("Payment currency does not match the contract currency");
  }

  const existing = await repo.findMilestonePayment(db, milestone.milestone_id);
  if (existing?.status === "succeeded") {
    throw conflict("This milestone has already been funded");
  }
  if (existing?.status === "pending") {
    const metadata =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? existing.metadata as Record<string, unknown>
        : {};
    if (typeof metadata.checkoutUrl !== "string") {
      throw conflict("A checkout session is still being prepared for this milestone");
    }
    const session = await stripeClient.checkout.sessions.retrieve(existing.provider_ref);
    if (session.status === "open" && session.url) {
      return { paymentId: existing.id, checkoutUrl: session.url, provider: "stripe" as const };
    }
    if (session.status === "complete") {
      throw conflict("Payment confirmation is still processing. Refresh the contract shortly.");
    }
    await repo.markPaymentFailed(db, existing.id);
  }

  const payer = await repo.findUserEmail(db, userId);
  if (!payer) {
    throw notFound("Client account not found");
  }

  const paymentId = crypto.randomUUID();
  const currency = milestone.contract_currency.trim().toLowerCase();
  const payment = await repo.insertPayment(db, {
    userId,
    provider: "stripe",
    kind: "milestone",
    providerRef: `workora_${paymentId}`,
    amountMinor: Number(milestone.milestone_amount_minor),
    currency: currency.toUpperCase(),
    contractId: milestone.contract_id,
    milestoneId: milestone.milestone_id,
    metadata: { initiatedBy: userId },
  });

  try {
    const checkout = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: payer.email,
        client_reference_id: payment.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: Number(milestone.milestone_amount_minor),
              product_data: {
                name: `${milestone.contract_title}: ${milestone.milestone_title}`,
              },
            },
          },
        ],
        metadata: {
          workoraPaymentId: payment.id,
          milestoneId: milestone.milestone_id,
          contractId: milestone.contract_id,
        },
        payment_intent_data: {
          transfer_group: `contract-${milestone.contract_id}`,
          metadata: {
            workoraPaymentId: payment.id,
            milestoneId: milestone.milestone_id,
            contractId: milestone.contract_id,
          },
        },
        success_url: `${env.WEB_APP_URL}/client/contracts?funding=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.WEB_APP_URL}/client/contracts?funding=cancelled`,
      },
      { idempotencyKey: `workora-checkout-${payment.id}` },
    );
    if (!checkout.url) {
      throw new Error("Stripe did not return a hosted Checkout URL");
    }

    await repo.updatePaymentCheckoutSession(db, payment.id, checkout.id, checkout.url);
    return { paymentId: payment.id, checkoutUrl: checkout.url, provider: "stripe" as const };
  } catch (error) {
    await repo.markPaymentFailed(db, payment.id);
    throw error;
  }
}

export async function startStripePayoutOnboarding(db: Conn, userId: string, country: string) {
  const stripeClient = requireStripe();
  const profile = await repo.findFreelancerStripeAccount(db, userId);
  if (!profile) {
    throw notFound("Freelancer profile not found");
  }

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    const user = await repo.findUserEmail(db, userId);
    if (!user) {
      throw notFound("Freelancer account not found");
    }
    const account = await stripeClient.accounts.create({
      type: "express",
      country,
      email: user.email,
      capabilities: { transfers: { requested: true } },
      metadata: { workoraUserId: userId },
    });
    accountId = account.id;
    await repo.setFreelancerStripeAccount(db, userId, accountId);
  }

  const accountLink = await stripeClient.accountLinks.create({
    account: accountId,
    refresh_url: `${env.WEB_APP_URL}/freelancer/settings?payments=refresh`,
    return_url: `${env.WEB_APP_URL}/freelancer/settings?payments=return`,
    type: "account_onboarding",
  });
  return { url: accountLink.url, expiresAt: accountLink.expires_at };
}

export async function getStripePayoutStatus(db: Conn, userId: string) {
  const stripeClient = requireStripe();
  const profile = await repo.findFreelancerStripeAccount(db, userId);
  if (!profile) {
    throw notFound("Freelancer profile not found");
  }
  if (!profile.stripe_account_id) {
    return { connected: false, detailsSubmitted: false, payoutsEnabled: false };
  }
  const account = await stripeClient.accounts.retrieve(profile.stripe_account_id);
  const detailsSubmitted = account.details_submitted ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  await repo.updateFreelancerStripeStatus(db, account.id, detailsSubmitted, payoutsEnabled);
  return { connected: true, detailsSubmitted, payoutsEnabled };
}

export async function handleStripeWebhook(db: Conn, event: Stripe.Event) {
  return db.transaction().execute(async (trx) => {
    const result = await repo.insertProcessedWebhook(
      trx,
      event.id,
      "stripe",
      JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    );
    if (result.rows.length === 0) {
      return { received: true as const, duplicate: true };
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await repo.updateFreelancerStripeStatus(
        trx,
        account.id,
        account.details_submitted ?? false,
        account.payouts_enabled ?? false,
      );
      return { received: true as const, duplicate: false };
    }

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded" &&
      event.type !== "checkout.session.async_payment_failed" &&
      event.type !== "checkout.session.expired"
    ) {
      return { received: true as const, duplicate: false };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.workoraPaymentId;
    if (!paymentId) {
      return { received: true as const, duplicate: false };
    }
    const payment = await repo.findPaymentById(trx, paymentId);
    if (!payment || payment.provider !== "stripe" || payment.provider_ref !== session.id) {
      throw new AppError(400, "BAD_REQUEST", "Checkout session does not match a Workora payment");
    }

    if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
      await repo.markPaymentFailed(trx, payment.id);
      return { received: true as const, duplicate: false };
    }
    if (session.payment_status !== "paid") {
      return { received: true as const, duplicate: false };
    }
    if (session.amount_total !== Number(payment.amount_minor) || session.currency?.toUpperCase() !== payment.currency.trim().toUpperCase()) {
      throw new AppError(400, "BAD_REQUEST", "Stripe amount or currency does not match the Workora payment");
    }
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new AppError(400, "BAD_REQUEST", "Stripe Checkout did not return a payment intent for a paid session");
    }

    if (payment.status === "succeeded") {
      return { received: true as const, duplicate: false };
    }
    if (payment.status !== "pending") {
      throw conflict("Payment is no longer pending", { status: payment.status });
    }
    await repo.markPaymentSucceeded(trx, payment.id);
    await repo.updatePaymentMetadata(trx, payment.id, { paymentIntentId });

    if (payment.milestone_id) {
      const milestone = await repo.findMilestoneWithContract(trx, payment.milestone_id);
      if (!milestone) {
        throw notFound("Milestone not found for the successful payment");
      }
      if (milestone.milestone_status === "upcoming") {
        await repo.setMilestoneStatus(trx, milestone.milestone_id, "funded", "funded_at");
        await repo.insertContractEvent(trx, {
          contractId: milestone.contract_id,
          actorId: null,
          kind: "milestone.funded",
          payload: { milestoneId: milestone.milestone_id, paymentId: payment.id, provider: "stripe" },
        });
      } else if (milestone.milestone_status !== "funded") {
        throw conflict("Milestone is not eligible for funding", { status: milestone.milestone_status });
      }
    }
    return { received: true as const, duplicate: false };
  });
}

/** POST /payments/verify — a known Stripe Checkout session resolves to its stored status. */
export async function verifyPaymentReference(db: Conn, userId: string, reference: string) {
  const payment = await repo.findPaymentOwnedByProviderRef(db, reference, userId);
  if (!payment) {
    throw notFound("No payment found for that reference");
  }
  return {
    reference,
    status: payment.status,
    payment: {
      id: payment.id,
      status: payment.status,
      amount_minor: payment.amount_minor,
      currency: payment.currency,
    },
  };
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
