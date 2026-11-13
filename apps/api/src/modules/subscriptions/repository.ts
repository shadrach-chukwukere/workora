import crypto from "node:crypto";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "../../database/types.js";

/** Data access for the subscriptions module (demo billing; provider is always 'manual'). */
export type Conn = Kysely<DB>;

export function listActivePlans(db: Conn) {
  return db
    .selectFrom("subscription_plans")
    .select([
      "id",
      "code",
      "name",
      "audience",
      "price_minor",
      "currency",
      "interval",
      "is_highlighted",
      "features",
      "is_active",
      "sort_order",
    ])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .orderBy("price_minor", "asc")
    .execute();
}

export function findPlanById(db: Conn, planId: string) {
  return db.selectFrom("subscription_plans").selectAll().where("id", "=", planId).executeTakeFirst();
}

export function insertSubscription(
  db: Conn,
  row: {
    userId: string;
    planId: string;
    interval: "monthly" | "annual";
    amountMinor: number;
    currency: string;
    currentPeriodEnd: Date;
  },
) {
  return db
    .insertInto("subscriptions")
    .values({
      user_id: row.userId,
      plan_id: row.planId,
      status: "active",
      interval: row.interval,
      amount_minor: row.amountMinor,
      currency: row.currency,
      provider: "manual", // DEMO: no provider charge is ever made
      provider_subscription_id: `demo-sub-${crypto.randomUUID()}`,
      current_period_end: row.currentPeriodEnd,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findCurrentSubscriptionWithPlan(db: Conn, userId: string) {
  return db
    .selectFrom("subscriptions as s")
    .innerJoin("subscription_plans as p", "p.id", "s.plan_id")
    .select([
      "s.id",
      "s.user_id",
      "s.plan_id",
      "s.status",
      "s.interval",
      "s.amount_minor",
      "s.currency",
      "s.provider",
      "s.provider_subscription_id",
      "s.started_at",
      "s.current_period_end",
      "s.canceled_at",
      "s.created_at",
      "p.code as plan_code",
      "p.name as plan_name",
      "p.audience as plan_audience",
      "p.interval as plan_interval",
      "p.features as plan_features",
      "p.is_highlighted as plan_is_highlighted",
    ])
    .where("s.user_id", "=", userId)
    .where("s.status", "=", "active")
    .orderBy("s.started_at", "desc")
    .limit(1)
    .execute();
}

export function findSubscriptionWithPlanOwned(db: Conn, id: string, userId: string) {
  return db
    .selectFrom("subscriptions as s")
    .innerJoin("subscription_plans as p", "p.id", "s.plan_id")
    .select([
      "s.id",
      "s.user_id",
      "s.plan_id",
      "s.status",
      "s.interval",
      "s.amount_minor",
      "s.currency",
      "s.provider",
      "s.provider_subscription_id",
      "s.started_at",
      "s.current_period_end",
      "s.canceled_at",
      "s.created_at",
      "p.code as plan_code",
      "p.name as plan_name",
      "p.audience as plan_audience",
      "p.interval as plan_interval",
      "p.features as plan_features",
      "p.is_highlighted as plan_is_highlighted",
    ])
    .where("s.id", "=", id)
    .where("s.user_id", "=", userId)
    .executeTakeFirst();
}

export function cancelSubscriptionOwned(db: Conn, id: string, userId: string) {
  return db
    .updateTable("subscriptions")
    .set({ status: "canceled", canceled_at: new Date(), updated_at: new Date() })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .returningAll()
    .executeTakeFirst();
}

export function insertInvoice(
  db: Conn,
  row: { userId: string; kind: "subscription" | "payment"; ref: string; amountMinor: number; currency: string; status: "open" | "paid" | "void" },
) {
  return db
    .insertInto("invoices")
    .values({
      user_id: row.userId,
      kind: row.kind,
      ref: row.ref,
      amount_minor: row.amountMinor,
      currency: row.currency,
      status: row.status,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Invoices carry no subscription FK, so the subscription id is embedded in the invoice ref
 * (`sub_<subscriptionId>_<suffix>`). That lets us list invoices for one subscription.
 */
export function listInvoicesForSubscription(db: Conn, userId: string, subscriptionId: string) {
  return db
    .selectFrom("invoices")
    .selectAll()
    .where("user_id", "=", userId)
    .where("kind", "=", "subscription")
    .where("ref", "like", `sub_${subscriptionId}_%`)
    .orderBy("issued_at", "desc")
    .execute();
}

export function listOwnInvoices(db: Conn, userId: string, limit = 100) {
  return db
    .selectFrom("invoices")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("issued_at", "desc")
    .limit(limit)
    .execute();
}

export function subscriptionInvoiceRef(subscriptionId: string): string {
  return `sub_${subscriptionId}_${crypto.randomUUID().slice(0, 8)}`;
}
