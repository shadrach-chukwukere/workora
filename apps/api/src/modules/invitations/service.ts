import { db } from "../../database/connection.js";
import { conflict, forbidden, notFound } from "../../plugins/error-handler.js";
import { realtime } from "../../services/realtime.js";

/**
 * Invitation operations shared by the HTTP routes, MCP tools and agent API.
 * Ownership and status checks live here so every caller gets the same rules.
 */
export type InvitationResponse = "accept" | "decline";

export async function listMyInvitations(
  userId: string,
  options: { status?: "pending" | "accepted" | "declined" | "withdrawn"; limit?: number } = {},
) {
  const instance = await db();
  let query = instance
    .selectFrom("project_invitations")
    .innerJoin("projects", "projects.id", "project_invitations.project_id")
    .innerJoin("users", "users.id", "project_invitations.client_id")
    .select([
      "project_invitations.id",
      "project_invitations.status",
      "project_invitations.message",
      "project_invitations.created_at",
      "project_invitations.updated_at",
      "projects.id as project_id",
      "projects.title as project_title",
      "users.name as client_name",
    ])
    .where("project_invitations.freelancer_id", "=", userId);
  if (options.status) query = query.where("project_invitations.status", "=", options.status);
  const rows = await query
    .orderBy("project_invitations.created_at", "desc")
    .limit(Math.min(options.limit ?? 20, 100))
    .execute();
  return {
    invitations: rows.map((row) => ({
      id: row.id,
      status: row.status,
      message: row.message,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      project: { id: row.project_id, title: row.project_title },
      client: { name: row.client_name },
    })),
  };
}

export async function sendInvitation(userId: string, projectId: string, freelancerId: string, message: string) {
  const instance = await db();
  const project = await instance
    .selectFrom("projects")
    .select(["id", "title", "client_id", "status"])
    .where("id", "=", projectId)
    .executeTakeFirst();
  if (!project) throw notFound("Project not found");
  if (project.client_id !== userId) throw forbidden("Only the project owner can invite freelancers");
  if (project.status !== "open") throw conflict("Only open projects can be used for invitations");

  const freelancer = await instance
    .selectFrom("users")
    .select(["id", "name", "status", "account_type"])
    .where("id", "=", freelancerId)
    .executeTakeFirst();
  if (!freelancer || freelancer.status !== "active" || freelancer.account_type !== "freelancer") {
    throw notFound("Active freelancer not found");
  }

  const invitation = await instance
    .insertInto("project_invitations")
    .values({ project_id: projectId, client_id: userId, freelancer_id: freelancerId, message: message.trim() })
    .onConflict((oc) =>
      oc.columns(["project_id", "freelancer_id"]).doUpdateSet({
        status: "pending",
        message: message.trim(),
        updated_at: new Date(),
      }),
    )
    .returning(["id", "status"])
    .executeTakeFirstOrThrow();

  const at = new Date().toISOString();
  await instance
    .insertInto("notifications")
    .values({
      user_id: freelancerId,
      type: "system",
      title: "You have a project invitation",
      body: `A client invited you to "${project.title}".`,
      url: "/freelancer/invitations",
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
    at,
  });
  return { invitation };
}

export async function respondToInvitation(userId: string, invitationId: string, response: InvitationResponse) {
  const instance = await db();
  const invitation = await instance
    .selectFrom("project_invitations")
    .select(["id", "client_id", "status", "project_id"])
    .where("id", "=", invitationId)
    .where("freelancer_id", "=", userId)
    .executeTakeFirst();
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.status !== "pending") throw conflict("Invitation is no longer pending");

  const status = response === "accept" ? "accepted" : "declined";
  await instance
    .updateTable("project_invitations")
    .set({ status, updated_at: new Date() })
    .where("id", "=", invitation.id)
    .execute();

  const title = response === "accept" ? "Invitation accepted" : "Invitation declined";
  const body = `A freelancer ${status} your project invitation.`;
  const at = new Date().toISOString();
  await instance
    .insertInto("notifications")
    .values({
      user_id: invitation.client_id,
      type: "system",
      title,
      body,
      url: "/client/projects",
      entity_type: "project_invitation",
      entity_id: invitation.id,
    })
    .execute();
  realtime.publish(invitation.client_id, {
    type: "notification",
    notificationType: "system",
    title,
    body,
    url: "/client/projects",
    entityType: "project_invitation",
    entityId: invitation.id,
    at,
  });
  return { status, invitationId: invitation.id };
}
