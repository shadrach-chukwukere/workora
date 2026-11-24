import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodType } from "zod";
import { ok, requireAccountType, requireAuth, requirePermission } from "../common/index.js";
import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { presignDownload } from "../../services/storage.js";
import { verificationRequired } from "../../config/env.js";
import { isYotiConfigured } from "../../services/yoti.js";
import {
  addVerificationDocumentsSchema,
  createVerificationRequestSchema,
  listVerificationQuerySchema,
  rejectVerificationSchema,
  requestInfoVerificationSchema,
  verificationUploadSchema,
} from "./schemas.js";
import * as service from "./service.js";

const adminPreHandlers = [requireAuth, requirePermission("admin.verification"), requireAccountType("admin")] as const;
const idSchema = z.string().uuid("id must be a UUID");
const MAX_UPLOAD_BODY = 14 * 1024 * 1024; // 10 MB binary + base64/JSON overhead

function parse<T>(schema: ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return parsed.data;
}

function requestIdOf(request: FastifyRequest): string {
  return parse(idSchema, (request.params as { id?: string }).id);
}

function documentIdOf(request: FastifyRequest): string {
  return parse(idSchema, (request.params as { documentId?: string }).documentId);
}

function safeDownloadName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "verification-document";
}

export default async function verificationRoutes(app: FastifyInstance) {
  /** GET /api/v1/verification-requests/yoti/status — whether the primary IDV path is enabled. */
  app.get("/verification-requests/yoti/status", { preHandler: [requireAuth] }, async (_request, reply) => {
    reply.send(ok({ available: verificationRequired && isYotiConfigured(), verificationRequired }));
  });

  /**
   * POST /api/v1/verification-requests/uploads
   * Store one private identity file before creating the request. The browser
   * never receives a public URL and the SDK/key stay on the backend.
   */
  app.post(
    "/verification-requests/uploads",
    { preHandler: [requireAuth], bodyLimit: MAX_UPLOAD_BODY },
    async (request, reply) => {
      const input = parse(verificationUploadSchema, request.body);
      const document = await service.uploadVerificationDocument(await db(), request.currentUser!.id, input);
      reply.status(201).send(ok({ document }, "Verification file uploaded"));
    },
  );

  /**
   * POST /api/v1/verification-requests
   * Any signed-in user. Manual requests include private uploads; Yoti requests
   * create an IDV session and are still approved only by an admin.
   */
  app.post("/verification-requests", { preHandler: [requireAuth] }, async (request, reply) => {
    const input = parse(createVerificationRequestSchema, request.body);
    const result = await service.createVerificationRequest(await db(), request.currentUser!.id, input);
    reply.status(201).send(
      ok(
        {
          request: result.request,
          ...(result.yoti ? { yoti: result.yoti } : {}),
        },
        result.yoti ? "Yoti verification session created" : "Verification request submitted",
      ),
    );
  });

  /** POST /api/v1/verification-requests/:id/documents — resubmit after info_requested. */
  app.post("/verification-requests/:id/documents", { preHandler: [requireAuth] }, async (request, reply) => {
    const input = parse(addVerificationDocumentsSchema, request.body);
    const updated = await service.addDocumentsToRequest(
      await db(),
      request.currentUser!.id,
      requestIdOf(request),
      input.documents,
    );
    reply.send(ok({ request: updated }, "Verification documents resubmitted"));
  });

  /** POST /api/v1/verification-requests/:id/yoti/complete — import completed Yoti results. */
  app.post("/verification-requests/:id/yoti/complete", { preHandler: [requireAuth] }, async (request, reply) => {
    const result = await service.completeYotiVerification(await db(), request.currentUser!.id, requestIdOf(request));
    reply.send(
      ok(
        { request: result.request, summary: result.summary },
        "Yoti results imported for admin review",
      ),
    );
  });

  /** GET /api/v1/verification-requests/me — own requests, newest first. */
  app.get("/verification-requests/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const requests = await service.listOwnVerificationRequests(await db(), request.currentUser!.id);
    reply.send(ok({ requests }));
  });

  /** GET /api/v1/verification-requests — admin queue with optional status filter. */
  app.get("/verification-requests", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const query = parse(listVerificationQuerySchema, request.query);
    const requests = await service.listVerificationRequestsForAdmin(await db(), query.status);
    reply.send(ok({ requests }));
  });

  /** POST /api/v1/verification-requests/:id/approve — final admin decision. */
  app.post("/verification-requests/:id/approve", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const updated = await service.approveVerificationRequest(await db(), request.currentUser!.id, requestIdOf(request));
    reply.send(ok({ request: updated }, "Verification request approved"));
  });

  /** POST /api/v1/verification-requests/:id/reject — final admin decision with a reason. */
  app.post("/verification-requests/:id/reject", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const input = parse(rejectVerificationSchema, request.body);
    const updated = await service.rejectVerificationRequest(
      await db(),
      request.currentUser!.id,
      requestIdOf(request),
      input.reason,
    );
    reply.send(ok({ request: updated }, "Verification request rejected"));
  });

  /** POST /api/v1/verification-requests/:id/request-info — send the request back for more material. */
  app.post("/verification-requests/:id/request-info", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const input = parse(requestInfoVerificationSchema, request.body);
    const updated = await service.requestInfoVerificationRequest(
      await db(),
      request.currentUser!.id,
      requestIdOf(request),
      input.notes,
    );
    reply.send(ok({ request: updated }, "More information requested"));
  });

  /** GET /api/v1/verification-requests/:id — full admin detail including every document. */
  app.get("/verification-requests/:id", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const detail = await service.getVerificationRequestDetail(await db(), requestIdOf(request));
    reply.send(ok({ request: detail }));
  });

  /**
   * GET /api/v1/verification-requests/:id/documents/:documentId/content
   * Backend-proxied bytes for both private uploads and Yoti media. Admin only.
   */
  app.get(
    "/verification-requests/:id/documents/:documentId/content",
    { preHandler: [...adminPreHandlers] },
    async (request, reply: FastifyReply) => {
      const document = await service.getVerificationDocument(
        await db(),
        requestIdOf(request),
        documentIdOf(request),
      );
      const mimeType =
        document.mimeType.startsWith("image/") || document.mimeType === "application/pdf"
          ? document.mimeType
          : "application/octet-stream";
      const fileName = safeDownloadName(document.fileName ?? "verification-document");

      reply
        .header("Content-Type", mimeType)
        .header("Content-Length", document.body.byteLength)
        .header("Content-Disposition", `inline; filename="${fileName}"`)
        .header("Cache-Control", "no-store");
      reply.send(document.body);
    },
  );

  /** Legacy private document URL endpoint kept for older admin clients. */
  app.get("/verification-requests/:id/document", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
    const document = await service.getVerificationDocumentKey(await db(), requestIdOf(request));
    const signed = await presignDownload(document.key);
    if (!signed) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
    }
    reply.header("Cache-Control", "no-store");
    reply.send(ok({ ...signed, name: document.name }));
  });
}
