import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, parsePage, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { env } from "../../config/env.js";
import { AppError } from "../../plugins/error-handler.js";
import { stripe } from "../../services/stripe.js";
import { addPaymentMethodSchema, connectOnboardingSchema, initializePaymentSchema, transactionsQuerySchema, verifyPaymentSchema } from "./schemas.js";
import * as service from "./service.js";
import * as repo from "./repository.js";

function validationError(reply: import("fastify").FastifyReply, message: string, details: Record<string, unknown> = {}) {
  reply.status(400).send({
    success: false,
    message,
    error: { code: "VALIDATION_ERROR", details },
  });
}

export default async function paymentsRoutes(app: FastifyInstance) {
  /** GET /api/v1/payments/methods — own real payment methods. */
  app.get("/payments/methods", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const methods = await service.listOwnPaymentMethods(instance, user.id);
    reply.send(ok({ methods }));
  });

  /** POST /api/v1/payments/methods — direct card storage is disabled. */
  app.post("/payments/methods", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = addPaymentMethodSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid payment method", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const method = await service.addPaymentMethod(instance, user.id, parsed.data);
    reply.status(201).send(ok({ method }, "Payment method added"));
  });

  /** DELETE /api/v1/payments/methods/:id — own methods only. */
  app.delete("/payments/methods/:id", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    await service.removePaymentMethod(instance, user.id, (request.params as { id: string }).id);
    reply.send(ok(null, "Payment method removed"));
  });

  /** POST /api/v1/payments/initialize — hosted Stripe Checkout for milestone funding. */
  app.post("/payments/initialize", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = initializePaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid payment payload", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const result = await service.initializePayment(instance, user.id, parsed.data);
    reply.status(201).send(ok(result, "Stripe Checkout session created"));
  });

  /** POST /api/v1/payments/verify — own payment by Stripe Checkout session id. */
  app.post("/payments/verify", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = verifyPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid verify payload", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const result = await service.verifyPaymentReference(instance, user.id, parsed.data.reference);
    reply.send(ok(result));
  });

  /** POST /api/v1/webhooks/payments — Stripe-signed payment and connected-account events. */
  app.post("/webhooks/payments", async (request, reply) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Stripe webhook signing is not configured");
    }
    const signature = request.headers["stripe-signature"];
    if (typeof signature !== "string" || !request.rawBody) {
      throw new AppError(400, "BAD_REQUEST", "Stripe signature or raw request body is missing");
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      request.log.warn({ err: error }, "invalid Stripe webhook signature");
      throw new AppError(400, "BAD_REQUEST", "Invalid Stripe webhook signature");
    }
    const instance = await db();
    const result = await service.handleStripeWebhook(instance, event);
    reply.send(ok(result, "Webhook received"));
  });

  /** GET /api/v1/payments/connect/status — freelancer's Stripe payout readiness. */
  app.get("/payments/connect/status", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const status = await service.getStripePayoutStatus(instance, user.id);
    reply.send(ok(status));
  });

  /** POST /api/v1/payments/connect/onboarding — creates a Stripe Express onboarding link. */
  app.post("/payments/connect/onboarding", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
    const parsed = connectOnboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid onboarding country", { issues: parsed.error.issues });
      return;
    }
    const user = request.currentUser!;
    const instance = await db();
    const onboarding = await service.startStripePayoutOnboarding(instance, user.id, parsed.data.country);
    reply.send(ok(onboarding, "Stripe onboarding link created"));
  });

  /** GET /api/v1/payments/transactions — paginated own transactions and earnings breakdown. */
  app.get("/payments/transactions", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const query = request.query as Record<string, string | undefined>;
    const parsed = transactionsQuerySchema.safeParse(query);
    if (!parsed.success) {
      validationError(reply, "Invalid transaction filters", { issues: parsed.error.issues });
      return;
    }
    const { limit, offset, page } = parsePage(query);
    const instance = await db();
    const { transactions, total, earnings } = await service.listOwnTransactions(instance, user.id, {
      type: parsed.data.type,
      status: parsed.data.status,
      dateFrom: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
      dateTo: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
      limit,
      offset,
    });
    const perPage = limit;
    reply.send(
      ok({
        transactions,
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
        earnings: {
          pendingPayoutsMinor: earnings.pendingPayoutsMinor,
          availableBalanceMinor: earnings.availableBalanceMinor,
          lifetimeVolumeMinor: earnings.lifetimeVolumeMinor,
        },
      }),
    );
  });

  /** GET /api/v1/payments/transactions/:id — own only. */
  app.get("/payments/transactions/:id", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const transaction = await repo.findTransactionOwned(instance, (request.params as { id: string }).id, user.id);
    if (!transaction) {
      reply.status(404).send({
        success: false,
        message: "Transaction not found",
        error: { code: "NOT_FOUND", details: {} },
      });
      return;
    }
    reply.send(ok({ transaction }));
  });
}
