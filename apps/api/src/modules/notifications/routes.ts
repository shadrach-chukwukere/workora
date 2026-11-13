import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  clearRead,
  deleteOwnNotification,
  getUnreadCount,
  listOwnNotifications,
  markAllRead,
  markOneRead,
} from "./service.js";

function parseUuidParam(value: string, name: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", { field: name, message: `${name} must be a valid UUID` });
  }
  return parsed.data;
}

export default async function notificationsRoutes(app: FastifyInstance) {
  /** GET /api/v1/notifications — paginated list of the current user's notifications, newest first. */
  app.get(
    "/notifications",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest,
      reply,
    ) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const result = await listOwnNotifications(user.id, request.query as { page?: string; perPage?: string; unread?: string });
      reply.send(ok(result));
    },
  );

  /** GET /api/v1/notifications/unread-count — number of unread notifications. */
  app.get(
    "/notifications/unread-count",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const result = await getUnreadCount(user.id);
      reply.send(ok(result));
    },
  );

  /** POST /api/v1/notifications/mark-all-read — mark every unread notification as read. */
  app.post(
    "/notifications/mark-all-read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const result = await markAllRead(user.id);
      reply.send(ok(result, "All notifications marked as read"));
    },
  );

  /** POST /api/v1/notifications/:id/read — mark one notification as read (own only). */
  app.post(
    "/notifications/:id/read",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const notificationId = parseUuidParam((request.params as { id: string }).id, "id");
      const result = await markOneRead(user.id, notificationId);
      reply.send(ok(result, "Notification marked as read"));
    },
  );

  /** DELETE /api/v1/notifications — clear all read notifications (unread are preserved). */
  app.delete(
    "/notifications",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const result = await clearRead(user.id);
      reply.send(ok(result, "Read notifications cleared"));
    },
  );

  /** DELETE /api/v1/notifications/:id — delete one notification (own only). */
  app.delete(
    "/notifications/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply) => {
      const user = request.currentUser;
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      const notificationId = parseUuidParam((request.params as { id: string }).id, "id");
      await deleteOwnNotification(user.id, notificationId);
      reply.send(ok(null, "Notification deleted"));
    },
  );
}
