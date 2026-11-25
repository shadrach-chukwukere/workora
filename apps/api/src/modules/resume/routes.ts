import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { sql } from "kysely";
import { ok, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  certificationBodySchema,
  certificationPatchSchema,
  educationBodySchema,
  educationPatchSchema,
  experienceBodySchema,
  experiencePatchSchema,
  resumeFileBodySchema,
  resumeImportSchema,
  skillsBodySchema,
  toDate,
} from "./schemas.js";

function parse<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return result.data;
}

function invalid(reply: FastifyReply, message: string): void {
  reply.status(400).send({
    success: false,
    message,
    error: { code: "VALIDATION_ERROR", details: {} },
  });
}

function dateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

interface StrengthItem {
  key: string;
  label: string;
  points: number;
  done: boolean;
}

function profileStrength(input: {
  headline: string | null;
  about: string | null;
  hourlyRateMinor: string | number | null;
  verified: boolean;
  resumeUrl: string | null;
  counts: { skills: number; experience: number; education: number; certifications: number; portfolio: number };
}): { score: number; items: StrengthItem[] } {
  const placeholder = "New to Workora — full profile pending";
  const items: StrengthItem[] = [
    { key: "headline", label: "Write a professional headline", points: 10, done: Boolean(input.headline && input.headline !== placeholder) },
    { key: "about", label: "Add an about section (120+ characters)", points: 15, done: (input.about ?? "").trim().length >= 120 },
    { key: "skills", label: "Add at least one skill", points: 15, done: input.counts.skills > 0 },
    { key: "experience", label: "Add work experience", points: 20, done: input.counts.experience > 0 },
    { key: "education", label: "Add education", points: 10, done: input.counts.education > 0 },
    { key: "certifications", label: "Add a certification", points: 5, done: input.counts.certifications > 0 },
    { key: "portfolio", label: "Add a portfolio project", points: 10, done: input.counts.portfolio > 0 },
    { key: "resume", label: "Upload your resume", points: 5, done: Boolean(input.resumeUrl) },
    { key: "rate", label: "Set your hourly rate", points: 5, done: input.hourlyRateMinor !== null },
    { key: "verified", label: "Verify your identity", points: 5, done: input.verified },
  ];
  const score = items.reduce((sum, item) => sum + (item.done ? item.points : 0), 0);
  return { score, items };
}

