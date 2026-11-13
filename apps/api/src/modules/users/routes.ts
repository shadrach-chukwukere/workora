import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";
import { publicUser } from "../../utils/serializers.js";

export default async function usersRoutes(app: FastifyInstance) {
  /** GET /api/v1/users/me — current user + profile. */
  app.get("/users/me", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const instance = await db();
    const rows = await sql`
      SELECT u.id, u.name, u.email, u.email_verified, u.image, u.account_type, u.status, u.created_at,
             fp.headline, fp.location, fp.hourly_rate_minor, fp.availability, fp.response_time_hours,
             fp.verified_identity, fp.rating_avg, fp.rating_count, fp.completed_count, fp.earnings_minor,
             cp.company_name, cp.company_size, cp.industry, cp.spent_minor, cp.projects_count
      FROM users u
      LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      WHERE u.id = ${user.id}
    `.execute(instance);
    reply.send(ok({ user: publicUser(rows.rows[0] as Record<string, unknown>) }));
  });

  /** PATCH /users/me/account-type — choose role during onboarding (once). */
  app.patch("/users/me/account-type", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const body = request.body as { accountType?: "freelancer" | "client" };
    if (body.accountType !== "freelancer" && body.accountType !== "client") {
      reply.status(400).send({ success: false, message: "accountType must be freelancer or client", error: { code: "VALIDATION_ERROR", details: { field: "accountType" } } });
      return;
    }
    const instance = await db();
    await sql`UPDATE users SET account_type = ${body.accountType} WHERE id = ${user.id}`.execute(instance);
    if (body.accountType === "freelancer") {
      await sql`INSERT INTO freelancer_profiles (user_id, headline, about) VALUES (${user.id}, 'New to Workora — full profile pending', '') ON CONFLICT (user_id) DO NOTHING`.execute(instance);
    } else {
      await sql`INSERT INTO client_profiles (user_id, about) VALUES (${user.id}, '') ON CONFLICT (user_id) DO NOTHING`.execute(instance);
    }
    reply.send(ok({ accountType: body.accountType }, "Account type saved"));
  });

  /** GET /users/me/projects — caller's own projects (client), all statuses, newest first. */
  app.get("/users/me/projects", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const query = request.query as Record<string, string>;
    const status = query.status;
    const filters = status ? [sql`AND p.status = ${status}`] : [];
    const instance = await db();
    const rows = await sql<{
      id: string; title: string; summary: string; status: string; budget_type: string;
      budget_min_minor: string | null; budget_max_minor: string | null; currency: string;
      experience_level: string | null; duration_bucket: string | null; proposals_count: number;
      published_at: Date | null; deadline: string | null; created_at: Date; category_name: string | null;
    }>`
      SELECT p.id, p.title, p.summary, p.status, p.budget_type, p.budget_min_minor::text AS budget_min_minor, p.budget_max_minor::text AS budget_max_minor,
             p.currency, p.experience_level, p.duration_bucket, p.proposals_count, p.published_at, p.deadline, p.created_at,
             c.name AS category_name
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.client_id = ${user.id} ${sql.join(filters, sql` `)}
      ORDER BY p.created_at DESC
      LIMIT 100
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ projects: rows }));
  });

  /** GET /users/me/project-proposals — proposals received on caller's own projects (client). */
  app.get("/users/me/project-proposals", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const instance = await db();
    const rows = await sql<{
      id: string; project_id: string; project_title: string; project_status: string; cover_letter: string;
      bid_type: string; bid_amount_minor: string; duration_days: number | null; status: string; submitted_at: Date;
      freelancer_id: string; freelancer_name: string; freelancer_image: string | null; freelancer_headline: string | null;
      rating_avg: string | null; completed_count: number | null;
    }>`
      SELECT pr.id, pr.project_id, p.title AS project_title, p.status AS project_status, pr.cover_letter,
             pr.bid_type, pr.bid_amount_minor::text AS bid_amount_minor, pr.duration_days, pr.status, pr.submitted_at,
             u.id AS freelancer_id, u.name AS freelancer_name, u.image AS freelancer_image,
             fp.headline AS freelancer_headline, fp.rating_avg, fp.completed_count
      FROM proposals pr
      JOIN projects p ON p.id = pr.project_id
      JOIN users u ON u.id = pr.freelancer_id
      LEFT JOIN freelancer_profiles fp ON fp.user_id = pr.freelancer_id
      WHERE p.client_id = ${user.id} AND pr.status <> 'withdrawn'
      ORDER BY pr.submitted_at DESC
      LIMIT 200
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ proposals: rows }));
  });

  /** GET /users/me/reviews — reviews written by the caller, with subject name and contract title. */
  app.get("/users/me/reviews", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const instance = await db();
    const rows = await sql<{
      id: string; rating: number; comment: string; created_at: Date;
      subject_id: string; subject_name: string; contract_title: string | null; project_title: string | null; contract_id: string;
    }>`
      SELECT r.id, r.rating, r.comment, r.created_at,
             su.id AS subject_id, su.name AS subject_name,
             c.title_snapshot AS contract_title, p.title AS project_title, r.contract_id
      FROM reviews r
      JOIN users su ON su.id = r.reviewee_id
      LEFT JOIN contracts c ON c.id = r.contract_id
      LEFT JOIN projects p ON p.id = c.project_id
      WHERE r.reviewer_id = ${user.id}
      ORDER BY r.created_at DESC
      LIMIT 100
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ reviews: rows }));
  });

  /** GET /users/me/portfolio — caller's portfolio items (freelancer). */
  app.get("/users/me/portfolio", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const instance = await db();
    const rows = await sql<{
      id: string; title: string; summary: string; description: string; role: string | null;
      year: number | null; project_url: string | null; image_url: string | null;
    }>`
      SELECT id, title, summary, description, role, year, project_url, image_url
      FROM portfolio_projects
      WHERE freelancer_id = ${user.id}
      ORDER BY COALESCE(year, 0) DESC, created_at DESC
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ items: rows }));
  });

  /** POST /users/me/portfolio — add a portfolio item. */
  app.post("/users/me/portfolio", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const body = request.body as { title?: string; description?: string; tags?: string[]; year?: number; project_url?: string; image_url?: string };
    const title = body.title?.trim();
    if (!title) {
      reply.status(400).send({ success: false, message: "title is required", error: { code: "VALIDATION_ERROR", details: { field: "title" } } });
      return;
    }
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    const year = Number.isFinite(body.year) && body.year! >= 1990 && body.year! <= 2100 ? Math.floor(body.year!) : null;
    const instance = await db();
    const inserted = await sql<{ id: string }>`
      INSERT INTO portfolio_projects (freelancer_id, title, summary, description, role, year, project_url, image_url)
      VALUES (${user.id}, ${title}, ${title}, ${body.description?.trim() ?? ""}, ${tags.length > 0 ? tags.join(", ") : null}, ${year}, ${body.project_url?.trim() || null}, ${body.image_url?.trim() || null})
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]!);
    reply.status(201).send(ok({ id: inserted.id }, "Portfolio item added"));
  });

  /** PATCH /users/me/portfolio/:id — update a portfolio item (own only). */
  app.patch("/users/me/portfolio/:id", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const { id } = request.params as { id: string };
    const body = request.body as { title?: string; description?: string; tags?: string[]; year?: number; project_url?: string; image_url?: string };
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).join(", ") : undefined;
    const year = body.year === null ? null : Number.isFinite(body.year) ? Math.floor(body.year!) : undefined;
    const instance = await db();
    const updated = await sql<{ id: string }>`
      UPDATE portfolio_projects
      SET title = COALESCE(${body.title?.trim() ?? null}, title),
          summary = COALESCE(${body.title?.trim() ?? null}, summary),
          description = COALESCE(${body.description?.trim() ?? null}, description),
          role = COALESCE(${tags ?? null}, role),
          year = COALESCE(${year ?? null}, year),
          project_url = COALESCE(${body.project_url?.trim() ?? null}, project_url),
          image_url = COALESCE(${body.image_url?.trim() ?? null}, image_url)
      WHERE id = ${id} AND freelancer_id = ${user.id}
      RETURNING id
    `.execute(instance).then((r) => r.rows[0]);
    if (!updated) {
      reply.status(404).send({ success: false, message: "Portfolio item not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: updated.id }, "Portfolio item updated"));
  });

  /** DELETE /users/me/portfolio/:id — remove a portfolio item (own only). */
  app.delete("/users/me/portfolio/:id", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const { id } = request.params as { id: string };
    const instance = await db();
    const deleted = await sql<{ id: string }>`DELETE FROM portfolio_projects WHERE id = ${id} AND freelancer_id = ${user.id} RETURNING id`.execute(instance).then((r) => r.rows[0]);
    if (!deleted) {
      reply.status(404).send({ success: false, message: "Portfolio item not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: deleted.id }, "Portfolio item removed"));
  });

  /** GET /api/v1/users/:id — public profile (safe fields only). */
  app.get("/users/:id", async (request, reply) => {
    const instance = await db();
    const rows = await sql`
      SELECT u.id, u.name, u.image, u.account_type, u.created_at,
             fp.headline, fp.location, fp.hourly_rate_minor, fp.availability,
             fp.verified_identity, fp.rating_avg, fp.rating_count, fp.completed_count,
             cp.company_name, cp.company_size, cp.industry, cp.projects_count
      FROM users u
      LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      WHERE u.id = ${(request.params as { id: string }).id} AND u.status = 'active'
    `.execute(instance);
    if (rows.rows.length === 0) {
      reply.status(404).send({ success: false, message: "User not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ user: publicUser(rows.rows[0] as Record<string, unknown>) }));
  });

  /** PATCH /api/v1/users/me — update own name/image/about-visible info. */
  app.patch("/users/me", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const body = request.body as { name?: string; image?: string };
    if (typeof body.name === "string" && body.name.trim().length < 2) {
      reply.status(400).send({ success: false, message: "Name must be at least 2 characters", error: { code: "VALIDATION_ERROR", details: { field: "name" } } });
      return;
    }
    const instance = await db();
    if (typeof body.name === "string") {
      await sql`UPDATE users SET name = ${body.name.trim()} WHERE id = ${user.id}`.execute(instance);
    }
    if (typeof body.image === "string") {
      await sql`UPDATE users SET image = ${body.image} WHERE id = ${user.id}`.execute(instance);
    }
    reply.send(ok(null, "Profile updated"));
  });
}
