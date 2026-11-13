export async function findConversation(ex, conversationId) {
    return ex
        .selectFrom("conversations")
        .select(["id", "kind", "contract_id", "created_at"])
        .where("id", "=", conversationId)
        .executeTakeFirst();
}
export async function isParticipant(ex, conversationId, userId) {
    const row = await ex
        .selectFrom("conversation_participants")
        .select("user_id")
        .where("conversation_id", "=", conversationId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
    return row !== undefined;
}
export async function listParticipantIds(ex, conversationId) {
    const rows = await ex
        .selectFrom("conversation_participants")
        .select("user_id")
        .where("conversation_id", "=", conversationId)
        .execute();
    return rows.map((row) => row.user_id);
}
export async function findUserById(ex, userId) {
    return ex
        .selectFrom("users")
        .select(["id", "name", "image"])
        .where("id", "=", userId)
        .executeTakeFirst();
}
export async function createMessage(ex, conversationId, senderId, body) {
    return ex
        .insertInto("messages")
        .values({ conversation_id: conversationId, sender_id: senderId, body })
        .returning(["id", "conversation_id", "sender_id", "body", "edited_at", "deleted_at", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function createAttachments(ex, messageId, attachments) {
    if (attachments.length === 0)
        return [];
    return ex
        .insertInto("message_attachments")
        .values(attachments.map((a) => ({
        message_id: messageId,
        file_name: a.fileName,
        url: a.url,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
    })))
        .returning(["id", "message_id", "file_name", "url", "mime_type", "size_bytes", "created_at"])
        .execute();
}
export async function listMessages(ex, conversationId, limit, offset) {
    return ex
        .selectFrom("messages as m")
        .leftJoin("users as u", "u.id", "m.sender_id")
        .select([
        "m.id",
        "m.conversation_id",
        "m.sender_id",
        "m.body",
        "m.edited_at",
        "m.deleted_at",
        "m.created_at",
        "u.name as sender_name",
        "u.image as sender_image",
    ])
        .where("m.conversation_id", "=", conversationId)
        .orderBy("m.created_at", "desc")
        .orderBy("m.id", "desc")
        .limit(limit)
        .offset(offset)
        .execute();
}
export async function countMessages(ex, conversationId) {
    const row = await ex
        .selectFrom("messages")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("conversation_id", "=", conversationId)
        .executeTakeFirst();
    return Number(row?.count ?? 0);
}
export async function getAttachmentsForMessages(ex, messageIds) {
    if (messageIds.length === 0)
        return [];
    return ex
        .selectFrom("message_attachments")
        .select(["id", "message_id", "file_name", "url", "mime_type", "size_bytes", "created_at"])
        .where("message_id", "in", messageIds)
        .orderBy("created_at", "asc")
        .execute();
}
export async function findMessageById(ex, conversationId, messageId) {
    return ex
        .selectFrom("messages")
        .select(["id", "conversation_id", "sender_id", "body", "edited_at", "deleted_at", "created_at"])
        .where("id", "=", messageId)
        .where("conversation_id", "=", conversationId)
        .executeTakeFirst();
}
export async function tombstoneMessage(ex, messageId) {
    return ex
        .updateTable("messages")
        .set({ body: "[message deleted]", deleted_at: new Date() })
        .where("id", "=", messageId)
        .returning(["id", "conversation_id", "sender_id", "body", "edited_at", "deleted_at", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function editMessageBody(ex, messageId, body) {
    return ex
        .updateTable("messages")
        .set({ body, edited_at: new Date() })
        .where("id", "=", messageId)
        .returning(["id", "conversation_id", "sender_id", "body", "edited_at", "deleted_at", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function insertMessageNotifications(ex, recipientIds, notification) {
    if (recipientIds.length === 0)
        return;
    await ex
        .insertInto("notifications")
        .values(recipientIds.map((userId) => ({
        user_id: userId,
        type: "message",
        title: notification.title,
        body: notification.body,
        url: notification.url,
        entity_type: "message",
        entity_id: notification.messageId,
    })))
        .execute();
}
