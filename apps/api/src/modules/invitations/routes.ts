import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { ok, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { sendProjectInviteEmail } from "../../services/notifications.js";
import { realtime } from "../../services/realtime.js";

const UUID = /^[0-9a-fA-F-]{36}$/;

function bad(reply: FastifyReply, message: string, code = "VALIDATION_ERROR"): void {
  reply.status(400).send({ success: false, message, error: { code, details: {} } });
}

export default async function invitationsRoutes(app: FastifyInstance) {
  /** POST /projects/:id/invitations — project owner invites a freelancer. */
  app.post(
    "/projects/:id/invitations",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { id: projectId } = request.params as { id: string };
      if (!UUID.test(projectId)) {
        bad(reply, "Invalid project id");
        return;
      }
      const body = request.body as { freelancerId?: string; message?: string } | null;
      const freelancerId = body?.freelancerId;
      if (!freelancerId || !UUID.test(freelancerId)) {
        bad(reply, "Choose a freelancer to invite");
        return;
      }
      if (freelancerId === user.id) {
        bad(reply, "You cannot invite yourself");
        return;
      }
      const instance = await db();
      const project = await instance
        .selectFrom("projects")
        .select(["id", "client_id", "title", "status", "invited_only"])
        .where("id", "=", projectId)
        .executeTakeFirst();
      if (!project) {
        reply.status(404).send({ success: false, message: "Project not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      if (project.client_id !== user.id) {
        reply.status(403).send({ success: false, message: "You can only invite to your own projects", error: { code: "FORBIDDEN", details: {} } });
        return;
      }
      if (project.status !== "open") {
        bad(reply, "Publish the project before inviting freelancers");
        return;
      }
      const target = await instance
        .selectFrom("users")
        .innerJoin("freelancer_profiles", "freelancer_profiles.user_id", "users.id")
        .select(["users.id", "users.name", "users.email"])
        .where("users.id", "=", freelancerId)
        .where("users.account_type", "=", "freelancer")
        .where("users.status", "=", "active")
        .executeTakeFirst();
      if (!target) {
        reply.status(404).send({ success: false, message: "Freelancer not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }

      const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1200) : "";
      const invitation = await instance
        .insertInto("project_invitations")
        .values({
          project_id: projectId,
          client_id: user.id,
          freelancer_id: freelancerId,
          message,
        })
        .onConflict((oc) =>
          oc.columns(["project_id", "freelancer_id"]).doUpdateSet({
            status: "pending",
            message,
            client_id: user.id,
            updated_at: new Date(),
          }),
        )
        .returning(["id", "status", "created_at"])
        .executeTakeFirstOrThrow();

      await instance
        .insertInto("notifications")
        .values({
          user_id: freelancerId,
          type: "system",
          title: "You have a project invitation",
          body: `${user.accountType === "client" ? "A client" : "A client"} invited you to "${project.title}".`,
          url: `/freelancer/invitations`,
          entity_type: "project_invitation",
          entity_id: invitation.id,
        })
        .execute();

      realtime.publish(freelancerId, {
        type: "notification",
        notificationType: "system",
        title: "You have a project invitation",
        body: `A client invited you to "${project.title}".`,
        url: "/freelancer/invitations",
        entityType: "project_invitation",
        entityId: invitation.id,
        at: new Date().toISOString(),
      });

      const client = await instance
        .selectFrom("users")
        .select(["name", "email"])
        .where("id", "=", user.id)
        .executeTakeFirst();
      if (client) {
        void sendProjectInviteEmail(
          { email: target.email, name: target.name },
          client.name,
          project.title,
          message,
          `${process.env.WEB_APP_URL ?? "https://workora-phi.vercel.app"}/freelancer/invitations`,
        ).catch(() => undefined);
      }

      reply.status(201).send(ok({ invitation }, "Invitation sent"));
    },
  );

  /** GET /projects/:id/invitations — owner's invite list for a project. */
  app.get(
    "/projects/:id/invitations",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { id: projectId } = request.params as { id: string };
      if (!UUID.test(projectId)) {
        bad(reply, "Invalid project id");
        return;
      }
      const instance = await db();
      const project = await instance
        .selectFrom("projects")
        .select(["client_id"])
        .where("id", "=", projectId)
        .executeTakeFirst();
      if (!project) {
        reply.status(404).send({ success: false, message: "Project not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      if (project.client_id !== user.id) {
        reply.status(403).send({ success: false, message: "Only the project owner can view invitations", error: { code: "FORBIDDEN", details: {} } });
        return;
      }
      const rows = await sql<{
        id: string;
        freelancer_id: string;
        name: string;
        image: string | null;
        headline: string | null;
        rating_avg: string | null;
        completed_count: number;
        status: string;
        message: string;
        created_at: Date;
      }>`
        SELECT pi.id, pi.freelancer_id, u.name, u.image, fp.headline, fp.rating_avg, fp.completed_count,
               pi.status, pi.message, pi.created_at
        FROM project_invitations pi
        JOIN users u ON u.id = pi.freelancer_id
        LEFT JOIN freelancer_profiles fp ON fp.user_id = pi.freelancer_id
        WHERE pi.project_id = ${projectId}
        ORDER BY pi.created_at DESC
      `.execute(instance);
      reply.send(
        ok({
          invitations: rows.rows.map((row) => ({
            ...row,
            rating_avg: row.rating_avg === null ? null : Number(row.rating_avg),
            created_at: row.created_at.toISOString(),
          })),
        }),
      );
    },
  );

  /** GET /users/me/invitations — freelancer inbox. */
  app.get(
    "/users/me/invitations",
    { preHandler: [requireAuth, requireAccountType("freelancer")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const query = (request.query ?? {}) as { status?: string };
      const status = query.status && ["pending", "accepted", "declined", "withdrawn"].includes(query.status) ? query.status : null;
      const instance = await db();
      const rows = await sql<{
        id: string;
        project_id: string;
        message: string;
        status: string;
        created_at: Date;
        project_title: string;
        project_summary: string;
        project_status: string;
        budget_type: string;
        budget_min_minor: string | null;
        budget_max_minor: string | null;
        currency: string;
        client_id: string;
        client_name: string;
        client_image: string | null;
        company_name: string | null;
      }>`
        SELECT pi.id, pi.project_id, pi.message, pi.status, pi.created_at,
               p.title AS project_title, p.summary AS project_summary, p.status AS project_status,
               p.budget_type, p.budget_min_minor::text AS budget_min_minor, p.budget_max_minor::text AS budget_max_minor, p.currency,
               u.id AS client_id, u.name AS client_name, u.image AS client_image, cp.company_name
        FROM project_invitations pi
        JOIN projects p ON p.id = pi.project_id
        JOIN users u ON u.id = pi.client_id
        LEFT JOIN client_profiles cp ON cp.user_id = pi.client_id
        WHERE pi.freelancer_id = ${user.id}
          ${status ? sql`AND pi.status = ${status}` : sql``}
        ORDER BY pi.created_at DESC
      `.execute(instance);
      reply.send(
        ok({
          invitations: rows.rows.map((row) => ({
            ...row,
            budget_min_minor: row.budget_min_minor === null ? null : Number(row.budget_min_minor),
            budget_max_minor: row.budget_max_minor === null ? null : Number(row.budget_max_minor),
            created_at: row.created_at.toISOString(),
          })),
        }),
      );
    },
  );

  /** POST /invitations/:id/accept — freelancer accepts. */
  app.post(
    "/invitations/:id/accept",
    { preHandler: [requireAuth, requireAccountType("freelancer")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      if (!UUID.test(id)) {
        bad(reply, "Invalid invitation id");
        return;
      }
      const instance = await db();
      const updated = await instance
        .updateTable("project_invitations")
        .set({ status: "accepted", updated_at: new Date() })
        .where("id", "=", id)
        .where("freelancer_id", "=", user.id)
        .where("status", "=", "pending")
        .returning(["id", "project_id", "client_id"])
        .executeTakeFirst();
      if (!updated) {
        reply.status(404).send({ success: false, message: "Invitation not found or already handled", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      await instance
        .insertInto("notifications")
        .values({
          user_id: updated.client_id,
          type: "system",
          title: "Invitation accepted",
          body: "A freelancer accepted your project invitation.",
          url: `/client/projects`,
          entity_type: "project_invitation",
          entity_id: updated.id,
        })
        .execute();

      realtime.publish(updated.client_id, {
        type: "notification",
        notificationType: "system",
        title: "Invitation accepted",
        body: "A freelancer accepted your project invitation.",
        url: "/client/projects",
        entityType: "project_invitation",
        entityId: updated.id,
        at: new Date().toISOString(),
      });
      reply.send(ok({ invitationId: updated.id, projectId: updated.project_id, status: "accepted" }, "Invitation accepted"));
    },
  );

  /** POST /invitations/:id/decline — freelancer declines. */
  app.post(
    "/invitations/:id/decline",
    { preHandler: [requireAuth, requireAccountType("freelancer")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      if (!UUID.test(id)) {
        bad(reply, "Invalid invitation id");
        return;
      }
      const instance = await db();
      const updated = await instance
        .updateTable("project_invitations")
        .set({ status: "declined", updated_at: new Date() })
        .where("id", "=", id)
        .where("freelancer_id", "=", user.id)
        .where("status", "=", "pending")
        .returning("id")
        .executeTakeFirst();
      if (!updated) {
        reply.status(404).send({ success: false, message: "Invitation not found or already handled", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      reply.send(ok({ invitationId: updated.id, status: "declined" }, "Invitation declined"));
    },
  );

  /** POST /invitations/:id/withdraw — client withdraws a pending invite. */
  app.post(
    "/invitations/:id/withdraw",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      if (!UUID.test(id)) {
        bad(reply, "Invalid invitation id");
        return;
      }
      const instance = await db();
      const updated = await instance
        .updateTable("project_invitations")
        .set({ status: "withdrawn", updated_at: new Date() })
        .where("id", "=", id)
        .where("client_id", "=", user.id)
        .returning("id")
        .executeTakeFirst();
      if (!updated) {
        reply.status(404).send({ success: false, message: "Invitation not found", error: { code: "NOT_FOUND", details: {} } });
        return;
      }
      reply.send(ok({ invitationId: updated.id, status: "withdrawn" }, "Invitation withdrawn"));
    },
  );
}
