import type { FastifyInstance } from "fastify";
import { ok, parsePage, requireAccountType } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import * as service from "./service.js";
import { contactStatusSchema, contactSubmissionSchema, updateContactSchema, type ContactStatus } from "./schemas.js";

function validationError(message: string, error: { issues: Array<{ path: PropertyKey[]; message: string }> }): AppError {
  return new AppError(400, "VALIDATION_ERROR", message, {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

/** Public contact form + admin review queue. */
export default async function contactRoutes(app: FastifyInstance) {
  /** POST /contact — persist a public message. Email is optional and never blocks success. */
  app.post("/contact", async (request, reply) => {
    const parsed = contactSubmissionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationError("Please check the contact form", parsed.error);
    }
    const submission = await service.submitContact(parsed.data);
    reply.status(201).send(ok({ id: submission.id }, "Message received"));
  });

  /** GET /admin/contact — every submission, newest first, with optional filters. */
  app.get("/admin/contact", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const statusQuery = query.status;
    let status: ContactStatus | undefined;
    if (statusQuery && statusQuery !== "all") {
      const parsedStatus = contactStatusSchema.safeParse(statusQuery);
      if (!parsedStatus.success) {
        throw validationError("Unknown contact status", parsedStatus.error);
      }
      status = parsedStatus.data;
    }
    const { page, limit } = parsePage({ page: query.page, perPage: query.perPage });
    const result = await service.listForAdmin({
      status,
      q: (query.q ?? "").trim().slice(0, 200),
      page,
      perPage: limit,
    });
    reply.send(ok(result));
  });

  /** GET /admin/contact/:id — full message and notes; opens a new message as read. */
  app.get("/admin/contact/:id", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = await service.getForAdmin(id);
    reply.send(ok({ submission }));
  });

  /** PATCH /admin/contact/:id — update workflow status or internal notes. */
  app.patch("/admin/contact/:id", { preHandler: [requireAccountType("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateContactSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationError("Please check the update", parsed.error);
    }
    const submission = await service.updateForAdmin(id, parsed.data);
    reply.send(ok({ submission }, "Contact message updated"));
  });
}
