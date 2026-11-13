import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ok, requireAccountType, requireAuth, type AuthedUser } from "../common/index.js";
import * as service from "./service.js";
import { createProposalSchema, myProposalsQuerySchema, uuidParamSchema } from "./schemas.js";

function validationError(reply: FastifyReply, error: z.ZodError): void {
  reply.status(400).send({
    success: false,
    message: "Validation failed",
    error: { code: "VALIDATION_ERROR", details: { issues: error.issues } },
  });
}

function userOf(request: { currentUser?: AuthedUser }): AuthedUser {
  return request.currentUser!; // guaranteed by requireAuth preHandler
}

export default async function proposalsRoutes(app: FastifyInstance) {
  /** POST /api/v1/projects/:id/proposals — freelancer (verified) submits a proposal. */
  app.post(
    "/projects/:id/proposals",
    { preHandler: [requireAuth, requireAccountType("freelancer")] },
    async (request, reply) => {
      const params = uuidParamSchema.safeParse(request.params);
      if (!params.success) {
        validationError(reply, params.error);
        return;
      }
      const body = createProposalSchema.safeParse(request.body);
      if (!body.success) {
        validationError(reply, body.error);
        return;
      }
      const proposal = await service.createProposal(userOf(request), params.data.id, body.data);
      reply.status(201).send(ok({ proposal }, "Proposal submitted"));
    },
  );

  /** GET /api/v1/proposals/me — freelancer lists own proposals (paginated, status filter, sort). */
  app.get("/proposals/me", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
    const query = myProposalsQuerySchema.safeParse(request.query);
    if (!query.success) {
      validationError(reply, query.error);
      return;
    }
    const result = await service.listMyProposals(userOf(request), {
      ...query.data,
      ...(request.query as { page?: string; perPage?: string; limit?: string }),
    });
    reply.send(ok(result));
  });

  /** GET /api/v1/proposals/:id — proposal owner, project-owning client, or admin. */
  app.get("/proposals/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = uuidParamSchema.safeParse(request.params);
    if (!params.success) {
      validationError(reply, params.error);
      return;
    }
    const result = await service.getProposalDetail(userOf(request), params.data.id);
    reply.send(ok(result));
  });

  /** DELETE /api/v1/proposals/:id — owner freelancer or admin; pending|shortlisted -> withdrawn. */
  app.delete("/proposals/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = uuidParamSchema.safeParse(request.params);
    if (!params.success) {
      validationError(reply, params.error);
      return;
    }
    const proposal = await service.withdrawProposal(userOf(request), params.data.id);
    reply.send(ok({ proposal }, "Proposal withdrawn"));
  });

  /** POST /api/v1/proposals/:id/shortlist — project owner client; pending|shortlisted -> shortlisted (+ notification). */
  app.post(
    "/proposals/:id/shortlist",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request, reply) => {
      const params = uuidParamSchema.safeParse(request.params);
      if (!params.success) {
        validationError(reply, params.error);
        return;
      }
      const result = await service.shortlistProposal(userOf(request), params.data.id);
      reply.send(ok({ proposal: result }, "Proposal shortlisted"));
    },
  );

  /** POST /api/v1/proposals/:id/reject — project owner client; pending|shortlisted -> rejected. */
  app.post(
    "/proposals/:id/reject",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request, reply) => {
      const params = uuidParamSchema.safeParse(request.params);
      if (!params.success) {
        validationError(reply, params.error);
        return;
      }
      const proposal = await service.rejectProposal(userOf(request), params.data.id);
      reply.send(ok({ proposal }, "Proposal rejected"));
    },
  );

  /** POST /api/v1/proposals/:id/accept — project owner client; atomic accept: contract + events + notification. */
  app.post(
    "/proposals/:id/accept",
    { preHandler: [requireAuth, requireAccountType("client")] },
    async (request, reply) => {
      const params = uuidParamSchema.safeParse(request.params);
      if (!params.success) {
        validationError(reply, params.error);
        return;
      }
      const result = await service.acceptProposal(userOf(request), params.data.id);
      reply.send(ok(result, "Proposal accepted — contract created"));
    },
  );
}
