import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";
import { requireAccountType, requirePermission } from "../../middleware/authenticate.js";

/** Admin dashboard + user management. Everything here requires admin access. */
export default async function adminRoutes(app: FastifyInstance) {
  /** GET /admin/overview — platform counters. */
  app.get("/admin/overview", { preHandler: [requirePermission("admin.access")] }, async (_request, reply) => {
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
  app.get("/admin/users", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const q = String((request.query as Record<string, string>).q ?? "").trim();
    const status = (request.query as Record<string, string>).status;
    const accountType = (request.query as Record<string, string>).accountType;
    const instance = await db();
    let builder = instance
      .selectFrom("users as u")
      .leftJoin("freelancer_profiles as fp", "fp.user_id", "u.id")
      .leftJoin("client_profiles as cp", "cp.user_id", "u.id")
      .select([
        "u.id", "u.name", "u.email", "u.image", "u.account_type", "u.status", "u.email_verified", "u.verified", "u.verification_provider", "u.verified_at", "u.created_at",
        "fp.headline", "fp.about", "fp.location", "fp.timezone", "fp.hourly_rate_minor", "fp.currency",
        "fp.availability", "fp.experience_level", "fp.response_time_hours", "fp.verified_identity",
        "fp.is_featured", "fp.featured_rank", "fp.rating_avg", "fp.rating_count", "fp.completed_count", "fp.earnings_minor",
        "cp.company_name", "cp.company_size", "cp.industry", "cp.website", "cp.about", "cp.spent_minor", "cp.projects_count",
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

  /** GET /admin/users/:id — the complete account record plus all content it owns. */
  app.get("/admin/users/:id", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const instance = await db();
    const user = await instance.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
    if (!user) {
      reply.status(404).send({ success: false, message: "Account not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }

    const [freelancer, client, projects, portfolio, reviews, experience, education, certifications] = await Promise.all([
      instance.selectFrom("freelancer_profiles").selectAll().where("user_id", "=", id).executeTakeFirst() ?? Promise.resolve(null),
      instance.selectFrom("client_profiles").selectAll().where("user_id", "=", id).executeTakeFirst() ?? Promise.resolve(null),
      user.account_type === "client"
        ? instance.selectFrom("projects")
            .select(["id", "title", "status", "budget_min_minor", "budget_max_minor", "currency", "created_at"])
            .where("client_id", "=", id).orderBy("created_at", "desc").limit(100).execute()
        : instance.selectFrom("projects")
            .select(["id", "title", "status", "budget_min_minor", "budget_max_minor", "currency", "created_at"])
            .where("id", "in", (eb) => eb.selectFrom("proposals").select("project_id").where("freelancer_id", "=", id))
            .orderBy("created_at", "desc").limit(100).execute(),
      instance.selectFrom("portfolio_projects")
        .select(["id", "title", "summary", "role", "year", "project_url", "sort_order", "created_at"])
        .where("freelancer_id", "=", id).orderBy("sort_order", "asc").limit(100).execute(),
      instance.selectFrom("reviews as r")
        .innerJoin("users as reviewer", "reviewer.id", "r.reviewer_id")
        .innerJoin("users as reviewee", "reviewee.id", "r.reviewee_id")
        .select(["r.id", "r.rating", "r.comment", "r.created_at", "reviewer.name as reviewer_name", "reviewee.name as reviewee_name"])
        .where((eb) => eb.or([eb("r.reviewer_id", "=", id), eb("r.reviewee_id", "=", id)]))
        .orderBy("r.created_at", "desc").limit(100).execute(),
      instance.selectFrom("work_experiences").selectAll().where("freelancer_id", "=", id).orderBy("start_date", "desc").limit(100).execute(),
      instance.selectFrom("education").selectAll().where("freelancer_id", "=", id).orderBy("start_year", "desc").limit(100).execute(),
      instance.selectFrom("certifications").selectAll().where("freelancer_id", "=", id).orderBy("year", "desc").limit(100).execute(),
    ]);

    reply.send(ok({ user, freelancer, client, content: { projects, portfolio, reviews, experience, education, certifications } }));
  });

  /** PATCH /admin/users/:id — edit identity, contact details, status and role profile. Never changes account_type. */
  app.patch("/admin/users/:id", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const instance = await db();
    const existing = await instance.selectFrom("users").select(["id", "email"]).where("id", "=", id).executeTakeFirst();
    if (!existing) {
      reply.status(404).send({ success: false, message: "Account not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }

    const userPatch: Record<string, unknown> = {};
    const textFields = [
      "name", "image", "banner_url", "phone", "github_url", "linkedin_url",
      "twitter_url", "instagram_url", "website_url", "portfolio_url",
    ];
    for (const field of textFields) {
      const value = body[field];
      if (typeof value === "string" || value === null) userPatch[field] = typeof value === "string" ? value.trim() : null;
    }
    if (typeof userPatch.name === "string" && (userPatch.name as string).length < 2) {
      reply.status(400).send({ success: false, message: "Name must be at least 2 characters", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    if (typeof body.status === "string" && ["active", "suspended", "restricted"].includes(body.status)) {
      userPatch.status = body.status;
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        reply.status(400).send({ success: false, message: "Enter a valid email address", error: { code: "VALIDATION_ERROR", details: {} } });
        return;
      }
      const clash = await instance.selectFrom("users").select("id").where("email", "=", email).where("id", "!=", id).executeTakeFirst();
      if (clash) {
        reply.status(409).send({ success: false, message: "Another account already uses that email", error: { code: "CONFLICT", details: {} } });
        return;
      }
      userPatch.email = email;
    }
    if (Object.keys(userPatch).length > 0) {
      await instance.updateTable("users").set(userPatch as never).where("id", "=", id).execute();
    }

    const freelancerBody = body.freelancer;
    if (freelancerBody && typeof freelancerBody === "object") {
      const input = freelancerBody as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const field of ["headline", "about", "location", "timezone", "currency"] as const) {
        const value = input[field];
        if (typeof value === "string" || value === null) patch[field] = typeof value === "string" ? value.trim() : null;
      }
      for (const field of ["hourly_rate_minor", "response_time_hours", "featured_rank"] as const) {
        const value = input[field];
        if (value === null || (typeof value === "number" && Number.isFinite(value))) patch[field] = value;
      }
      if (typeof input.availability === "string" && ["available", "limited", "unavailable"].includes(input.availability)) {
        patch.availability = input.availability;
      }
      if (typeof input.experience_level === "string" && ["entry", "intermediate", "expert"].includes(input.experience_level)) {
        patch.experience_level = input.experience_level;
      }
      if (typeof input.is_featured === "boolean") patch.is_featured = input.is_featured;
      if (Object.keys(patch).length > 0) {
        await instance.updateTable("freelancer_profiles").set(patch as never).where("user_id", "=", id).execute();
      }
    }

    const clientBody = body.client;
    if (clientBody && typeof clientBody === "object") {
      const input = clientBody as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const field of ["company_name", "industry", "website", "about"] as const) {
        const value = input[field];
        if (typeof value === "string" || value === null) patch[field] = typeof value === "string" ? value.trim() : null;
      }
      if (typeof input.company_size === "string" && ["1-10", "11-50", "51-200", "201-1000", "1000+"].includes(input.company_size)) {
        patch.company_size = input.company_size;
      }
      if (Object.keys(patch).length > 0) {
        await instance.updateTable("client_profiles").set(patch as never).where("user_id", "=", id).execute();
      }
    }

    reply.send(ok({ id }, "Account updated"));
  });

  /** Editable content owned by an account. Users are never deletable. */
  const ADMIN_CONTENT_TABLES: Record<string, string> = {
    project: "projects",
    portfolio: "portfolio_projects",
    review: "reviews",
    experience: "work_experiences",
    education: "education",
    certification: "certifications",
  };

  const ADMIN_CONTENT_FIELDS: Record<string, string[]> = {
    project: ["title", "summary", "description", "status", "budget_min_minor", "budget_max_minor"],
    portfolio: ["title", "summary", "description", "role", "year", "project_url", "image_url", "sort_order"],
    review: ["rating", "comment"],
    experience: ["company", "role", "description", "start_date", "end_date"],
    education: ["school", "degree", "field", "start_year", "end_year"],
    certification: ["name", "issuer", "year", "credential_url"],
  };

  /** PATCH /admin/content/:kind/:id — edit one piece of owned content. */
  app.patch("/admin/content/:kind/:id", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const { kind, id } = request.params as { kind: string; id: string };
    const table = ADMIN_CONTENT_TABLES[kind];
    if (!table) {
      reply.status(400).send({ success: false, message: "Unknown content type", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const allowed = new Set(ADMIN_CONTENT_FIELDS[kind] ?? []);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowed.has(key) && (typeof value === "string" || typeof value === "number" || value === null)) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length === 0) {
      reply.status(400).send({ success: false, message: "No fields to update", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const updated = await (instance as unknown as {
      updateTable: (name: string) => {
        set: (value: Record<string, unknown>) => { where: (column: string, op: string, id: string) => { returning: (column: string) => { executeTakeFirst: () => Promise<{ id: string } | undefined> } } };
      };
    })
      .updateTable(table).set(patch).where("id", "=", id).returning("id").executeTakeFirst();
    if (!updated) {
      reply.status(404).send({ success: false, message: "Content not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: updated.id }, "Content updated"));
  });

  /** DELETE /admin/content/:kind/:id — remove one piece of owned content (never a user). */
  app.delete("/admin/content/:kind/:id", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const { kind, id } = request.params as { kind: string; id: string };
    const table = ADMIN_CONTENT_TABLES[kind];
    if (!table) {
      reply.status(400).send({ success: false, message: "Unknown content type", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    try {
      const deleted = await (instance as unknown as {
        deleteFrom: (name: string) => { where: (column: string, op: string, id: string) => { returning: (column: string) => { executeTakeFirst: () => Promise<{ id: string } | undefined> } } };
      })
        .deleteFrom(table).where("id", "=", id).returning("id").executeTakeFirst();
      if (!deleted) {
        reply.status(404).send({ success: false, message: "Content not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      reply.send(ok({ id: deleted.id }, "Content removed"));
    } catch (error) {
      request.log.warn({ err: error }, "admin content delete failed");
      reply.status(409).send({
        success: false,
        message: "This item is linked to other records. Remove those links first, then try again.",
        error: { code: "CONFLICT", details: {} },
      });
    }
  });

  /** PATCH /admin/freelancers/:id/curation — set editorial placement for launch talent. */
  app.patch("/admin/freelancers/:id/curation", { preHandler: [requirePermission("admin.users")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { is_featured?: unknown; featured_rank?: unknown };
    if (
      typeof body.is_featured !== "boolean" ||
      (body.featured_rank !== undefined &&
        (typeof body.featured_rank !== "number" ||
          !Number.isInteger(body.featured_rank) ||
          body.featured_rank < 0 ||
          body.featured_rank > 9999))
    ) {
      reply.status(400).send({
        success: false,
        message: "is_featured must be a boolean and featured_rank must be an integer from 0 to 9999",
        error: { code: "VALIDATION_ERROR", details: {} },
      });
      return;
    }

    const instance = await db();
    const updated = await instance
      .updateTable("freelancer_profiles")
      .set({
        is_featured: body.is_featured,
        ...(typeof body.featured_rank === "number"
          ? { featured_rank: body.featured_rank }
          : body.is_featured
            ? {}
            : { featured_rank: 100 }),
      })
      .where("user_id", "=", id)
      .returning("user_id")
      .executeTakeFirst();
    if (!updated) {
      reply.status(404).send({ success: false, message: "Freelancer profile not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ user_id: updated.user_id }, body.is_featured ? "Freelancer featured" : "Freelancer removed from curation"));
  });

  /** GET /admin/projects — every project across the platform, optional status/q/categoryId filters. */
  app.get("/admin/projects", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.get("/admin/contracts", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.get("/admin/transactions", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.get("/admin/disputes", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.get("/admin/reviews", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.get("/admin/subscriptions", { preHandler: [requirePermission("admin.access")] }, async (_request, reply) => {
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
  app.get("/admin/categories", { preHandler: [requirePermission("admin.access")] }, async (_request, reply) => {
    const instance = await db();
    const rows = await sql<{
      id: string; slug: string; name: string; description: string; kind: string; sort_order: number;
      is_launch_focus: boolean; launch_rank: number; projects_count: string; skills_count: string;
    }>`
      SELECT c.id, c.slug, c.name, c.description, c.kind, c.sort_order, c.is_launch_focus, c.launch_rank,
             (SELECT COUNT(*) FROM projects p WHERE p.category_id = c.id)::text AS projects_count,
             (SELECT COUNT(*) FROM category_skills cs WHERE cs.category_id = c.id)::text AS skills_count
      FROM categories c
      ORDER BY c.sort_order, c.name
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ categories: rows }));
  });

  /** POST /admin/categories — create a category. */
  app.post("/admin/categories", { preHandler: [requirePermission("admin.moderation")] }, async (request, reply) => {
    const body = request.body as {
      slug?: string;
      name?: string;
      description?: string;
      kind?: "category" | "specialty";
      sort_order?: number;
      is_launch_focus?: boolean;
      launch_rank?: number;
    };
    if (!body.slug?.trim() || !body.name?.trim()) {
      reply.status(400).send({ success: false, message: "slug and name are required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const inserted = await sql<{ id: string }>`
      INSERT INTO categories (slug, name, description, kind, sort_order, is_launch_focus, launch_rank)
      VALUES (
        ${body.slug.trim().toLowerCase()}, ${body.name.trim()}, ${body.description?.trim() ?? ""},
        ${body.kind ?? "category"}, ${body.sort_order ?? 100},
        ${body.is_launch_focus === true}, ${Number.isFinite(body.launch_rank) ? body.launch_rank : 100}
      )
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]!);
    reply.status(201).send(ok({ id: inserted.id }, "Category created"));
  });

  /** PATCH /admin/categories/:id — update name/description/sort_order. */
  app.patch("/admin/categories/:id", { preHandler: [requirePermission("admin.moderation")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      sort_order?: number;
      is_launch_focus?: boolean;
      launch_rank?: number;
    };
    const instance = await db();
    const updated = await sql<{ id: string }>`
      UPDATE categories
      SET name = COALESCE(${body.name?.trim() ?? null}, name),
          description = COALESCE(${body.description?.trim() ?? null}, description),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order),
          is_launch_focus = COALESCE(${body.is_launch_focus ?? null}, is_launch_focus),
          launch_rank = COALESCE(${body.launch_rank ?? null}, launch_rank)
      WHERE id = ${id}
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]);
    if (!updated) {
      reply.status(404).send({ success: false, message: "Category not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: updated.id }, "Category updated"));
  });

  /** DELETE /admin/categories/:id — remove a category. Linked skills cascade and projects keep their history with a null category. */
  app.delete("/admin/categories/:id", { preHandler: [requirePermission("admin.moderation")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const instance = await db();
    const deleted = await sql<{ id: string }>`DELETE FROM categories WHERE id = ${id} RETURNING id`.execute(instance);
    if (!deleted.rows[0]) {
      reply.status(404).send({ success: false, message: "Category not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: deleted.rows[0].id }, "Category removed"));
  });

  /** GET /admin/analytics/monthly?months=12 — trailing monthly trend, sparse months filled with zeros. */
  app.get("/admin/analytics/monthly", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
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
  app.post("/admin/users/:id/suspend", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'suspended' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User suspended"));
  });

  /** POST /admin/users/:id/activate — reactivate a user. */
  app.post("/admin/users/:id/activate", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'active' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User activated"));
  });

  /** POST /admin/users/:id/restrict — restrict a user. */
  app.post("/admin/users/:id/restrict", { preHandler: [requirePermission("admin.access")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const instance = await db();
    await sql`UPDATE users SET status = 'restricted' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "User restricted"));
  });

}
