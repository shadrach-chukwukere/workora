import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ok, parsePage, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import * as service from "./service.js";

/** Connections = freelancing-style follows between freelancers and clients. */
export default async function connectionsRoutes(app: FastifyInstance) {
  /** Status + counts for a public profile. Auth is optional; anonymous viewers get counts only. */
  app.get("/connections/:userId/status", async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const status = await service.getStatus(await db(), request.currentUser?.id ?? null, userId);
    reply.send(ok(status));
  });

  /** People following the signed-in user. */
  app.get("/connections/me/followers", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, offset, page } = parsePage(request.query as { page?: string; perPage?: string; limit?: string });
    const result = await service.listMyConnections(await db(), request.currentUser!, "followers", limit, offset);
    reply.send(ok({ ...result, page }));
  });

  /** People the signed-in user follows. */
  app.get("/connections/me/following", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, offset, page } = parsePage(request.query as { page?: string; perPage?: string; limit?: string });
    const result = await service.listMyConnections(await db(), request.currentUser!, "following", limit, offset);
    reply.send(ok({ ...result, page }));
  });

  /** Connect to a profile. Idempotent. */
  app.post("/connections/:userId", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const status = await service.connect(await db(), request.currentUser!, userId);
    reply.send(ok(status, "Connected"));
  });

  /** Remove a connection. Idempotent. */
  app.delete("/connections/:userId", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const status = await service.disconnect(await db(), request.currentUser!, userId);
    reply.send(ok(status, "Connection removed"));
  });
}
