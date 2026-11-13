import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { parsePage } from "../common/index.js";
import { countConversationsForUser, createConversation, findContractById, findConversationById, findConversationByParticipantSet, findParticipant, findUsersByIds, getParticipantsWithUsers, lastMessagesFor, listConversationsForUser, markConversationRead, unreadCountsFor, } from "./repository.js";
const PREVIEW_LENGTH = 120;
export function truncatePreview(body, max = PREVIEW_LENGTH) {
    return body.length > max ? `${body.slice(0, max - 3)}...` : body;
}
function serializeParticipant(p) {
    return { id: p.userId, name: p.name, image: p.image };
}
function groupByConversation(rows) {
    const grouped = new Map();
    for (const row of rows) {
        const list = grouped.get(row.conversationId) ?? [];
        list.push(row);
        grouped.set(row.conversationId, list);
    }
    return grouped;
}
function serializeConversationDetail(conversation, participants, requesterId) {
    return {
        id: conversation.id,
        kind: conversation.kind,
        contractId: conversation.contract_id,
        createdAt: conversation.created_at,
        participants: participants.map(serializeParticipant),
        counterparts: participants.filter((p) => p.userId !== requesterId).map(serializeParticipant),
    };
}
export async function createOrGetConversation(requesterId, input) {
    const instance = await db();
    const uniqueIds = [...new Set(input.participantIds)];
    if (!uniqueIds.includes(requesterId)) {
        throw new AppError(403, "FORBIDDEN", "You must be a participant in the conversation you create");
    }
    const contractId = input.contractId ?? null;
    if (contractId) {
        const contract = await findContractById(instance, contractId);
        if (!contract) {
            throw new AppError(404, "NOT_FOUND", "Contract not found");
        }
    }
    const users = await findUsersByIds(instance, uniqueIds);
    if (users.length !== uniqueIds.length) {
        const found = new Set(users.map((u) => u.id));
        throw new AppError(400, "BAD_REQUEST", "One or more participants were not found", {
            missing: uniqueIds.filter((id) => !found.has(id)),
        });
    }
    const dedupe = async (executor) => findConversationByParticipantSet(executor, uniqueIds, contractId);
    const existing = await dedupe(instance);
    if (existing) {
        const participants = await getParticipantsWithUsers(instance, [existing.id]);
        return { conversation: serializeConversationDetail(existing, participants, requesterId), created: false };
    }
    const kind = contractId ? "contract" : "direct";
    return instance.transaction().execute(async (trx) => {
        const conversation = await createConversation(trx, kind, contractId, uniqueIds);
        const participants = await getParticipantsWithUsers(trx, [conversation.id]);
        return { conversation: serializeConversationDetail(conversation, participants, requesterId), created: true };
    });
}
export async function listConversations(requesterId, query) {
    const instance = await db();
    const { limit, offset, page } = parsePage(query);
    const total = await countConversationsForUser(instance, requesterId);
    const pageRows = await listConversationsForUser(instance, requesterId, limit, offset);
    const ids = pageRows.map((row) => row.id);
    const [participants, lastMessages, unreadCounts] = await Promise.all([
        getParticipantsWithUsers(instance, ids),
        lastMessagesFor(instance, ids),
        unreadCountsFor(instance, requesterId, ids),
    ]);
    const participantsById = groupByConversation(participants);
    const lastMessageById = new Map(lastMessages.map((row) => [row.conversation_id, row]));
    const unreadById = new Map(unreadCounts.map((row) => [row.conversation_id, Number(row.count)]));
    const conversations = pageRows.map((row) => {
        const parts = participantsById.get(row.id) ?? [];
        const last = lastMessageById.get(row.id);
        return {
            id: row.id,
            kind: row.kind,
            contractId: row.contract_id,
            createdAt: row.created_at,
            isMuted: row.is_muted,
            lastReadAt: row.last_read_at,
            lastMessage: last
                ? {
                    id: last.id,
                    senderId: last.sender_id,
                    body: truncatePreview(last.body, PREVIEW_LENGTH),
                    createdAt: last.created_at,
                    editedAt: last.edited_at,
                    deletedAt: last.deleted_at,
                    isDeleted: last.deleted_at !== null,
                }
                : null,
            unreadCount: unreadById.get(row.id) ?? 0,
            participants: parts.map(serializeParticipant),
            counterparts: parts.filter((p) => p.userId !== requesterId).map(serializeParticipant),
        };
    });
    return {
        conversations,
        page,
        perPage: limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        hasMore: offset + conversations.length < total,
    };
}
/** Load a conversation and assert the requester may act on it. Throws 404/403 otherwise. */
export async function requireConversationParticipant(conversationId, userId) {
    const instance = await db();
    const conversation = await findConversationById(instance, conversationId);
    if (!conversation) {
        throw new AppError(404, "NOT_FOUND", "Conversation not found");
    }
    const participant = await findParticipant(instance, conversationId, userId);
    if (!participant) {
        throw new AppError(403, "FORBIDDEN", "You are not a participant in this conversation");
    }
    return { instance, conversation, participant };
}
export async function markRead(conversationId, userId) {
    const { instance } = await requireConversationParticipant(conversationId, userId);
    const updated = await markConversationRead(instance, conversationId, userId);
    return { id: conversationId, lastReadAt: updated?.last_read_at ?? new Date() };
}
