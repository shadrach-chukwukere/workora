import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { ok, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";

/** Public freelancer directory + owner profile edits. */
export default async function freelancersRoutes(app: FastifyInstance) {
  /** GET /freelancers/:id — public profile with safe fields + portfolio, experience, education, certifications, skills. */
  app.get("/freelancers/:id", async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      reply.status(400).send({ success: false, message: "Invalid profile id", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const profileRows = await sql<{
      id: string; name: string; image: string | null; created_at: Date;
      headline: string; about: string; location: string | null; hourly_rate_minor: string | null; availability: string;
      response_time_hours: number; experience_level: string | null; verified_identity: boolean;
      rating_avg: string | null; rating_count: number; completed_count: number;
    }>`
      SELECT u.id, u.name, u.image, u.created_at,
             fp.headline, fp.about, fp.location, fp.hourly_rate_minor::text AS hourly_rate_minor, fp.availability,
             fp.response_time_hours, fp.experience_level, fp.verified_identity,
             fp.rating_avg, fp.rating_count, fp.completed_count
      FROM users u
      INNER JOIN freelancer_profiles fp ON fp.user_id = u.id
      WHERE u.id = ${id} AND u.status = 'active' AND u.account_type = 'freelancer'
    `.execute(instance).then((r) => r.rows);
    const owner = profileRows[0];
    if (!owner) {
      reply.status(404).send({ success: false, message: "Freelancer not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    const [skills, portfolio, experience, education, certifications] = await Promise.all([
      sql<{ slug: string; name: string }>`
        SELECT s.slug, s.name FROM freelancer_skills fs JOIN skills s ON s.id = fs.skill_id WHERE fs.freelancer_id = ${id} ORDER BY s.name
      `.execute(instance).then((r) => r.rows),
      sql<{ id: string; title: string; description: string; role: string | null; year: number | null; project_url: string | null; image_url: string | null }>`
        SELECT id, title, description, role, year, project_url, image_url FROM portfolio_projects WHERE freelancer_id = ${id} ORDER BY COALESCE(year, 0) DESC, created_at DESC
      `.execute(instance).then((r) => r.rows),
      sql<{ id: string; company: string; role: string; start_date: Date; end_date: Date | null; description: string }>`
        SELECT id, company, role, start_date, end_date, description FROM work_experiences WHERE freelancer_id = ${id} ORDER BY start_date DESC
      `.execute(instance).then((r) => r.rows),
      sql<{ id: string; school: string; degree: string; field: string | null; start_year: number; end_year: number | null }>`
        SELECT id, school, degree, field, start_year, end_year FROM education WHERE freelancer_id = ${id} ORDER BY start_year DESC
      `.execute(instance).then((r) => r.rows),
      sql<{ id: string; name: string; issuer: string | null; year: number | null; credential_url: string | null }>`
        SELECT id, name, issuer, year, credential_url FROM certifications WHERE freelancer_id = ${id} ORDER BY created_at DESC
      `.execute(instance).then((r) => r.rows),
    ]);
    reply.send(ok({
      user: { id: owner.id, name: owner.name, image: owner.image, created_at: owner.created_at.toISOString() },
      profile: {
        headline: owner.headline,
        about: owner.about,
        location: owner.location,
        hourly_rate_minor: owner.hourly_rate_minor === null ? null : Number(owner.hourly_rate_minor),
        availability: owner.availability,
        response_time_hours: owner.response_time_hours,
        experience_level: owner.experience_level,
        verified_identity: owner.verified_identity,
        rating_avg: owner.rating_avg === null ? null : Number(owner.rating_avg),
        rating_count: owner.rating_count,
        completed_count: owner.completed_count,
      },
      skills,
      portfolio,
      experience,
      education,
      certifications,
    }));
  });

  /** PATCH /freelancers/me — update own freelancer profile fields (whitelist only). */
  app.patch("/freelancers/me", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    if (user.accountType !== "freelancer") {
      reply.status(403).send({ success: false, message: "Freelancer account required", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    const body = request.body as {
      headline?: string;
      location?: string;
      hourly_rate_minor?: number | null;
      availability?: "available" | "limited" | "unavailable";
      response_time_hours?: number;
    };
    if (body.availability && !["available", "limited", "unavailable"].includes(body.availability)) {
      reply.status(400).send({ success: false, message: "availability must be available, limited or unavailable", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    if (body.response_time_hours !== undefined) {
      if (!Number.isFinite(body.response_time_hours) || body.response_time_hours! < 1) {
        reply.status(400).send({ success: false, message: "response_time_hours must be a positive number", error: { code: "VALIDATION_ERROR", details: {} } });
        return;
      }
    }
    const rate = body.hourly_rate_minor === null ? null : body.hourly_rate_minor !== undefined ? Math.max(1, Math.floor(body.hourly_rate_minor)) : undefined;
    const instance = await db();
    const updated = await sql<{ user_id: string }>`
      UPDATE freelancer_profiles
      SET headline = COALESCE(${body.headline?.trim() ?? null}, headline),
          location = COALESCE(${body.location?.trim() ?? null}, location),
          hourly_rate_minor = COALESCE(${rate === undefined ? null : rate}, hourly_rate_minor),
          availability = COALESCE(${body.availability ?? null}, availability),
          response_time_hours = COALESCE(${body.response_time_hours ?? null}, response_time_hours)
      WHERE user_id = ${user.id}
      RETURNING user_id
    `.execute(instance).then((r) => r.rows[0]);
    if (!updated) {
      reply.status(404).send({ success: false, message: "Freelancer profile not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ ok: true }, "Profile updated"));
  });


  app.get("/freelancers", async (request: FastifyRequest<{ Querystring: Record<string, string> }>, reply) => {
    const q = String(request.query.q ?? "").trim();
    const categorySlug = request.query.category ? String(request.query.category).toLowerCase() : undefined;
    const availability = request.query.availability ? String(request.query.availability) : undefined;
    const experience = request.query.experience ? String(request.query.experience) : undefined;
    const verified = request.query.verified === "true" ? true : request.query.verified === "false" ? false : undefined;
    const minRate = request.query.min_rate ? Number(request.query.min_rate) : undefined;
    const maxRate = request.query.max_rate ? Number(request.query.max_rate) : undefined;
    const sort = String(request.query.sort ?? "rating");
    const page = Math.max(1, Number(request.query.page ?? 1) || 1);
    const perPage = Math.min(50, Math.max(1, Number(request.query.perPage ?? 20) || 20));

    const instance = await db();

    let builder = instance
      .selectFrom("users as u")
      .innerJoin("freelancer_profiles as fp", "fp.user_id", "u.id")
      .where("u.status", "=", "active")
      .where("u.account_type", "=", "freelancer");

    if (q) {
      builder = builder.where((eb) =>
        eb.or([
          eb("u.name", "ilike", `%${q}%`),
          eb("fp.headline", "ilike", `%${q}%`),
          eb("fp.about", "ilike", `%${q}%`),
        ]),
      );
    }
    if (categorySlug) {
      builder = builder.where("fp.user_id", "in", (eb) =>
        eb
          .selectFrom("freelancer_skills as fs")
          .innerJoin("skills as s", "s.id", "fs.skill_id")
          .where("s.slug", "=", categorySlug)
          .select("fs.freelancer_id"),
      );
    }
    if (availability) builder = builder.where("fp.availability", "=", availability as "available" | "limited" | "unavailable");
    if (experience) builder = builder.where("fp.experience_level", "=", experience as "entry" | "intermediate" | "expert");
    if (verified !== undefined) builder = builder.where("fp.verified_identity", "=", verified);
    if (minRate !== undefined && Number.isFinite(minRate)) builder = builder.where("fp.hourly_rate_minor", ">=", Math.round(minRate * 100));
    if (maxRate !== undefined && Number.isFinite(maxRate)) builder = builder.where("fp.hourly_rate_minor", "<=", Math.round(maxRate * 100));

    const countBuilder = builder.clearSelect().select((eb) => eb.fn.countAll<string>().as("count"));
    const rowsBuilder = builder
      .select([
        "u.id",
        "u.name",
        "u.image",
        "u.created_at",
        "fp.headline",
        "fp.hourly_rate_minor",
        "fp.availability",
        "fp.experience_level",
        "fp.verified_identity",
        "fp.rating_avg",
        "fp.rating_count",
        "fp.completed_count",
        "fp.location",
      ]);

    switch (sort) {
      case "rate_asc":
        rowsBuilder.orderBy("fp.hourly_rate_minor", "asc");
        break;
      case "rate_desc":
        rowsBuilder.orderBy("fp.hourly_rate_minor", "desc");
        break;
      case "newest":
        rowsBuilder.orderBy("u.created_at", "desc");
        break;
      default:
        rowsBuilder.orderBy("fp.rating_avg", "desc");
    }

    const [{ count }] = await countBuilder.execute();
    const total = Number(count);
    const freelancers = await rowsBuilder.limit(perPage).offset((page - 1) * perPage).execute();

    reply.send(ok({ freelancers, page, perPage, total, totalPages: Math.ceil(total / perPage) }));
  });
}
