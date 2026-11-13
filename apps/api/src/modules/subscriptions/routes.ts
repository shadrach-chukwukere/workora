import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import * as service from "./service.js";

const createSubscriptionSchema = z.object({
  planId: z.string().uuid("planId must be a valid plan id"),
  interval: z.enum(["monthly", "annual"]).optional(),
});

function validationError(reply: import("fastify").FastifyReply, message: string, details: Record<string, unknown> = {}) {
  reply.status(400).send({
    success: false,
    message,
    error: { code: "VALIDATION_ERROR", details },
  });
}

export default async function subscriptionsRoutes(app: FastifyInstance) {
  /** GET /api/v1/subscription-plans — public plan catalog. */
  app.get("/subscription-plans", async (_request, reply) => {
    const instance = await db();
    const plans = await service.listPlans(instance);
    reply.send(ok({ plans }));
  });

  /**
   * POST /api/v1/subscriptions — authenticated. DEMO BILLING: no provider charge;
   * creates an active subscription (provider='manual') plus one synthetic paid invoice.
   */
  app.post("/subscriptions", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = createSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid subscription payload", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const result = await service.createSubscription(instance, user.id, parsed.data);
    reply.status(201).send(ok(result, "Subscription created (demo)"));
  });

  /** GET /api/v1/subscriptions/me — current active subscription with plan; [] when none. */
  app.get("/subscriptions/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const current = await service.currentSubscription(instance, user.id);
    // Spec-compatible: empty array when the user has no active subscription.
    reply.send(ok(current.length > 0 ? current : []));
  });

  /** GET /api/v1/subscriptions/invoices — all own invoices, newest first. */
  app.get("/subscriptions/invoices", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const invoices = await service.ownInvoices(instance, user.id);
    reply.send(ok({ invoices }));
  });

  /** POST /api/v1/subscriptions/:id/cancel — owner only; flips to canceled + canceled_at. */
  app.post("/subscriptions/:id/cancel", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const subscription = await service.cancelSubscription(instance, user.id, (request.params as { id: string }).id);
    reply.send(ok({ subscription }, "Subscription canceled"));
  });

  /** GET /api/v1/subscriptions/:id/invoices — owner only; invoices for this subscription. */
  app.get("/subscriptions/:id/invoices", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const invoices = await service.invoicesForSubscription(instance, user.id, (request.params as { id: string }).id);
    reply.send(ok({ invoices }));
  });
}
