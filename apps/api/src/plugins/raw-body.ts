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
    try {
      const rawBody = body as Buffer;
      const parsed = JSON.parse(rawBody.toString());
      req.rawBody = rawBody;
      done(null, parsed);
    } catch (err) {
      done(err as Error, null);
    }
  });
});
