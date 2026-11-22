import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, requireAccountType, requireAuth, requirePermission } from "../common/index.js";
import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { presignDownload } from "../../services/storage.js";
import {
  createVerificationRequestSchema,
  listVerificationQuerySchema,
  rejectVerificationSchema,
  requestInfoVerificationSchema,
  verificationDocumentSchema,
} from "./schemas.js";
import * as service from "./service.js";

const adminPreHandlers = [requireAuth, requirePermission("admin.verification"), requireAccountType("admin")] as const;

function validationError(reply: import("fastify").FastifyReply, message: string, details: Record<string, unknown> = {}) {
  reply.status(400).send({
    success: false,
    message,
    error: { code: "VALIDATION_ERROR", details },
  });
}

export default async function verificationRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/verification-requests — freelancer only.
   * One open request per user (pending | info_requested); creates a pending request.
   */
  app.post("/verification-requests", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = createVerificationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid verification request", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const requestRow = await service.createVerificationRequest(instance, user.id, parsed.data);
    reply.status(201).send(ok({ request: requestRow }, "Verification request submitted"));
  });

  /** POST /api/v1/verification-requests/:id/document — replace a document requested by an admin. */
  app.post("/verification-requests/:id/document", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
    const parsed = verificationDocumentSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid verification document", { issues: parsed.error.issues });
      return;
    }
    const user = request.currentUser!;
    const instance = await db();
    const updated = await service.replaceVerificationDocument(
      instance,
      user.id,
      (request.params as { id: string }).id,
      parsed.data.documentKey,
      parsed.data.documentName,
    );
    reply.send(ok({ request: updated }, "Verification document resubmitted"));
  });

  /** GET /api/v1/verification-requests/me — own requests, newest first. */
  app.get("/verification-requests/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const requests = await service.listOwnVerificationRequests(instance, user.id);
    reply.send(ok({ requests }));
  });

  /** GET /api/v1/verification-requests — admin only; optional ?status= filter, joined with user. */
  app.get("/verification-requests", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const parsed = listVerificationQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      validationError(reply, "Invalid status filter", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const requests = await service.listVerificationRequestsForAdmin(instance, parsed.data.status);
    reply.send(ok({ requests }));
  });

  /** POST /api/v1/verification-requests/:id/approve — admin only. */
  app.post("/verification-requests/:id/approve", { preHandler: [...adminPreHandlers] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const instance = await db();
    const updated = await service.approveVerificationRequest(instance, user.id, (request.params as { id: string }).id);
    reply.send(ok({ request: updated }, "Verification request approved"));
  });

  /** POST /api/v1/verification-requests/:id/reject — admin only; { reason } stored on the request. */
  app.post("/verification-requests/:id/reject", { preHandler: [...adminPreHandlers] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const parsed = rejectVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid reject payload", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const updated = await service.rejectVerificationRequest(instance, user.id, (request.params as { id: string }).id, parsed.data.reason);
    reply.send(ok({ request: updated }, "Verification request rejected"));
  });

  /** POST /api/v1/verification-requests/:id/request-info — admin only; { notes } stored on the request. */
  app.post("/verification-requests/:id/request-info", { preHandler: [...adminPreHandlers] }, async (request: FastifyRequest, reply) => {
    const user = request.currentUser!;
    const parsed = requestInfoVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, "Invalid request-info payload", { issues: parsed.error.issues });
      return;
    }
    const instance = await db();
    const updated = await service.requestInfoVerificationRequest(instance, user.id, (request.params as { id: string }).id, parsed.data.notes);
    reply.send(ok({ request: updated }, "More information requested"));
  });

  /** GET /api/v1/verification-requests/:id — admin only; full detail joined with user. */
  app.get("/verification-requests/:id", { preHandler: [...adminPreHandlers] }, async (request: FastifyRequest, reply) => {
    const instance = await db();
    const detail = await service.getVerificationRequestDetail(instance, (request.params as { id: string }).id);
    reply.send(ok({ request: detail }));
  });

  /** GET /api/v1/verification-requests/:id/document — short-lived private download for verification admins. */
  app.get("/verification-requests/:id/document", { preHandler: [...adminPreHandlers] }, async (request: FastifyRequest, reply) => {
    const instance = await db();
    const document = await service.getVerificationDocumentKey(instance, (request.params as { id: string }).id);
    const signed = await presignDownload(document.key);
    if (!signed) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
    }
    reply.header("Cache-Control", "no-store");
    reply.send(ok({ ...signed, name: document.name }));
  });
}
