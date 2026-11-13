import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";

/** Public + authenticated client directory endpoints. */
export default async function clientsRoutes(app: FastifyInstance) {
  /** GET /clients/:id — public client profile (safe fields only). */
  app.get("/clients/:id", async (request, reply) => {
    const instance = await db();
    const rows = await sql`
      SELECT u.id, u.name, u.image, cp.company_name, cp.company_size, cp.industry, cp.about, cp.rating_avg, cp.rating_count, cp.projects_count, u.created_at
      FROM users u JOIN client_profiles cp ON cp.user_id = u.id
      WHERE u.id = ${(request.params as { id: string }).id} AND u.status = 'active' AND u.account_type = 'client'
    `.execute(instance);
    const row = rows.rows[0];
    if (!row) {
      reply.status(404).send({ success: false, message: "Client not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok({ client: row }));
  });

  /** PATCH /clients/me — update company details (client-only). */
  app.patch("/clients/me", async (request, reply) => {
    const user = request.currentUser;
    if (!user || user.accountType !== "client") {
      reply.status(403).send({ success: false, message: "Client accounts only", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    const body = request.body as { company_name?: string; company_size?: string; industry?: string; about?: string; website?: string };
    const updates: Partial<{ company_name: string | null; company_size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+" | null; industry: string | null; about: string }> = {};
    if (typeof body.company_name === "string") updates.company_name = body.company_name;
    if (typeof body.company_size === "string") updates.company_size = body.company_size as typeof updates.company_size;
    if (typeof body.industry === "string") updates.industry = body.industry;
    if (typeof body.about === "string") updates.about = body.about;
    if (Object.keys(updates).length === 0) {
      reply.status(400).send({ success: false, message: "Nothing to update", error: { code: "BAD_REQUEST", details: {} } });
      return;
    }
    const instance = await db();
    await instance.updateTable("client_profiles").set(updates).where("user_id", "=", user.id).execute();
    reply.send(ok(null, "Client profile updated"));
  });
}
