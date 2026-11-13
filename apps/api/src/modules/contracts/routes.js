import { ok, requireAccountType, requireAuth } from "../common/index.js";
import * as service from "./service.js";
import { cancelContractSchema, contractUuidParamSchema, listContractsQuerySchema } from "./schemas.js";
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
export default async function contractsRoutes(app) {
    /** GET /api/v1/contracts — authed; contracts where the user is client or freelancer. */
    app.get("/contracts", { preHandler: requireAuth }, async (request, reply) => {
        const query = listContractsQuerySchema.safeParse(request.query);
        if (!query.success) {
            validationError(reply, query.error);
            return;
        }
        const result = await service.listContracts(userOf(request), {
            ...query.data,
            ...request.query,
        });
        reply.send(ok(result));
    });
    /** GET /api/v1/contracts/:id — contract participants only; full detail (milestones, deliverables, events). */
    app.get("/contracts/:id", { preHandler: requireAuth }, async (request, reply) => {
        const params = contractUuidParamSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const result = await service.getContractDetail(userOf(request), params.data.id);
        reply.send(ok(result));
    });
    /** POST /api/v1/contracts/:id/cancel — participants; active -> cancelled (reason stored). */
    app.post("/contracts/:id/cancel", { preHandler: requireAuth }, async (request, reply) => {
        const params = contractUuidParamSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const body = cancelContractSchema.safeParse(request.body);
        if (!body.success) {
            validationError(reply, body.error);
            return;
        }
        const result = await service.cancelContract(userOf(request), params.data.id, body.data.reason);
        reply.send(ok(result, "Contract cancelled"));
    });
    /** POST /api/v1/contracts/:id/complete — client only; active + ALL milestones paid|cancelled -> completed. */
    app.post("/contracts/:id/complete", { preHandler: [requireAuth, requireAccountType("client")] }, async (request, reply) => {
        const params = contractUuidParamSchema.safeParse(request.params);
        if (!params.success) {
            validationError(reply, params.error);
            return;
        }
        const result = await service.completeContract(userOf(request), params.data.id);
        reply.send(ok(result, "Contract completed"));
    });
}
