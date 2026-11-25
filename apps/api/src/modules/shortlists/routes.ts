import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { ok, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";

const UUID = /^[0-9a-fA-F-]{36}$/;

function badId(reply: FastifyReply): void {
  reply.status(400).send({ success: false, message: "Invalid freelancer id", error: { code: "VALIDATION_ERROR", details: {} } });
}

export default async function shortlistsRoutes(app: FastifyInstance) {
  /** GET /users/me/shortlist — client's saved talent, newest first. */
  app.get(
    "/users/me/shortlist",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const instance = await db();
      const rows = await sql<{
        id: string;
        name: string;
        image: string | null;
        banner_url: string | null;
        headline: string | null;
        location: string | null;
        hourly_rate_minor: string | null;
        availability: string;
        rating_avg: string | null;
        rating_count: number;
        completed_count: number;
        verified_identity: boolean;
        note: string | null;
        created_at: Date;
        skills: string[] | null;
      }>`
        SELECT u.id, u.name, u.image, u.banner_url,
               fp.headline, fp.location, fp.hourly_rate_minor::text AS hourly_rate_minor,
               fp.availability, fp.rating_avg, fp.rating_count, fp.completed_count, fp.verified_identity,
               st.note, st.created_at,
               COALESCE((
                 SELECT array_agg(s.name ORDER BY s.name)
                 FROM freelancer_skills fs
                 JOIN skills s ON s.id = fs.skill_id
                 WHERE fs.freelancer_id = u.id
               ), '{}') AS skills
        FROM shortlisted_talent st
        JOIN users u ON u.id = st.freelancer_id
        JOIN freelancer_profiles fp ON fp.user_id = u.id
        WHERE st.client_id = ${user.id} AND u.status = 'active'
        ORDER BY st.created_at DESC
      `.execute(instance);
      reply.send(
        ok({
          talent: rows.rows.map((row) => ({
            ...row,
            hourly_rate_minor: row.hourly_rate_minor === null ? null : Number(row.hourly_rate_minor),
            rating_avg: row.rating_avg === null ? null : Number(row.rating_avg),
            skills: row.skills ?? [],
            created_at: row.created_at.toISOString(),
          })),
        }),
      );
    },
  );

  /** GET /users/me/shortlist/ids — lightweight set for heart-button state. */
  app.get(
    "/users/me/shortlist/ids",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const instance = await db();
      const rows = await instance
        .selectFrom("shortlisted_talent")
        .select("freelancer_id")
        .where("client_id", "=", user.id)
        .execute();
      reply.send(ok({ freelancerIds: rows.map((row) => row.freelancer_id) }));
    },
  );

  /** POST /users/me/shortlist — add or refresh a shortlisted freelancer. */
  app.post(
    "/users/me/shortlist",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const body = request.body as { freelancerId?: string; note?: string } | null;
      const freelancerId = body?.freelancerId;
      if (!freelancerId || !UUID.test(freelancerId)) {
        badId(reply);
        return;
      }
      if (freelancerId === user.id) {
        reply.status(400).send({ success: false, message: "You cannot shortlist yourself", error: { code: "VALIDATION_ERROR", details: {} } });
        return;
      }
      const instance = await db();
      const target = await instance
        .selectFrom("users")
        .innerJoin("freelancer_profiles", "freelancer_profiles.user_id", "users.id")
        .select("users.id")
        .where("users.id", "=", freelancerId)
        .where("users.account_type", "=", "freelancer")
        .where("users.status", "=", "active")
        .executeTakeFirst();
      if (!target) {
        reply.status(404).send({ success: false, message: "Freelancer not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
      await instance
        .insertInto("shortlisted_talent")
        .values({ client_id: user.id, freelancer_id: freelancerId, note })
        .onConflict((oc) =>
          oc.columns(["client_id", "freelancer_id"]).doUpdateSet({ note, created_at: new Date() }),
        )
        .execute();
      reply.send(ok({ freelancerId, shortlisted: true }, "Added to shortlist"));
    },
  );

  /** DELETE /users/me/shortlist/:freelancerId — remove from shortlist. */
  app.delete(
    "/users/me/shortlist/:freelancerId",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { freelancerId } = request.params as { freelancerId: string };
      if (!UUID.test(freelancerId)) {
        badId(reply);
        return;
      }
      const instance = await db();
      await instance
        .deleteFrom("shortlisted_talent")
        .where("client_id", "=", user.id)
        .where("freelancer_id", "=", freelancerId)
        .execute();
      reply.send(ok({ freelancerId, shortlisted: false }, "Removed from shortlist"));
    },
  );
}