export default async function resumeRoutes(app: FastifyInstance) {
  const freelancerOnly = { preHandler: [requireAuth, requireAccountType("freelancer")] };

  /** GET /users/me/resume — every resume section plus profile strength in one call. */
  app.get("/users/me/resume", freelancerOnly, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser!;
    const instance = await db();

    const profile = await instance
      .selectFrom("freelancer_profiles")
      .select([
        "headline",
        "about",
        "location",
        "hourly_rate_minor",
        "currency",
        "availability",
        "response_time_hours",
        "experience_level",
        "verified_identity",
        "resume_url",
        "resume_file_name",
        "resume_visibility",
        "resume_updated_at",
      ])
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (!profile) {
      reply.status(404).send({ success: false, message: "Freelancer profile not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }

    const [skills, experience, education, certifications, portfolioCount] = await Promise.all([
      sql<{ id: string; slug: string; name: string }>`
        SELECT s.id, s.slug, s.name
        FROM freelancer_skills fs
        JOIN skills s ON s.id = fs.skill_id
        WHERE fs.freelancer_id = ${user.id}
        ORDER BY s.name
      `.execute(instance),
      sql<{ id: string; company: string; role: string; start_date: Date; end_date: Date | null; description: string }>`
        SELECT id, company, role, start_date, end_date, description
        FROM work_experiences
        WHERE freelancer_id = ${user.id}
        ORDER BY start_date DESC, created_at DESC
      `.execute(instance),
      sql<{ id: string; school: string; degree: string; field: string | null; start_year: number; end_year: number | null }>`
        SELECT id, school, degree, field, start_year, end_year
        FROM education
        WHERE freelancer_id = ${user.id}
        ORDER BY start_year DESC, created_at DESC
      `.execute(instance),
      sql<{ id: string; name: string; issuer: string | null; year: number | null; credential_url: string | null }>`
        SELECT id, name, issuer, year, credential_url
        FROM certifications
        WHERE freelancer_id = ${user.id}
        ORDER BY year DESC NULLS LAST, created_at DESC
      `.execute(instance),
      sql<{ count: number }>`
        SELECT count(*)::int AS count FROM portfolio_projects WHERE freelancer_id = ${user.id}
      `.execute(instance),
    ]);

    const experienceRows = experience.rows.map((row) => ({
      ...row,
      start_date: dateOnly(row.start_date),
      end_date: dateOnly(row.end_date),
    }));

    const strength = profileStrength({
      headline: profile.headline,
      about: profile.about,
      hourlyRateMinor: profile.hourly_rate_minor,
      verified: profile.verified_identity,
      resumeUrl: profile.resume_url,
      counts: {
        skills: skills.rows.length,
        experience: experienceRows.length,
        education: education.rows.length,
        certifications: certifications.rows.length,
        portfolio: Number(portfolioCount.rows[0]?.count ?? 0),
      },
    });

    reply.send(
      ok({
        profile: {
          ...profile,
          hourly_rate_minor:
            profile.hourly_rate_minor === null ? null : Number(profile.hourly_rate_minor),
          resume_updated_at: profile.resume_updated_at ? profile.resume_updated_at.toISOString() : null,
        },
        skills: skills.rows,
        experience: experienceRows,
        education: education.rows,
        certifications: certifications.rows,
        strength,
      }),
    );
  });

  /* ------------------------------- Experience ------------------------------ */

  app.post("/users/me/experience", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(experienceBodySchema, request.body);
    if (body.end_date && toDate(body.end_date) < toDate(body.start_date)) {
      invalid(reply, "End date must be on or after the start date");
      return;
    }
    const instance = await db();
    const inserted = await instance
      .insertInto("work_experiences")
      .values({
        freelancer_id: user.id,
        company: body.company,
        role: body.role,
        start_date: toDate(body.start_date),
        end_date: body.end_date ? toDate(body.end_date) : null,
        description: body.description ?? "",
      })
      .returning(["id", "company", "role", "start_date", "end_date", "description"])
      .executeTakeFirstOrThrow();
    reply.status(201).send(
      ok(
        {
          experience: {
            ...inserted,
            start_date: dateOnly(inserted.start_date),
            end_date: dateOnly(inserted.end_date),
          },
        },
        "Experience added",
      ),
    );
  });

  app.patch("/users/me/experience/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const body = parse(experiencePatchSchema, request.body);
    const instance = await db();
    const existing = await instance
      .selectFrom("work_experiences")
      .selectAll()
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .executeTakeFirst();
    if (!existing) {
      reply.status(404).send({ success: false, message: "Experience not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    const start = body.start_date ?? dateOnly(existing.start_date) ?? undefined;
    const end = body.end_date !== undefined ? body.end_date : dateOnly(existing.end_date);
    if (start && end && toDate(end) < toDate(start)) {
      invalid(reply, "End date must be on or after the start date");
      return;
    }
    const updated = await instance
      .updateTable("work_experiences")
      .set({
        company: body.company ?? existing.company,
        role: body.role ?? existing.role,
        start_date: start ? toDate(start) : existing.start_date,
        end_date: end ? toDate(end) : null,
        description: body.description ?? existing.description,
      })
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returning(["id", "company", "role", "start_date", "end_date", "description"])
      .executeTakeFirstOrThrow();
    reply.send(
      ok(
        {
          experience: {
            ...updated,
            start_date: dateOnly(updated.start_date),
            end_date: dateOnly(updated.end_date),
          },
        },
        "Experience updated",
      ),
    );
  });

  app.delete("/users/me/experience/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const instance = await db();
    const deleted = await instance
      .deleteFrom("work_experiences")
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returning("id")
      .executeTakeFirst();
    if (!deleted) {
      reply.status(404).send({ success: false, message: "Experience not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: deleted.id }, "Experience removed"));
  });

  /* -------------------------------- Education ------------------------------ */

  app.post("/users/me/education", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(educationBodySchema, request.body);
    if (body.end_year !== null && body.end_year !== undefined && body.end_year < body.start_year) {
      invalid(reply, "End year must be on or after the start year");
      return;
    }
    const instance = await db();
    const inserted = await instance
      .insertInto("education")
      .values({
        freelancer_id: user.id,
        school: body.school,
        degree: body.degree,
        field: body.field ?? null,
        start_year: body.start_year,
        end_year: body.end_year ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    reply.status(201).send(ok({ education: inserted }, "Education added"));
  });

  app.patch("/users/me/education/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const body = parse(educationPatchSchema, request.body);
    const instance = await db();
    const existing = await instance
      .selectFrom("education")
      .selectAll()
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .executeTakeFirst();
    if (!existing) {
      reply.status(404).send({ success: false, message: "Education entry not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    const startYear = body.start_year ?? existing.start_year;
    const endYear = body.end_year !== undefined ? body.end_year : existing.end_year;
    if (endYear !== null && endYear !== undefined && endYear < startYear) {
      invalid(reply, "End year must be on or after the start year");
      return;
    }
    const updated = await instance
      .updateTable("education")
      .set({
        school: body.school ?? existing.school,
        degree: body.degree ?? existing.degree,
        field: body.field !== undefined ? body.field : existing.field,
        start_year: startYear,
        end_year: endYear ?? null,
      })
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    reply.send(ok({ education: updated }, "Education updated"));
  });

  app.delete("/users/me/education/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const instance = await db();
    const deleted = await instance
      .deleteFrom("education")
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returning("id")
      .executeTakeFirst();
    if (!deleted) {
      reply.status(404).send({ success: false, message: "Education entry not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: deleted.id }, "Education removed"));
  });

  /* ------------------------------ Certifications --------------------------- */

  app.post("/users/me/certifications", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(certificationBodySchema, request.body);
    const instance = await db();
    const inserted = await instance
      .insertInto("certifications")
      .values({
        freelancer_id: user.id,
        name: body.name,
        issuer: body.issuer ?? null,
        year: body.year ?? null,
        credential_url: body.credential_url ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    reply.status(201).send(ok({ certification: inserted }, "Certification added"));
  });

  app.patch("/users/me/certifications/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const body = parse(certificationPatchSchema, request.body);
    const instance = await db();
    const existing = await instance
      .selectFrom("certifications")
      .selectAll()
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .executeTakeFirst();
    if (!existing) {
      reply.status(404).send({ success: false, message: "Certification not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    const updated = await instance
      .updateTable("certifications")
      .set({
        name: body.name ?? existing.name,
        issuer: body.issuer !== undefined ? body.issuer : existing.issuer,
        year: body.year !== undefined ? body.year : existing.year,
        credential_url: body.credential_url !== undefined ? body.credential_url : existing.credential_url,
      })
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    reply.send(ok({ certification: updated }, "Certification updated"));
  });

  app.delete("/users/me/certifications/:id", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const { id } = request.params as { id: string };
    const instance = await db();
    const deleted = await instance
      .deleteFrom("certifications")
      .where("id", "=", id)
      .where("freelancer_id", "=", user.id)
      .returning("id")
      .executeTakeFirst();
    if (!deleted) {
      reply.status(404).send({ success: false, message: "Certification not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ id: deleted.id }, "Certification removed"));
  });

  /* --------------------------------- Skills -------------------------------- */

  app.put("/users/me/skills", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(skillsBodySchema, request.body);
    const uniqueIds = [...new Set(body.skillIds)];
    const instance = await db();
    const found = uniqueIds.length
      ? await instance.selectFrom("skills").select("id").where("id", "in", uniqueIds).execute()
      : [];
    if (found.length !== uniqueIds.length) {
      const foundSet = new Set(found.map((row) => row.id));
      invalid(reply, `Unknown skill ids: ${uniqueIds.filter((id) => !foundSet.has(id)).join(", ")}`);
      return;
    }
    await instance.transaction().execute(async (trx) => {
      await trx.deleteFrom("freelancer_skills").where("freelancer_id", "=", user.id).execute();
      if (uniqueIds.length > 0) {
        await trx
          .insertInto("freelancer_skills")
          .values(uniqueIds.map((skillId) => ({ freelancer_id: user.id, skill_id: skillId })))
          .execute();
      }
    });
    reply.send(ok({ skillIds: uniqueIds }, "Skills updated"));
  });

  /* -------------------------------- Resume file ---------------------------- */

  app.put("/users/me/resume-file", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(resumeFileBodySchema, request.body);
    const instance = await db();
    const updated = await instance
      .updateTable("freelancer_profiles")
      .set({
        resume_url: body.url,
        resume_file_name: body.fileName,
        resume_visibility: body.visibility ?? "public",
        resume_updated_at: new Date(),
      })
      .where("user_id", "=", user.id)
      .returning(["resume_url", "resume_file_name", "resume_visibility", "resume_updated_at"])
      .executeTakeFirst();
    if (!updated) {
      reply.status(404).send({ success: false, message: "Freelancer profile not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ file: updated }, "Resume saved"));
  });

  app.delete("/users/me/resume-file", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    await instance
      .updateTable("freelancer_profiles")
      .set({
        resume_url: null,
        resume_file_name: null,
        resume_visibility: "public",
        resume_updated_at: null,
      })
      .where("user_id", "=", user.id)
      .execute();
    reply.send(ok({ file: null }, "Resume removed"));
  });

  /* ------------------------------ Bulk import ------------------------------ */

  /**
   * Applies a reviewed resume payload in one transaction. Used by the AI import
   * wizard and by manual bulk edits; sections not listed are left untouched.
   */
  app.post("/users/me/resume/import", freelancerOnly, async (request, reply) => {
    const user = request.currentUser!;
    const body = parse(resumeImportSchema, request.body);
    const selected = new Set(
      body.sections ?? ["headline", "about", "skills", "experience", "education", "certifications"],
    );
    const instance = await db();

    const result = await instance.transaction().execute(async (trx) => {
      if (selected.has("headline") && body.headline !== undefined) {
        await trx
          .updateTable("freelancer_profiles")
          .set({ headline: body.headline || "New to Workora — full profile pending" })
          .where("user_id", "=", user.id)
          .execute();
      }
      if (selected.has("about") && body.about !== undefined) {
        await trx
          .updateTable("freelancer_profiles")
          .set({ about: body.about })
          .where("user_id", "=", user.id)
          .execute();
      }

      let matchedSkills: string[] = [];
      let skippedSkills: string[] = [];
      if (selected.has("skills") && body.skills) {
        const allSkills = await trx.selectFrom("skills").select(["id", "name"]).execute();
        const byName = new Map(allSkills.map((skill) => [skill.name.trim().toLowerCase(), skill.id]));
        const ids: string[] = [];
        for (const name of body.skills) {
          const id = byName.get(name.trim().toLowerCase());
          if (id) ids.push(id);
          else skippedSkills.push(name);
        }
        matchedSkills = [...new Set(ids)].slice(0, 30);
        skippedSkills = skippedSkills.slice(0, 40);
        await trx.deleteFrom("freelancer_skills").where("freelancer_id", "=", user.id).execute();
        if (matchedSkills.length > 0) {
          await trx
            .insertInto("freelancer_skills")
            .values(matchedSkills.map((skillId) => ({ freelancer_id: user.id, skill_id: skillId })))
            .execute();
        }
      }

      if (selected.has("experience") && body.experience) {
        await trx.deleteFrom("work_experiences").where("freelancer_id", "=", user.id).execute();
        if (body.experience.length > 0) {
          await trx
            .insertInto("work_experiences")
            .values(
              body.experience.map((item) => ({
                freelancer_id: user.id,
                company: item.company,
                role: item.role,
                start_date: toDate(item.start_date),
                end_date: item.end_date ? toDate(item.end_date) : null,
                description: item.description ?? "",
              })),
            )
            .execute();
        }
      }

      if (selected.has("education") && body.education) {
        await trx.deleteFrom("education").where("freelancer_id", "=", user.id).execute();
        if (body.education.length > 0) {
          await trx
            .insertInto("education")
            .values(
              body.education.map((item) => ({
                freelancer_id: user.id,
                school: item.school,
                degree: item.degree,
                field: item.field ?? null,
                start_year: item.start_year,
                end_year: item.end_year ?? null,
              })),
            )
            .execute();
        }
      }

      if (selected.has("certifications") && body.certifications) {
        await trx.deleteFrom("certifications").where("freelancer_id", "=", user.id).execute();
        if (body.certifications.length > 0) {
          await trx
            .insertInto("certifications")
            .values(
              body.certifications.map((item) => ({
                freelancer_id: user.id,
                name: item.name,
                issuer: item.issuer ?? null,
                year: item.year ?? null,
                credential_url: item.credential_url ?? null,
              })),
            )
            .execute();
        }
      }

      return {
        applied: [...selected],
        matchedSkills,
        skippedSkills,
      };
    });

    reply.send(ok(result, "Resume saved"));
  });
}
