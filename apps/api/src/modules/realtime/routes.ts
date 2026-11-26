import type { FastifyInstance } from "fastify";
import { requireAuth } from "../common/index.js";
import { realtime } from "../../services/realtime.js";

/**
 * GET /api/v1/events — authenticated Server-Sent Events stream.
 *
 * The browser keeps this connection open and receives advisory events such as
 * `notification` and `message.created`. It is intentionally exempt from the
 * global rate limit because it is one long-lived request, not a burst of calls.
 */
export default async function realtimeRoutes(app: FastifyInstance) {
  app.get(
    "/events",
    {
      preHandler: requireAuth,
      config: { rateLimit: false },
    },
    async (request, reply) => {
      const user = request.currentUser;
      if (!user) return; // requireAuth already sent a 401

      reply.hijack();
      realtime.subscribe(user.id, reply.raw);
    },
  );
}
