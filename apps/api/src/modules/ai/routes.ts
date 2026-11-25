import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { sql } from "kysely";
import { ok, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { env } from "../../config/env.js";
import { AppError } from "../../plugins/error-handler.js";
import { GENERATE_SYSTEM_PROMPT, RESUME_SYSTEM_PROMPT, generateJson, redactPii } from "./service.js";
import {
  GENERATE_RESPONSE_SCHEMA,
  RESUME_RESPONSE_SCHEMA,
  aiGenerateBodySchema,
  aiParseBodySchema,
  normalizeResume,
  normalizeSuggestions,
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

async function activePaid(userId: string): Promise<boolean> {
  const instance = await db();
  const row = await instance
    .selectFrom("subscriptions")
    .select("id")
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("current_period_end", "is", null), eb("current_period_end", ">", new Date())]))
    .executeTakeFirst();
  return Boolean(row);
}

async function usageSnapshot(userId: string): Promise<{ limit: number; used: number; remaining: number }> {
  const instance = await db();
  const paid = await activePaid(userId);
  const limit = paid ? env.AI_DAILY_LIMIT_PAID : env.AI_DAILY_LIMIT_FREE;
  const today = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM ai_usage
    WHERE user_id = ${userId} AND created_at >= date_trunc('day', now())
  `.execute(instance);
  const used = Number(today.rows[0]?.count ?? 0);
  return { limit, used, remaining: Math.max(0, limit - used) };
}

async function assertQuota(userId: string): Promise<{ limit: number; used: number; remaining: number }> {
  const snapshot = await usageSnapshot(userId);
  if (snapshot.used >= snapshot.limit) {
    throw new AppError(429, "RATE_LIMITED", "You have reached today's AI limit", {
      limit: snapshot.limit,
      used: snapshot.used,
      reset: "midnight UTC",
    });
  }
  const instance = await db();
  const globalToday = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM ai_usage WHERE created_at >= date_trunc('day', now())
  `.execute(instance);
  if (Number(globalToday.rows[0]?.count ?? 0) >= env.AI_GLOBAL_DAILY_CAP) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "AI is at capacity today. Please try again tomorrow.");
  }
  return snapshot;
}

async function recordUsage(input: {
  userId: string;
  kind: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  const instance = await db();
  await instance
    .insertInto("ai_usage")
    .values({
      user_id: input.userId,
      kind: input.kind,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      status: "ok",
    })
    .execute();
}

async function collectProfileFacts(userId: string): Promise<Record<string, unknown>> {
  const instance = await db();
  const [profile, skills, experience, education, certifications, portfolio, reviews] = await Promise.all([
    instance
      .selectFrom("users as u")
      .leftJoin("freelancer_profiles as fp", "fp.user_id", "u.id")
      .select([
        "u.name",
        "fp.headline",
        "fp.about",
        "fp.location",
        "fp.hourly_rate_minor",
        "fp.availability",
        "fp.completed_count",
        "fp.rating_avg",
        "fp.rating_count",
      ])
      .where("u.id", "=", userId)
      .executeTakeFirst(),
    sql<{ name: string }>`
      SELECT s.name FROM freelancer_skills fs JOIN skills s ON s.id = fs.skill_id
      WHERE fs.freelancer_id = ${userId} ORDER BY s.name
    `.execute(instance),
    sql<{ company: string; role: string; start_date: Date; end_date: Date | null; description: string }>`
      SELECT company, role, start_date, end_date, description
      FROM work_experiences WHERE freelancer_id = ${userId}
      ORDER BY start_date DESC LIMIT 20
    `.execute(instance),
    sql<{ school: string; degree: string; field: string | null; start_year: number; end_year: number | null }>`
      SELECT school, degree, field, start_year, end_year
      FROM education WHERE freelancer_id = ${userId}
      ORDER BY start_year DESC LIMIT 10
    `.execute(instance),
    sql<{ name: string; issuer: string | null; year: number | null }>`
      SELECT name, issuer, year FROM certifications WHERE freelancer_id = ${userId}
      ORDER BY year DESC NULLS LAST LIMIT 20
    `.execute(instance),
    sql<{ title: string; description: string; role: string | null; year: number | null }>`
      SELECT title, description, role, year FROM portfolio_projects
      WHERE freelancer_id = ${userId} ORDER BY COALESCE(year, 0) DESC LIMIT 8
    `.execute(instance),
    sql<{ rating: number; comment: string }>`
      SELECT rating, comment FROM reviews
      WHERE reviewee_id = ${userId} AND comment <> ''
      ORDER BY created_at DESC LIMIT 5
    `.execute(instance),
  ]);

  return {
    name: profile?.name ?? "",
    headline: profile?.headline ?? "",
    about: profile?.about ?? "",
    location: profile?.location ?? null,
    hourlyRateMinor: profile?.hourly_rate_minor ?? null,
    availability: profile?.availability ?? null,
    completedCount: profile?.completed_count ?? 0,
    ratingAvg: profile?.rating_avg ?? null,
    ratingCount: profile?.rating_count ?? 0,
    skills: skills.rows.map((row) => row.name),
    experience: experience.rows.map((row) => ({
      company: row.company,
      role: row.role,
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 7) : String(row.start_date).slice(0, 7),
      endDate: row.end_date ? (row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 7) : String(row.end_date).slice(0, 7)) : null,
      description: row.description,
    })),
    education: education.rows,
    certifications: certifications.rows,
    portfolio: portfolio.rows.map((row) => ({
      title: row.title,
      role: row.role,
      year: row.year,
      description: row.description.slice(0, 600),
    })),
    reviews: reviews.rows,
  };
}

