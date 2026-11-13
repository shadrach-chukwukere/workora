import { ok, parsePage, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { env } from "../../config/env.js";
import { addPaymentMethodSchema, initializePaymentSchema, transactionsQuerySchema, verifyPaymentSchema } from "./schemas.js";
import * as service from "./service.js";
import * as repo from "./repository.js";
function validationError(reply, message, details = {}) {
    reply.status(400).send({
        success: false,
        message,
        error: { code: "VALIDATION_ERROR", details },
    });
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function demoAuthorizePage(title, detail, okOutcome) {
    const accent = okOutcome ? "#0f9d63" : "#b45309";
    const appUrl = escapeHtml(env.WEB_APP_URL);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Workora (demo)</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e5e9f0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .card { max-width: 440px; padding: 36px 40px; border-radius: 18px; background: #131c2e; border: 1px solid #23304d; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #0b1220; background: ${accent}; margin-bottom: 14px; font-weight: 700; }
    h1 { font-size: 22px; margin: 0 0 10px; }
    p { color: #a7b1c6; line-height: 1.55; font-size: 14px; margin: 0 0 22px; }
    a { display: inline-block; padding: 11px 22px; border-radius: 10px; background: #4f7cff; color: #fff; text-decoration: none; font-weight: 600; }
    a:hover { background: #6b90ff; }
    small { display: block; margin-top: 18px; color: #5c6882; font-size: 11px; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">Demo mode</span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(detail)}</p>
    <a href="${appUrl}">Back to Workora</a>
    <small>No real payment was processed. This workspace runs with synthetic demo payments only.</small>
  </main>
</body>
</html>`;
}
export default async function paymentsRoutes(app) {
    /** GET /api/v1/payments/methods — own methods. Lazily seeds one demo VISA ····4169 for new users. */
    app.get("/payments/methods", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const instance = await db();
        const methods = await service.listOwnPaymentMethods(instance, user.id);
        reply.send(ok({ methods }));
    });
    /** POST /api/v1/payments/methods — synthetic demo method; no PAN is accepted or stored. */
    app.post("/payments/methods", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = addPaymentMethodSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid payment method", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const method = await service.addPaymentMethod(instance, user.id, parsed.data);
        reply.status(201).send(ok({ method }, "Demo payment method added"));
    });
    /** DELETE /api/v1/payments/methods/:id — own methods only. */
    app.delete("/payments/methods/:id", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const instance = await db();
        await service.removePaymentMethod(instance, user.id, request.params.id);
        reply.send(ok(null, "Payment method removed"));
    });
    /**
     * POST /api/v1/payments/initialize — DEMO MODE ONLY.
     * Creates a pending payment with a synthetic provider_ref and returns a local authorize URL.
     * No Stripe/Paystack API call is made.
     */
    app.post("/payments/initialize", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = initializePaymentSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid payment payload", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const result = await service.initializePayment(instance, user.id, parsed.data);
        reply.status(201).send(ok(result, "Demo payment initialized"));
    });
    /**
     * GET /api/v1/payments/demo-authorizations/:id/authorize — PUBLIC demo checkout page.
     * Flips the payment to succeeded and, when milestone-linked, runs the milestone pay pipeline
     * (in_review → approved → paid, both-side transactions, platform fee, contract events) in ONE transaction.
     */
    app.get("/payments/demo-authorizations/:id/authorize", async (request, reply) => {
        const instance = await db();
        const result = await service.authorizeDemoPayment(instance, request.params.id);
        reply.type("text/html; charset=utf-8");
        switch (result.outcome) {
            case "authorized":
                reply.send(demoAuthorizePage("Demo payment authorized", "Your demo payment was authorized successfully. If it funded a milestone, the milestone has moved through approved to paid.", true));
                return;
            case "already_authorized":
                reply.send(demoAuthorizePage("Demo payment already authorized", "This demo payment was already authorized. No duplicate transaction was created.", true));
                return;
            case "not_pending":
                reply.status(409).send(demoAuthorizePage("Payment not payable", `This demo payment is currently '${result.payment?.status ?? "unknown"}' and cannot be authorized.`, false));
                return;
            default:
                reply.status(404).send(demoAuthorizePage("Payment not found", "We could not find a demo payment for this link. It may have been created against a different workspace.", false));
                return;
        }
    });
    /** POST /api/v1/payments/verify — own payments only; demo semantics: known provider_ref resolves to stored status. */
    app.post("/payments/verify", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = verifyPaymentSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid verify payload", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const result = await service.verifyPaymentReference(instance, user.id, parsed.data.reference);
        reply.send(ok(result));
    });
    /**
     * POST /api/v1/webhooks/payments — PUBLIC, DEMO-ONLY.
     * No signature verification is performed. Hard-fails when NODE_ENV=production.
     * Parses the provider reference, flips a matching pending payment to succeeded and runs
     * the milestone pay pipeline. Always responds { received: true } for processable payloads.
     */
    app.post("/webhooks/payments", async (request, reply) => {
        const instance = await db();
        const result = await service.handleDemoWebhook(instance, request.body);
        reply.send(ok({ received: result.received, duplicate: result.duplicate, providerRef: result.providerRef, status: result.paymentStatus }, "Webhook received"));
    });
    /** GET /api/v1/payments/transactions — paginated own transactions + demo earnings breakdown. */
    app.get("/payments/transactions", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const query = request.query;
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
        reply.send(ok({
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
        }));
    });
    /** GET /api/v1/payments/transactions/:id — own only. */
    app.get("/payments/transactions/:id", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
        const instance = await db();
        const transaction = await repo.findTransactionOwned(instance, request.params.id, user.id);
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
