import { AppError, notFound } from "../../plugins/error-handler.js";
import * as repo from "./repository.js";
export function listPlans(db) {
    return repo.listActivePlans(db);
}
export async function createSubscription(db, userId, input) {
    const plan = await repo.findPlanById(db, input.planId);
    if (!plan || !plan.is_active) {
        throw notFound("Subscription plan not found");
    }
    // NOTE: subscriptions.amount_minor has a CHECK (> 0) constraint, so a free plan (price 0)
    // cannot be represented. Reject it explicitly instead of tripping the constraint.
    if (plan.price_minor <= 0) {
        throw new AppError(400, "BAD_REQUEST", "This plan is free and does not require a subscription");
    }
    const interval = input.interval ?? "monthly";
    const amountMinor = plan.price_minor;
    const periodEnd = new Date();
    if (interval === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    return db.transaction().execute(async (trx) => {
        const subscription = await repo.insertSubscription(trx, {
            userId,
            planId: plan.id,
            interval,
            amountMinor,
            currency: plan.currency,
            currentPeriodEnd: periodEnd,
        });
        // DEMO: one synthetic, already-paid invoice per subscription creation.
        const invoice = await repo.insertInvoice(trx, {
            userId,
            kind: "subscription",
            ref: repo.subscriptionInvoiceRef(subscription.id),
            amountMinor,
            currency: plan.currency,
            status: "paid",
        });
        const withPlan = await repo.findSubscriptionWithPlanOwned(trx, subscription.id, userId);
        return { subscription: withPlan ?? subscription, invoice };
    });
}
export async function currentSubscription(db, userId) {
    return repo.findCurrentSubscriptionWithPlan(db, userId);
}
export async function cancelSubscription(db, userId, id) {
    const existing = await repo.findSubscriptionWithPlanOwned(db, id, userId);
    if (!existing) {
        throw notFound("Subscription not found");
    }
    if (existing.status === "canceled") {
        throw new AppError(409, "CONFLICT", "Subscription is already canceled");
    }
    const canceled = await repo.cancelSubscriptionOwned(db, id, userId);
    return canceled ?? { ...existing, status: "canceled", canceled_at: new Date() };
}
export async function invoicesForSubscription(db, userId, id) {
    const existing = await repo.findSubscriptionWithPlanOwned(db, id, userId);
    if (!existing) {
        throw notFound("Subscription not found");
    }
    return repo.listInvoicesForSubscription(db, userId, id);
}
export function ownInvoices(db, userId) {
    return repo.listOwnInvoices(db, userId);
}
