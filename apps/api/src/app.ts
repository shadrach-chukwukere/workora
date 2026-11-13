import Fastify from "fastify";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSecurityPlugins } from "./plugins/security.js";
import { ok } from "./utils/response.js";
import { authenticate } from "./middleware/authenticate.js";
import { auth } from "./modules/auth/auth.js";
import { registerModules } from "./modules/index.js";



/**
 * The API app. Kept free of process-side effects so tests can inject into it
 * and the WebSocket server can attach later on the same instance.
 */
export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: env.NODE_ENV === "test" ? "warn" : "info",
            timestamp: env.NODE_ENV === "production" ? undefined : true,
          },
    genReqId: (request) => {
      const header = request.headers["x-request-id"];
      return typeof header === "string" && header.length > 0
        ? header
        : crypto.randomUUID();
    },
    trustProxy: env.NODE_ENV === "production",
    exposeHeadRoutes: false,
  });

  // NOTE: better-auth handles its own body reading, so no wildcard parser here.

  await registerSecurityPlugins(app);
  registerErrorHandler(app);

  // Populate request.currentUser once per request; public routes can ignore it.
  app.addHook("onRequest", authenticate);

app.get("/healthz", async (_request, reply) => {
  try {
    const { db } = await import("./database/connection.js");
    const database = await db();

    await database
      .selectFrom("users")
      .select("id")
      .limit(1)
      .execute();

    return reply.send(
      ok({
        status: "ok",
        server: "up",
        db: "up",
      }),
    );
  } catch (error) {
    app.log.error({ err: error }, "Health check failed");

    return reply.code(503).send({
      success: false,
      message: "Health check failed",
      data: {
        server: "up",
        db: "down",
        error:
          error instanceof Error ? error.message : "Unknown database error",
      },
    });
  }
});

  // Better Auth, mounted as a Web Request/Response handler on the same port.
  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.append(key, value);
        }
      }
      const proto = request.headers["x-forwarded-proto"] ?? "http";
      const host = `${Array.isArray(proto) ? proto[0] : proto}://${request.headers.host}`;
      const url = new URL(request.raw.url ?? "/", host);
      const hasBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body !== undefined;
     const body = hasBody
        ? Buffer.isBuffer(request.body)
          ? new Blob([request.body as unknown as ArrayBuffer])
          : typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body)
        : undefined;

      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body,
      });
      const response = await auth.handler(webRequest);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k === "set-cookie") {
          const cookies = response.headers.getSetCookie();
          reply.header("set-cookie", cookies);
        } else {
          reply.header(key, value);
        }
      });
      const text = await response.text();
      reply.send(text.length > 0 ? text : null);
    },
  });

  await registerModules(app);

  // Fail-fast placeholder for unmatched business module routes
  app.all("/api/v1/*", async (request, reply) => {
    reply.status(404).send({
      success: false,
      message: "Route not found",
      error: { code: "NOT_FOUND", details: {} },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      message: "Route not found",
      error: { code: "NOT_FOUND", details: {} },
    });
  });

  return app;
}
