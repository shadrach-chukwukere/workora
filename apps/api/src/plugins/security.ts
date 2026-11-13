import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { corsOrigins, env } from "../config/env.js";

export async function registerSecurityPlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });



  await app.register(rateLimit, {
    timeWindow: "1 minute",
    max: 300,
    ban: 10,
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
  });
}
