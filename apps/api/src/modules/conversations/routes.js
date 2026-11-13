import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import { createOrGetConversation, listConversations, markRead } from "./service.js";
const createConversationSchema = z.object({
    participantIds: z.array(z.uuid()).min(1).max(50),
    contractId: z.uuid().optional(),
});
function validationError(error) {
    return new AppError(400, "VALIDATION_ERROR", "Validation failed", {
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
}
function parseUuidParam(value, name) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Validation failed", { field: name, message: `${name} must be a valid UUID` });
    }
    return parsed.data;
}
export default async function conversationsRoutes(app) {
    /** POST /api/v1/conversations — create (or reuse) a direct/contract conversation. */
    app.post("/conversations", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const parsed = createConversationSchema.safeParse(request.body);
        if (!parsed.success)
            throw validationError(parsed.error);
        const { conversation, created } = await createOrGetConversation(user.id, parsed.data);
        reply
            .status(created ? 201 : 200)
            .send(ok({ conversation }, created ? "Conversation created" : "Conversation already exists"));
    });
    /** GET /api/v1/conversations — paginated list with last-message preview, unread count and counterpart(s). */
    app.get("/conversations", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const result = await listConversations(user.id, request.query);
        reply.send(ok(result));
    });
    /** POST /api/v1/conversations/:id/read — mark the conversation as read for the current user. */
    app.post("/conversations/:id/read", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const params = request.params;
        const conversationId = parseUuidParam(params.id, "id");
        const result = await markRead(conversationId, user.id);
        reply.send(ok(result, "Conversation marked as read"));
    });
}
