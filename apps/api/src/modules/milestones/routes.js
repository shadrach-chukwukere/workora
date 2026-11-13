import { ok, requireAccountType, requireAuth } from "../common/index.js";
import * as service from "./service.js";
import { createMilestoneSchema, milestoneItemParamsSchema, milestoneParamsSchema, requestRevisionSchema, submitMilestoneSchema, } from "./schemas.js";
function validationError(reply, error) {
    reply.status(400).send({
        success: false,
        message: "Validation failed",
        error: { code: "VALIDATION_ERROR", details: { issues: error.issues } },
    });
}
function userOf(request) {
    return request.currentUser; // guaranteed by requireAuth preHandler
}
export default async function milestonesRoutes(app) {
    /** POST /api/v1/contracts/:contractId/milestones — contract client; creates an 'upcoming' milestone. */
    app.post("/contracts/:contractId/milestones", { preHandler: [requireAuth, requireAccountType("client")] }, async (request, reply) => {
        const params = milestoneParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const body = createMilestoneSchema.safeParse(request.body);
        if (!body.success) {
            validationError(reply, body.error);
            return;
        }
        const result = await service.createMilestone(userOf(request), params.data.contractId, body.data);
        reply.status(201).send(ok(result, "Milestone created"));
    });
    /** GET /api/v1/contracts/:contractId/milestones — participants; sequencing order. */
    app.get("/contracts/:contractId/milestones", { preHandler: requireAuth }, async (request, reply) => {
        const params = milestoneParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const result = await service.listMilestones(userOf(request), params.data.contractId);
        reply.send(ok(result));
    });
    /** POST /api/v1/contracts/:contractId/milestones/:milestoneId/submit — freelancer; upcoming|revision -> in_review (+ deliverable). */
    app.post("/contracts/:contractId/milestones/:milestoneId/submit", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
        const params = milestoneItemParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const body = submitMilestoneSchema.safeParse(request.body ?? {});
        if (!body.success) {
            validationError(reply, body.error);
            return;
        }
        const result = await service.submitMilestone(userOf(request), params.data.contractId, params.data.milestoneId, body.data);
        reply.send(ok(result, "Milestone submitted for review"));
    });
    /** POST /api/v1/contracts/:contractId/milestones/:milestoneId/approve — client; in_review -> paid (demo payment flow, atomic). */
    app.post("/contracts/:contractId/milestones/:milestoneId/approve", { preHandler: [requireAuth, requireAccountType("client")] }, async (request, reply) => {
        const params = milestoneItemParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const result = await service.approveMilestone(userOf(request), params.data.contractId, params.data.milestoneId);
        reply.send(ok(result, "Milestone approved and paid"));
    });
    /** POST /api/v1/contracts/:contractId/milestones/:milestoneId/request-revision — client; in_review -> revision. */
    app.post("/contracts/:contractId/milestones/:milestoneId/request-revision", { preHandler: [requireAuth, requireAccountType("client")] }, async (request, reply) => {
        const params = milestoneItemParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const body = requestRevisionSchema.safeParse(request.body);
        if (!body.success) {
            validationError(reply, body.error);
            return;
        }
        const result = await service.requestRevision(userOf(request), params.data.contractId, params.data.milestoneId, body.data);
        reply.send(ok(result, "Revision requested"));
    });
    /** GET /api/v1/contracts/:contractId/milestones/:milestoneId/deliverables — participants. */
    app.get("/contracts/:contractId/milestones/:milestoneId/deliverables", { preHandler: requireAuth }, async (request, reply) => {
        const params = milestoneItemParamsSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const result = await service.listDeliverables(userOf(request), params.data.contractId, params.data.milestoneId);
        reply.send(ok(result));
    });
}