export default async function aiRoutes(app: FastifyInstance) {
  const freelancerOnly = { preHandler: [requireAuth, requireAccountType("freelancer")] };

  /** POST /ai/resume/parse — extract a structured resume from text or a PDF. */
  app.post(
    "/ai/resume/parse",
    { ...freelancerOnly, bodyLimit: 15 * 1024 * 1024 },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const body = parse(aiParseBodySchema, request.body);
      const quota = await assertQuota(user.id);

      let pdf: { base64: string; mimeType: string } | undefined;
      if (body.fileBase64) {
        const base64 = body.fileBase64.replace(/^data:application\/pdf;base64,/, "");
        const bytes = Buffer.from(base64, "base64");
        if (bytes.byteLength > 10 * 1024 * 1024) {
          reply.status(413).send({ success: false, message: "PDF must be 10 MB or smaller", error: { code: "VALIDATION_ERROR", details: {} } });
          return;
        }
        if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
          reply.status(400).send({ success: false, message: "That file is not a PDF", error: { code: "VALIDATION_ERROR", details: {} } });
          return;
        }
        pdf = { base64, mimeType: "application/pdf" };
      }

      const text = body.text ? redactPii(body.text) : "";
      const prompt = pdf
        ? "Extract the resume in the attached PDF into the required JSON schema. Use only facts in the document."
        : `Extract the resume below into the required JSON schema. Use only facts in the resume.\n\n<resume>\n${text}\n</resume>`;

      const result = await generateJson<unknown>({
        system: RESUME_SYSTEM_PROMPT,
        prompt,
        schema: RESUME_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.1,
        maxOutputTokens: 4096,
        pdf,
      });

      const normalized = normalizeResume(result.data);
      await recordUsage({
        userId: user.id,
        kind: "resume_parse",
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });

      reply.send(
        ok({
          resume: normalized.resume,
          warnings: normalized.warnings,
          usage: { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) },
        }),
      );
    },
  );

  /** POST /ai/resume/generate — improve the profile using only stored facts. */
  app.post("/ai/resume/generate", freelancerOnly, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser!;
    const body = parse(aiGenerateBodySchema, request.body);
    const quota = await assertQuota(user.id);
    const facts = await collectProfileFacts(user.id);

    const tone = body.tone ?? "professional";
    const roleHint = body.targetRole ? `The freelancer is targeting: ${body.targetRole}.` : "";
    const prompt = `Rewrite this freelancer profile for a marketplace resume. Tone: ${tone}. ${roleHint}
Return three headline options, one about section (120-1200 characters), achievement-focused bullets for each experience entry, and skills that are evidenced by the facts.
Do not invent any employer, client, metric, date, degree, or certification.

<profile>
${JSON.stringify(facts).slice(0, 18_000)}
</profile>`;

    const result = await generateJson<unknown>({
      system: GENERATE_SYSTEM_PROMPT,
      prompt,
      schema: GENERATE_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0.4,
      maxOutputTokens: 4096,
    });

    const suggestions = normalizeSuggestions(result.data);
    await recordUsage({
      userId: user.id,
      kind: "resume_generate",
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    reply.send(
      ok({
        suggestions,
        usage: { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) },
      }),
    );
  });

  /** GET /ai/quota — remaining daily generations for the current user. */
  app.get("/ai/quota", freelancerOnly, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser!;
    reply.send(ok(await usageSnapshot(user.id)));
  });
}
