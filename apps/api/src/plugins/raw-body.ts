import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export default fp(async function rawBodyPlugin(app: FastifyInstance) {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, function (req, body, done) {
    const rawBody = body as Buffer;
    req.rawBody = rawBody;
    // The browser client always sends `content-type: application/json`, even for
    // body-less requests (e.g. POST/DELETE /connections/:userId). Treat an empty
    // body as "no body" instead of letting JSON.parse("") throw a 500.
    if (rawBody.length === 0 || rawBody.toString().trim() === "") {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(rawBody.toString()));
    } catch {
      const error = new Error("Invalid JSON body") as Error & { statusCode: number };
      error.statusCode = 400;
      done(error, undefined);
    }
  });

  // OAuth 2.1 token/revocation requests are form-encoded per RFC 6749.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try {
      const params = new URLSearchParams(String(body));
      done(null, Object.fromEntries(params.entries()));
    } catch {
      done(new Error("Invalid form body"), undefined);
    }
  });
});
