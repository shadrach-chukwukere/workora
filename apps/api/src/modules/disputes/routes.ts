import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ok, requireAuth, requirePermission } from "../common/index.js";
import { db } from "../../database/connection.js";

export default async function disputesRoutes(app: FastifyInstance) {
  /** POST /contracts/:id/disputes — participant files a dispute, freezes milestone funding. */
  app.post("/contracts/:id/disputes", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const contractId = (request.params as { id: string }).id;
    const body = request.body as { reason?: string; details?: string; amountMinor?: number };
    if (!body.reason || !body.details) {
      reply.status(400).send({ success: false, message: "reason and details are required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const contract = await instance.selectFrom("contracts").selectAll().where("id", "=", contractId).executeTakeFirst();
    if (!contract) {
      reply.status(404).send({ success: false, message: "Contract not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    if (contract.client_id !== user.id && contract.freelancer_id !== user.id) {
      reply.status(403).send({ success: false, message: "Only contract participants can dispute", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    const amount = Number.isFinite(body.amountMinor) ? Math.max(0, Math.floor(body.amountMinor!)) : Number(contract.total_minor);
    const [dispute] = await sql<{ id: string }>`INSERT INTO disputes (contract_id, opened_by, reason, details, amount_minor, currency)
      VALUES (${contractId}, ${user.id}, ${body.reason}, ${body.details}, ${amount}, ${contract.currency})
      RETURNING id`.execute(instance).then((r) => r.rows);
    await sql`INSERT INTO contract_events (contract_id, actor_id, kind, payload) VALUES (${contractId}, ${user.id}, 'dispute.opened', ${JSON.stringify({ disputeId: dispute!.id, reason: body.reason })}::jsonb)`.execute(instance);
    reply.status(201).send(ok({ disputeId: dispute!.id }, "Dispute opened"));
  });

  /** GET /disputes/me — own disputes across all contracts. */
  app.get("/disputes/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const rows = await sql<{ id: string; contract_id: string; status: string; reason: string; amount_minor: string; currency: string; opened_at: Date; resolved_at: Date | null; title_snapshot: string; total_minor: string; client_name: string; freelancer_name: string }>`
      SELECT d.id, d.contract_id, d.status, d.reason, d.amount_minor, d.currency, d.opened_at, d.resolved_at,
             c.title_snapshot, c.total_minor,
             u_cl.name AS client_name, u_fr.name AS freelancer_name
      FROM disputes d
      JOIN contracts c ON c.id = d.contract_id
      JOIN users u_cl ON u_cl.id = c.client_id
      JOIN users u_fr ON u_fr.id = c.freelancer_id
      WHERE c.client_id = ${user.id} OR c.freelancer_id = ${user.id}
      ORDER BY d.opened_at DESC
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ disputes: rows }));
  });

  /** GET /disputes/:id — participant or admin only. */
  app.get("/disputes/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const id = (request.params as { id: string }).id;
    const instance = await db();
    const disputeRows = await sql<{ id: string; contract_id: string; opened_by: string; assigned_to: string | null; status: string; reason: string; details: string; amount_minor: string; currency: string; resolution: string | null; resolution_outcome: "freelancer" | "client" | "split" | "no_action" | null; opened_at: Date; resolved_at: Date | null; title_snapshot: string; client_id: string; freelancer_id: string }>`\n      SELECT d.*, c.title_snapshot, c.client_id, c.freelancer_id
      FROM disputes d JOIN contracts c ON c.id = d.contract_id
      WHERE d.id = ${id}
    `.execute(instance).then((r) => r.rows);
    const dispute = disputeRows[0];
    if (!dispute) {
      reply.status(404).send({ success: false, message: "Dispute not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    const isParticipant = dispute.client_id === user.id || dispute.freelancer_id === user.id;
    const isAdmin = user.accountType === "admin" && user.permissions.has("admin.disputes");
    if (!isParticipant && !isAdmin) {
      reply.status(403).send({ success: false, message: "Not authorized to view this dispute", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    const evidence = await sql<{ id: string; file_name: string; mime_type: string; uploaded_by: string; created_at: Date }>`SELECT id, file_name, mime_type, uploaded_by, created_at FROM dispute_evidence WHERE dispute_id = ${id} ORDER BY created_at`.execute(instance).then((r) => r.rows);
    const notes = await sql<{ id: string; body: string; created_at: Date; author_name: string }>`
      SELECT n.id, n.body, n.created_at, u.name AS author_name
      FROM dispute_notes n JOIN users u ON u.id = n.author_id
      WHERE dispute_id = ${id} AND ${user.accountType === "admin"}
      ORDER BY n.created_at
    `.execute(instance).then((r) => r.rows);
    reply.send(ok({ dispute, evidence, notes: isAdmin ? notes : [] }));
  });

  /** POST /disputes/:id/evidence — add evidence file to a dispute (participant only). */
  app.post("/disputes/:id/evidence", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const id = (request.params as { id: string }).id;
    const body = request.body as { fileName?: string; url?: string; mimeType?: string };
    if (!body.fileName || !body.url) {
      reply.status(400).send({ success: false, message: "fileName and url are required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const exists = await sql<{ exists: number }>`
      SELECT 1 FROM disputes d JOIN contracts c ON c.id = d.contract_id
      WHERE d.id = ${id} AND (c.client_id = ${user.id} OR c.freelancer_id = ${user.id})
    `.execute(instance);
    if (exists.rows.length === 0) {
      reply.status(403).send({ success: false, message: "Not authorized", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    const [evidence] = await sql<{ id: string }>`
      INSERT INTO dispute_evidence (dispute_id, file_name, url, mime_type, uploaded_by)
      VALUES (${id}, ${body.fileName}, ${body.url}, ${body.mimeType ?? "application/octet-stream"}, ${user.id})
      RETURNING id
    `.execute(instance).then((r) => r.rows);
    reply.status(201).send(ok({ evidenceId: evidence!.id }, "Evidence added"));
  });

  /** POST /disputes/:id/notes — admin-only internal notes. */
  app.post("/disputes/:id/notes", { preHandler: [requireAuth, requirePermission("admin.disputes")] }, async (request, reply) => {
    const user = request.currentUser!;
    const id = (request.params as { id: string }).id;
    const body = request.body as { body?: string };
    if (!body.body?.trim()) {
      reply.status(400).send({ success: false, message: "body is required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const [note] = await sql<{ id: string }>`
      INSERT INTO dispute_notes (dispute_id, author_id, body) VALUES (${id}, ${user.id}, ${body.body.trim()}) RETURNING id
    `.execute(instance).then((r) => r.rows);
    reply.status(201).send(ok({ noteId: note!.id }, "Note added"));
  });

  /** POST /disputes/:id/resolve — admin resolves with outcome. */
  app.post("/disputes/:id/resolve", { preHandler: [requireAuth, requirePermission("admin.disputes")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { outcome?: "freelancer" | "client" | "split" | "no_action"; resolution?: string };
    if (!body.outcome || !body.resolution) {
      reply.status(400).send({ success: false, message: "outcome and resolution are required", error: { code: "VALIDATION_ERROR", details: {} } });
      return;
    }
    const instance = await db();
    const disputeRows = await sql<{ contract_id: string }>`SELECT contract_id FROM disputes WHERE id = ${id}`.execute(instance).then((r) => r.rows);
    const dispute = disputeRows[0];
    if (!dispute) {
      reply.status(404).send({ success: false, message: "Dispute not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    await sql`
      UPDATE disputes SET status = 'resolved', resolved_at = now(), resolution = ${body.resolution}, resolution_outcome = ${body.outcome}
      WHERE id = ${id}
    `.execute(instance);
    await sql`INSERT INTO contract_events (contract_id, actor_id, kind, payload) VALUES (${dispute.contract_id}, ${request.currentUser!.id}, 'dispute.resolved', ${JSON.stringify({ disputeId: id, outcome: body.outcome })}::jsonb)`.execute(instance);
    reply.send(ok(null, "Dispute resolved"));
  });

  /** POST /disputes/:id/withdraw — participant withdraws dispute. */
  app.post("/disputes/:id/withdraw", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const id = (request.params as { id: string }).id;
    const instance = await db();
    const disputeRows = await sql<{ opened_by: string }>`SELECT opened_by FROM disputes WHERE id = ${id}`.execute(instance).then((r) => r.rows);
    const dispute = disputeRows[0];
    if (!dispute) {
      reply.status(404).send({ success: false, message: "Dispute not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    if (dispute.opened_by !== user.id) {
      reply.status(403).send({ success: false, message: "Only the person who opened the dispute can withdraw it", error: { code: "FORBIDDEN", details: {} } });
      return;
    }
    await sql`UPDATE disputes SET status = 'withdrawn' WHERE id = ${id}`.execute(instance);
    reply.send(ok(null, "Dispute withdrawn"));
  });
}
