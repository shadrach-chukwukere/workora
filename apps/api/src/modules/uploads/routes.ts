import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import { presignUpload } from "../../services/storage.js";

const presignSchema = z.object({
  scope: z.enum(["verification", "deliverable", "portfolio", "avatar", "message"]),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.coerce.number().int().positive().max(50 * 1024 * 1024),
});

export default async function uploadsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/uploads/presign
   * Returns a presigned S3 PUT URL the browser can upload to directly.
   * Non-sensitive uploads may be skipped locally; identity documents require private S3 storage.
   */
  app.post("/uploads/presign", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const parsed = presignSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid upload request", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const { scope, mimeType, sizeBytes } = parsed.data;

    const result = await presignUpload(scope, user.id, mimeType, sizeBytes);
    if (!result) {
      if (scope === "verification") {
        throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
      }
      // S3 not configured — tell client to skip upload (dev mode).
      reply.send(ok({ uploadUrl: null, fileUrl: null, key: null, configured: false }, "S3 not configured; upload skipped"));
      return;
    }
    reply.send(ok({ ...result, configured: true }, "Upload URL generated"));
  });
}
