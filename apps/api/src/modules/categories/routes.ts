import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";

export default async function categoriesRoutes(app: FastifyInstance) {
  app.get("/categories", async (_request, reply) => {
    const instance = await db();
    const rows = await instance
      .selectFrom("categories")
      .select(["id", "slug", "name", "description", "parent_id", "kind", "sort_order"])
      .orderBy("sort_order")
      .execute();
    reply.send(ok({ categories: rows }));
  });

  app.get("/skills", async (_request, reply) => {
    const instance = await db();
    const rows = await instance.selectFrom("skills").select(["id", "slug", "name"]).orderBy("name").execute();
    reply.send(ok({ skills: rows }));
  });

  app.get("/skills/:slug", async (request: FastifyRequest, reply) => {
    const instance = await db();
    const row = await instance
      .selectFrom("skills")
      .selectAll()
      .where("slug", "=", (request.params as { slug: string }).slug.toLowerCase())
      .executeTakeFirst();
    if (!row) {
      reply.status(404).send({ success: false, message: "Skill not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok(row));
  });
}
