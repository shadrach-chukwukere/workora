import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";
import { requireAccountType, requirePermission } from "../../middleware/authenticate.js";

/** Admin dashboard + user management. Everything here requires admin access. */
export default async function adminRoutes(app: FastifyInstance) {
  /** GET /admin/overview — platform counters. */
  app.get("/admin/overview", { preHandler: [requireAccountType("admin")] }, async (_request, reply) => {
    const instance = await db();
    const [users, projects, contracts, disputes, verification, revenue] = await Promise.all([
      sql<{ freelancers: string; clients: string; admins: string; new_this_month: string }>`
        SELECT
          COUNT(*) FILTER (WHERE account_type = 'freelancer')::text AS freelancers,
          COUNT(*) FILTER (WHERE account_type = 'client')::text AS clients,
          COUNT(*) FILTER (WHERE account_type = 'admin')::text AS admins,
          COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::text AS new_this_month
        FROM users
      `.execute(instance).then((r) => r.rows[0]!),
      sql<{ open: string; in_progress: string; completed: string }>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::text AS open,
          COUNT(*) FILTER (WHERE status = 'in_progress')::text AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
        FROM projects
      `.execute(instance).then((r) => r.rows[0]!),
      sql<{ active: string; completed: string }>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::text AS active,
          COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
        FROM contracts
      `.execute(instance).then((r) => r.rows[0]!),
      sql<{ open: string; under_review: string }>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::text AS open,
          COUNT(*) FILTER (WHERE status = 'under_review')::text AS under_review
        FROM disputes
      `.execute(instance).then((r) => r.rows[0]!),
      sql<{ pending: string; info_requested: string }>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
          COUNT(*) FILTER (WHERE status = 'info_requested')::text AS info_requested
        FROM verification_requests
      `.execute(instance).then((r) => r.rows[0]!),
      sql<{ revenue: string; commission: string }>`
        SELECT COALESCE(SUM(amount_minor), 0)::text AS revenue, COALESCE(SUM(CASE WHEN type = 'commission' THEN amount_minor ELSE 0 END), 0)::text AS commission
        FROM transactions WHERE status = 'completed'
      `.execute(instance).then((r) => r.rows[0]!),
    ]);

    reply.send(
      ok({
        users: { ...users, total: Number(users.freelancers) + Number(users.clients) + Number(users.admins), new_this_month: Number(users.new_this_month) },
        projects,
        contracts,
        disputes,
        verification,
        revenueMinor: Number(revenue.revenue),
        commissionMinor: Number(revenue.commission),
      }),
    );
  });

  /** GET /admin/users — search and filter. */
  app.get("/admin/users", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const q = String((request.query as Record<string, string>).q ?? "").trim();
    const status = (request.query as Record<string, string>).status;
    const accountType = (request.query as Record<string, string>).accountType;
    const instance = await db();
    let builder = instance
      .selectFrom("users as u")
      .leftJoin("freelancer_profiles as fp", "fp.user_id", "u.id")
      .leftJoin("client_profiles as cp", "cp.user_id", "u.id")
      .select([
        "u.id", "u.name", "u.email", "u.image", "u.account_type", "u.status", "u.email_verified", "u.created_at",
        "fp.headline", "fp.location", "fp.hourly_rate_minor", "fp.verified_identity",
        "fp.rating_avg", "fp.rating_count", "fp.completed_count",
        "cp.company_name", "cp.industry", "cp.spent_minor", "cp.projects_count",
      ])
      .orderBy("u.created_at", "desc").limit(100);
    if (q) builder = builder.where((eb) => eb.or([eb("u.name", "ilike", `%${q}%`), eb("u.email", "ilike", `%${q}%`)]));
    if (status) builder = builder.where("u.status", "=", status as "active" | "suspended" | "restricted");
    if (accountType === "freelancer" || accountType === "client" || accountType === "admin") {
      builder = builder.where("u.account_type", "=", accountType);
    }
    const rows = await builder.execute();
    reply.send(ok({ users: rows.map((r) => ({ ...r })) }));
  });

  /** GET /admin/projects — every project across the platform, optional status/q/categoryId filters. */
  app.get("/admin/projects", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = (query.q ?? "").trim();
    const status = query.status;
    const categoryId = query.categoryId;
    const page = Math.max(1, Number(query.page ?? "1") || 1);
    const perPage = Math.min(100, Math.max(1, Number(query.perPage ?? "50") || 50));
    const instance = await db();
    const filters = [
      status ? sql`AND p.status = ${status}` : sql``,
      q ? sql`AND (p.title ILIKE ${"%" + q + "%"} OR p.summary ILIKE ${"%" + q + "%"})` : sql``,
      categoryId ? sql`AND p.category_id = ${categoryId}` : sql``,
    ];
    const rows = await sql<{
      id: string; title: string; status: string; budget_type: string; budget_min_minor: string | null; budget_max_minor: string | null;
      currency: string; experience_level: string | null; proposals_count: number; published_at: Date | null; created_at: Date;
      category_name: string | null; client_name: string | null; client_company_name: string | null;
    }>`
      SELECT p.id, p.title, p.status, p.budget_type, p.budget_min_minor::text AS budget_min_minor, p.budget_max_minor::text AS budget_max_minor,
             p.currency, p.experience_level, p.proposals_count, p.published_at, p.created_at,
             c.name AS category_name, cu.name AS client_name, cp.company_name AS client_company_name
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN users cu ON cu.id = p.client_id
      LEFT JOIN client_profiles cp ON cp.user_id = p.client_id
      WHERE 1 = 1 ${sql.join(filters, sql` `)}
      ORDER BY p.created_at DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `.execute(instance).then((r) => r.rows);
    const total = Number((await sql<{ count: string }>`SELECT COUNT(*)::text AS count FROM projects p WHERE 1 = 1 ${sql.join(filters, sql` `)}`.execute(instance).then((r) => r.rows[0]!.count)));
    reply.send(ok({ projects: rows, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }));
  });

  /** GET /admin/contracts — every contract with both parties and milestone tallies. */
  app.get("/admin/contracts", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = (query.q ?? "").trim();
    const status = query.status;
    const instance = await db();
    const filters = [
      status ? sql`AND c.status = ${status}` : sql``,
      q ? sql`AND (c.title_snapshot ILIKE ${"%" + q + "%"} OR cu.name ILIKE ${"%" + q + "%"} OR fu.name ILIKE ${"%" + q + "%"})` : sql``,
    ];
    const rows = await sql<{
      id: string; title_snapshot: string; status: string; total_minor: string; currency: string; started_at: Date | null; ended_at: Date | null; created_at: Date;
      client_name: string; freelancer_name: string; project_title: string;
      milestones_total: string; milestones_paid: string; milestone_total_minor: string; milestone_paid_minor: string;
    }>`
      SELECT c.id, c.title_snapshot, c.status, c.total_minor::text AS total_minor, c.currency, c.started_at, c.ended_at, c.created_at,
             cu.name AS client_name, fu.name AS freelancer_name, p.title AS project_title,
             COALESCE(m.total, 0)::text AS milestones_total, COALESCE(m.paid, 0)::text AS milestones_paid,
             COALESCE(m.total_amount, 0)::text AS milestone_total_minor, COALESCE(m.paid_amount, 0)::text AS milestone_paid_minor
      FROM contracts c
      JOIN users cu ON cu.id = c.client_id
      JOIN users fu ON fu.id = c.freelancer_id
      JOIN projects p ON p.id = c.project_id
      LEFT JOIN (
        SELECT contract_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'paid') AS paid,
               SUM(amount_minor) AS total_amount, SUM(amount_minor) FILTER (WHERE status = 'paid') AS paid_amount
        FROM contract_milestones GROUP BY contract_id
      ) m ON m.contract_id = c.id
      WHERE 1 = 1 ${sql.join(filters, sql` `)}
      ORDER BY c.created_at DESC
      LIMIT 100
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ contracts: rows }));
  });

  /** GET /admin/transactions — the full platform ledger with user names. */
  app.get("/admin/transactions", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = (query.q ?? "").trim();
    const type = query.type;
    const status = query.status;
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? "100") || 100));
    const instance = await db();
    const filters = [
      type ? sql`AND t.type = ${type}` : sql``,
      status ? sql`AND t.status = ${status}` : sql``,
      q ? sql`AND (t.description ILIKE ${"%" + q + "%"} OR u.name ILIKE ${"%" + q + "%"} OR u.email ILIKE ${"%" + q + "%"})` : sql``,
    ];
    const rows = await sql<{
      id: string; user_id: string; user_name: string; type: string; amount_minor: string; currency: string; status: string; description: string; created_at: Date; contract_id: string | null;
    }>`
      SELECT t.id, t.user_id, u.name AS user_name, t.type, t.amount_minor::text AS amount_minor, t.currency, t.status, t.description, t.created_at, t.contract_id
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE 1 = 1 ${sql.join(filters, sql` `)}
      ORDER BY t.created_at DESC
      LIMIT ${limit}
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ transactions: rows }));
  });

  /** GET /admin/disputes — every dispute in the platform, newest first. */
  app.get("/admin/disputes", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const status = query.status;
    const instance = await db();
    const filters = [status ? sql`AND d.status = ${status}` : sql``];
    const rows = await sql<{
      id: string; contract_id: string; title_snapshot: string; contract_total_minor: string; opened_by: string; opened_by_name: string; client_name: string; freelancer_name: string;
      status: string; reason: string; details: string; amount_minor: string; currency: string; resolution: string | null; resolution_outcome: string | null;
      opened_at: Date; resolved_at: Date | null;
    }>`
      SELECT d.id, d.contract_id, c.title_snapshot, c.total_minor::text AS contract_total_minor, d.opened_by, opener.name AS opened_by_name,
             cu.name AS client_name, fu.name AS freelancer_name,
             d.status, d.reason, d.details, d.amount_minor::text AS amount_minor, d.currency, d.resolution, d.resolution_outcome, d.opened_at, d.resolved_at
      FROM disputes d
      JOIN contracts c ON c.id = d.contract_id
      JOIN users opener ON opener.id = d.opened_by
      JOIN users cu ON cu.id = c.client_id
      JOIN users fu ON fu.id = c.freelancer_id
      WHERE 1 = 1 ${sql.join(filters, sql` `)}
      ORDER BY d.opened_at DESC
      LIMIT 100
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ disputes: rows }));
  });

  /** GET /admin/reviews — all reviews with author + subject names, optional status filter via review_reports. */
  app.get("/admin/reviews", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = (query.q ?? "").trim();
    const reportedOnly = query.reported === "true" || query.reported === "1";
    const instance = await db();
    const filters = [
      q ? sql`AND (ru.name ILIKE ${"%" + q + "%"} OR su.name ILIKE ${"%" + q + "%"} OR r.comment ILIKE ${"%" + q + "%"})` : sql``,
    ];
    const rows = await sql<{
      id: string; rating: number; comment: string; created_at: Date; reviewer_name: string; subject_name: string; reported: boolean;
    }>`
      SELECT r.id, r.rating, r.comment, r.created_at,
             ru.name AS reviewer_name, su.name AS subject_name,
             EXISTS(SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id AND rr.status = 'open') AS reported
      FROM reviews r
      JOIN users ru ON ru.id = r.reviewer_id
      JOIN users su ON su.id = r.reviewee_id
      WHERE 1 = 1 ${sql.join(filters, sql` `)}
      ORDER BY r.created_at DESC
      LIMIT 200
    `.execute(instance).then((r) => r.rows);
    const filtered = reportedOnly ? rows.filter((r) => r.reported) : rows;
    reply.send(ok({ reviews: filtered }));
  });

  /** GET /admin/subscriptions — every subscription with plan and user. */
  app.get("/admin/subscriptions", { preHandler: [requireAccountType("admin")] }, async (_request, reply) => {
    const instance = await db();
    const rows = await sql<{
      id: string; status: string; interval: string; amount_minor: string; currency: string; provider: string;
      started_at: Date; current_period_end: Date | null; canceled_at: Date | null;
      plan_code: string; plan_name: string; audience: string; user_name: string; user_email: string; account_type: string;
    }>`
      SELECT s.id, s.status, s.interval, s.amount_minor::text AS amount_minor, s.currency, s.provider,
             s.started_at, s.current_period_end, s.canceled_at,
             p.code AS plan_code, p.name AS plan_name, p.audience, u.name AS user_name, u.email AS user_email, u.account_type
      FROM subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 200
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ subscriptions: rows }));
  });

  /** GET /admin/categories — every category with project volume. */
  app.get("/admin/categories", { preHandler: [requireAccountType("admin")] }, async (_request, reply) => {
    const instance = await db();
    const rows = await sql<{
      id: string; slug: string; name: string; description: string; kind: string; sort_order: number; projects_count: string; skills_count: string;
    }>`
      SELECT c.id, c.slug, c.name, c.description, c.kind, c.sort_order,
             (SELECT COUNT(*) FROM projects p WHERE p.category_id = c.id)::text AS projects_count,
             (SELECT COUNT(*) FROM freelancer_skills fs WHERE fs.skill_id = c.id)::text AS skills_count
      FROM categories c
      ORDER BY c.sort_order, c.name
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ categories: rows }));
  });

  /** POST /admin/categories — create a category. */
  app.post("/admin/categories", { preHandler: [requirePermission("admin.moderation")] }, async (request, reply) => {
    const body = request.body as { slug?: string; name?: string; description?: string; kind?: "category" | "specialty"; sort_order?: number };
    if (!body.slug?.trim() || !body.name?.trim()) {
      reply.status(400).send({ success: false, message: "slug and name are required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const inserted = await sql<{ id: string }>`
      INSERT INTO categories (slug, name, description, kind, sort_order)
      VALUES (${body.slug.trim().toLowerCase()}, ${body.name.trim()}, ${body.description?.trim() ?? ""}, ${body.kind ?? "category"}, ${body.sort_order ?? 100})
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]!);
    reply.status(201).send(ok({ id: inserted.id }, "Category created"));
  });

  /** PATCH /admin/categories/:id — update name/description/sort_order. */
  app.patch("/admin/categories/:id", { preHandler: [requirePermission("admin.moderation")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; sort_order?: number };
    const instance = await db();
    const updated = await sql<{ id: string }>`
      UPDATE categories
      SET name = COALESCE(${body.name?.trim() ?? null}, name),
          description = COALESCE(${body.description?.trim() ?? null}, description),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order)
      WHERE id = ${id}
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]);
    if (!updated) {
      reply.status(404).send({ success: false, message: "Category not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: updated.id }, "Category updated"));
  });

  /** GET /admin/analytics/monthly?months=12 — trailing monthly trend, sparse months filled with zeros. */
  app.get("/admin/analytics/monthly", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const months = Math.min(24, Math.max(1, Number((request.query as Record<string, string>).months ?? "12") || 12));
    const instance = await db();
    const rows = await sql<{
      month: Date; signups: string; projects_posted: string; contracts_started: string; volume_minor: string;
    }>`
      WITH months AS (
        SELECT generate_series(date_trunc('month', now()) - (interval '1 month' * (${months - 1})), date_trunc('month', now()), interval '1 month') AS month
      ),
      user_signups AS (
        SELECT date_trunc('month', created_at) AS month, COUNT(*) AS n FROM users GROUP BY 1
      ),
      posted AS (
        SELECT date_trunc('month', published_at) AS month, COUNT(*) AS n FROM projects WHERE published_at IS NOT NULL GROUP BY 1
      ),
      started AS (
        SELECT date_trunc('month', started_at) AS month, COUNT(*) AS n FROM contracts GROUP BY 1
      ),
      volume AS (
        SELECT date_trunc('month', created_at) AS month, COALESCE(SUM(amount_minor), 0) AS v FROM transactions WHERE status = 'completed' AND amount_minor > 0 GROUP BY 1
      )
      SELECT months.month, COALESCE(user_signups.n, 0)::text AS signups,
             COALESCE(posted.n, 0)::text AS projects_posted,
             COALESCE(started.n, 0)::text AS contracts_started,
             COALESCE(volume.v, 0)::text AS volume_minor
      FROM months
      LEFT JOIN user_signups ON user_signups.month = months.month
      LEFT JOIN posted ON posted.month = months.month
      LEFT JOIN started ON started.month = months.month
      LEFT JOIN volume ON volume.month = months.month
      ORDER BY months.month
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({
      months: rows.map((r) => ({ month: r.month.toISOString().slice(0, 7), signups: Number(r.signups), projectsPosted: Number(r.projects_posted), contractsStarted: Number(r.contracts_started), volumeMinor: Number(r.volume_minor) })),
    }));
  });

  /** POST /admin/users/:id/suspend — suspend a user. */
  app.post("/admin/users/:id/suspend", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'suspended' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User suspended"));
  });

  /** POST /admin/users/:id/activate — reactivate a user. */
  app.post("/admin/users/:id/activate", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'active' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User activated"));
  });

  /** POST /admin/users/:id/restrict — restrict a user. */
  app.post("/admin/users/:id/restrict", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'restricted' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User restricted"));
  });

  /** POST /admin/impersonate — returns a short-lived impersonation token. For demo, returns user summary. */
  app.post("/admin/impersonate", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const id = (request.body as { id?: string }).id;
    const instance = await db();
    const row = await instance.selectFrom("users").select(["id", "name", "email", "account_type"]).where("id", "=", id ?? "").executeTakeFirst();
    if (!row) {
      reply.status(404).send({ success: false, message: "User not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ impersonated: row, message: "Demo only: production would issue a scoped session token" }));
  });
}
