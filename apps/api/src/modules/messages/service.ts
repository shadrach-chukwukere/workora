import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { parsePage } from "../common/index.js";
import {
  countMessages,
  createAttachments,
  createMessage,
  findConversation,
  findMessageById,
  findUserById,
  getAttachmentsForMessages,
  insertMessageNotifications,
  isParticipant,
  listMessages,
  listParticipantIds,
  tombstoneMessage,
  editMessageBody,
  type AttachmentRow,
  type MessageRow,
} from "./repository.js";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

function serializeAttachment(a: AttachmentRow) {
  return {
    id: a.id,
    fileName: a.file_name,
    url: a.url,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    createdAt: a.created_at,
  };
}

function serializeMessage(
  message: MessageRow,
  attachments: AttachmentRow[],
  sender: { id: string | null; name: string | null; image: string | null } | null,
) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    sender: sender && sender.id ? { id: sender.id, name: sender.name, image: sender.image } : null,
    body: message.body,
    editedAt: message.edited_at,
    deletedAt: message.deleted_at,
    isDeleted: message.deleted_at !== null,
    createdAt: message.created_at,
    attachments: attachments.map(serializeAttachment),
  };
}

/** 404 when the conversation does not exist, 403 when the user is not a participant. */
async function requireParticipant(conversationId: string, userId: string) {
  const instance = await db();
  const conversation = await findConversation(instance, conversationId);
  if (!conversation) {
    throw new AppError(404, "NOT_FOUND", "Conversation not found");
  }
  const participant = await isParticipant(instance, conversationId, userId);
  if (!participant) {
    throw new AppError(403, "FORBIDDEN", "You are not a participant in this conversation");
  }
  return { instance, conversation };
}

export interface PostMessageInput {
  body: string;
  attachments?: Array<{ fileName: string; url: string; mimeType: string; sizeBytes: number }> | undefined;
}

export async function postMessage(conversationId: string, senderId: string, input: PostMessageInput) {
  const { instance } = await requireParticipant(conversationId, senderId);
  const sender = await findUserById(instance, senderId);

  const result = await instance.transaction().execute(async (trx) => {
    const message = await createMessage(trx, conversationId, senderId, input.body);
    const attachments = await createAttachments(trx, message.id, input.attachments ?? []);
    const participantIds = await listParticipantIds(trx, conversationId);
    const recipients = participantIds.filter((id) => id !== senderId);
    await insertMessageNotifications(trx, recipients, {
      title: "New message",
      body: input.body.length > 140 ? `${input.body.slice(0, 137)}...` : input.body,
      url: `/conversations/${conversationId}`,
      messageId: message.id,
    });
    return { message, attachments };
  });

  return serializeMessage(
    result.message,
    result.attachments,
    sender ? { id: sender.id, name: sender.name, image: sender.image } : null,
  );
}

export async function listConversationMessages(
  conversationId: string,
  userId: string,
  query: { page?: string; perPage?: string },
) {
  const { instance } = await requireParticipant(conversationId, userId);
  const { limit, offset, page } = parsePage(query);
  const [total, rows] = await Promise.all([
    countMessages(instance, conversationId),
    listMessages(instance, conversationId, limit, offset),
  ]);
  const attachments = await getAttachmentsForMessages(
    instance,
    rows.map((row) => row.id),
  );
  const attachmentsByMessage = new Map<string, AttachmentRow[]>();
  for (const attachment of attachments) {
    const list = attachmentsByMessage.get(attachment.message_id) ?? [];
    list.push(attachment);
    attachmentsByMessage.set(attachment.message_id, list);
  }
  const messages = rows.map((row) =>
    serializeMessage(
      row,
      attachmentsByMessage.get(row.id) ?? [],
      row.sender_id ? { id: row.sender_id, name: row.sender_name, image: row.sender_image } : null,
    ),
  );
  return {
    messages,
    page,
    perPage: limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    hasMore: offset + messages.length < total,
  };
}

export async function deleteMessage(conversationId: string, messageId: string, userId: string) {
  const { instance } = await requireParticipant(conversationId, userId);
  const message = await findMessageById(instance, conversationId, messageId);
  if (!message) {
    throw new AppError(404, "NOT_FOUND", "Message not found");
  }
  if (message.sender_id !== userId) {
    throw new AppError(403, "FORBIDDEN", "You can only delete your own messages");
  }
  const tombstoned = await tombstoneMessage(instance, messageId);
  const attachments = await getAttachmentsForMessages(instance, [messageId]);
  const sender = await findUserById(instance, userId);
  return serializeMessage(
    tombstoned,
    attachments,
    sender ? { id: sender.id, name: sender.name, image: sender.image } : null,
  );
}

export async function editMessage(conversationId: string, messageId: string, userId: string, body: string) {
  const { instance } = await requireParticipant(conversationId, userId);
  const message = await findMessageById(instance, conversationId, messageId);
  if (!message) {
    throw new AppError(404, "NOT_FOUND", "Message not found");
  }
  if (message.sender_id !== userId) {
    throw new AppError(403, "FORBIDDEN", "You can only edit your own messages");
  }
  if (message.deleted_at !== null) {
    throw new AppError(400, "BAD_REQUEST", "Deleted messages cannot be edited");
  }
  const ageMs = Date.now() - new Date(message.created_at).getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    throw new AppError(403, "FORBIDDEN", "Messages can only be edited within 15 minutes of sending");
  }
  const updated = await editMessageBody(instance, messageId, body);
  const attachments = await getAttachmentsForMessages(instance, [messageId]);
  const sender = await findUserById(instance, userId);
  return serializeMessage(
    updated,
    attachments,
    sender ? { id: sender.id, name: sender.name, image: sender.image } : null,
  );
}
