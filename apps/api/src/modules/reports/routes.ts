import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";
import { requireAccountType } from "../../middleware/authenticate.js";

/** CSV export endpoints for admin reporting. */
export default async function reportsRoutes(app: FastifyInstance) {
  /** GET /reports/users.csv?from=&to= */
  app.get("/reports/users.csv", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const { from, to } = request.query as Record<string, string>;
    const instance = await db();
    let builder = instance.selectFrom("users").selectAll();
    if (from) builder = builder.where("created_at", ">=", new Date(from));
    if (to) builder = builder.where("created_at", "<=", new Date(to));
    const rows = await builder.execute();
    const csv = toCsv(
      ["id", "name", "email", "account_type", "status", "created_at"],
      rows.map((r) => [
        r.id,
        r.name,
        r.email,
        r.account_type,
        r.status,
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      ]),
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=users.csv");
    reply.send(csv);
  });

  /** GET /reports/transactions.csv?from=&to= */
  app.get("/reports/transactions.csv", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const { from, to } = request.query as Record<string, string>;
    const instance = await db();
    let builder = instance.selectFrom("transactions").selectAll();
    if (from) builder = builder.where("created_at", ">=", new Date(from));
    if (to) builder = builder.where("created_at", "<=", new Date(to));
    const rows = await builder.execute();
    const csv = toCsv(
      ["id", "user_id", "type", "amount_minor", "currency", "status", "description", "created_at"],
      rows.map((r) => [
        r.id,
        r.user_id,
        r.type,
        String(r.amount_minor),
        r.currency,
        r.status,
        r.description,
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      ]),
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=transactions.csv");
    reply.send(csv);
  });

  /** GET /reports/contracts.csv */
  app.get("/reports/contracts.csv", { preHandler: [requireAccountType("admin")] }, async (_request, reply) => {
    const instance = await db();
    const rows = await sql<{
      id: string; title_snapshot: string; status: string; total_minor: string; currency: string;
      started_at: Date | null; created_at: Date; client_name: string; freelancer_name: string;
    }>`
      SELECT c.id, c.title_snapshot, c.status, c.total_minor::text AS total_minor, c.currency,
             c.started_at, c.created_at,
             u_client.name AS client_name, u_freelancer.name AS freelancer_name
      FROM contracts c
      JOIN users u_client ON u_client.id = c.client_id
      JOIN users u_freelancer ON u_freelancer.id = c.freelancer_id
      ORDER BY c.created_at DESC
    `.execute(instance).then((r) => r.rows);
    const csv = toCsv(
      ["id", "title", "status", "total_minor", "currency", "started_at", "created_at", "client_name", "freelancer_name"],
      rows.map((r) => [
        r.id,
        r.title_snapshot,
        r.status,
        r.total_minor,
        r.currency,
        r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at ?? ""),
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        r.client_name,
        r.freelancer_name,
      ]),
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=contracts.csv");
    reply.send(csv);
  });
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (cell: unknown): string => {
    const value = cell == null ? "" : String(cell);
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\r\n");
}
