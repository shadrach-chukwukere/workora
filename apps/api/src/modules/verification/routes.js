import { ok, requireAccountType, requireAuth, requirePermission } from "../common/index.js";
import { db } from "../../database/connection.js";
import { createVerificationRequestSchema, listVerificationQuerySchema, rejectVerificationSchema, requestInfoVerificationSchema, } from "./schemas.js";
import * as service from "./service.js";
const adminPreHandlers = [requireAuth, requirePermission("admin.verification"), requireAccountType("admin")];
function validationError(reply, message, details = {}) {
    reply.status(400).send({
        success: false,
        message,
        error: { code: "VALIDATION_ERROR", details },
    });
}
export default async function verificationRoutes(app) {
    /**
     * POST /api/v1/verification-requests — freelancer only.
     * One open request per user (pending | info_requested); creates a pending request.
     */
    app.post("/verification-requests", { preHandler: [requireAuth, requireAccountType("freelancer")] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = createVerificationRequestSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid verification request", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const requestRow = await service.createVerificationRequest(instance, user.id, parsed.data);
        reply.status(201).send(ok({ request: requestRow }, "Verification request submitted"));
    });
    /** GET /api/v1/verification-requests/me — own requests, newest first. */
    app.get("/verification-requests/me", { preHandler: [requireAuth] }, async (request, reply) => {
        const user = request.currentUser;
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
    app.post("/verification-requests/:id/approve", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
        const user = request.currentUser;
        const instance = await db();
        const updated = await service.approveVerificationRequest(instance, user.id, request.params.id);
        reply.send(ok({ request: updated }, "Verification request approved"));
    });
    /** POST /api/v1/verification-requests/:id/reject — admin only; { reason } stored on the request. */
    app.post("/verification-requests/:id/reject", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = rejectVerificationSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid reject payload", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const updated = await service.rejectVerificationRequest(instance, user.id, request.params.id, parsed.data.reason);
        reply.send(ok({ request: updated }, "Verification request rejected"));
    });
    /** POST /api/v1/verification-requests/:id/request-info — admin only; { notes } stored on the request. */
    app.post("/verification-requests/:id/request-info", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
        const user = request.currentUser;
        const parsed = requestInfoVerificationSchema.safeParse(request.body);
        if (!parsed.success) {
            validationError(reply, "Invalid request-info payload", { issues: parsed.error.issues });
            return;
        }
        const instance = await db();
        const updated = await service.requestInfoVerificationRequest(instance, user.id, request.params.id, parsed.data.notes);
        reply.send(ok({ request: updated }, "More information requested"));
    });
    /** GET /api/v1/verification-requests/:id — admin only; full detail joined with user. */
    app.get("/verification-requests/:id", { preHandler: [...adminPreHandlers] }, async (request, reply) => {
        const instance = await db();
        const detail = await service.getVerificationRequestDetail(instance, request.params.id);
        reply.send(ok({ request: detail }));
    });
}
