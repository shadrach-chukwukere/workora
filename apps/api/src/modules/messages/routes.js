import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import { deleteMessage, editMessage, listConversationMessages, postMessage, } from "./service.js";
const attachmentSchema = z.object({
    fileName: z.string().trim().min(1).max(255),
    url: z.string().min(1).max(2048),
    mimeType: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().min(0),
});
const postMessageSchema = z.object({
    body: z.string().trim().min(1, "Message body cannot be empty").max(4000, "Message body cannot exceed 4000 characters"),
    attachments: z.array(attachmentSchema).max(10).optional(),
});
const editMessageSchema = z.object({
    body: z.string().trim().min(1, "Message body cannot be empty").max(4000, "Message body cannot exceed 4000 characters"),
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
export default async function messagesRoutes(app) {
    /** POST /api/v1/conversations/:id/messages — send a message (participant only). */
    app.post("/conversations/:id/messages", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const conversationId = parseUuidParam(request.params.id, "id");
        const parsed = postMessageSchema.safeParse(request.body);
        if (!parsed.success)
            throw validationError(parsed.error);
        const message = await postMessage(conversationId, user.id, parsed.data);
        reply.status(201).send(ok({ message }, "Message sent"));
    });
    /** GET /api/v1/conversations/:id/messages — paginated, newest first (participant only). */
    app.get("/conversations/:id/messages", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const conversationId = parseUuidParam(request.params.id, "id");
        const result = await listConversationMessages(conversationId, user.id, request.query);
        reply.send(ok(result));
    });
    /** DELETE /api/v1/conversations/:id/messages/:messageId — tombstone a message (sender only). */
    app.delete("/conversations/:id/messages/:messageId", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const conversationId = parseUuidParam(request.params.id, "id");
        const messageId = parseUuidParam(request.params.messageId, "messageId");
        const message = await deleteMessage(conversationId, messageId, user.id);
        reply.send(ok({ message }, "Message deleted"));
    });
    /** PATCH /api/v1/conversations/:id/messages/:messageId — edit a message within 15 minutes (sender only). */
    app.patch("/conversations/:id/messages/:messageId", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const conversationId = parseUuidParam(request.params.id, "id");
        const messageId = parseUuidParam(request.params.messageId, "messageId");
        const parsed = editMessageSchema.safeParse(request.body);
        if (!parsed.success)
            throw validationError(parsed.error);
        const message = await editMessage(conversationId, messageId, user.id, parsed.data.body);
        reply.send(ok({ message }, "Message updated"));
    });
}
