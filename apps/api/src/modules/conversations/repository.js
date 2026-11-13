import { sql } from "kysely";
export async function findContractById(ex, contractId) {
    return ex
        .selectFrom("contracts")
        .select(["id", "status"])
        .where("id", "=", contractId)
        .executeTakeFirst();
}
export async function findUsersByIds(ex, ids) {
    if (ids.length === 0)
        return [];
    return ex.selectFrom("users").select(["id", "name", "image"]).where("id", "in", ids).execute();
}
export async function findConversationById(ex, id) {
    return ex
        .selectFrom("conversations")
        .select(["id", "kind", "contract_id", "created_at"])
        .where("id", "=", id)
        .executeTakeFirst();
}
export async function findParticipant(ex, conversationId, userId) {
    return ex
        .selectFrom("conversation_participants")
        .select(["conversation_id", "user_id", "last_read_at", "is_muted", "joined_at"])
        .where("conversation_id", "=", conversationId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
}
/**
 * Dedupe lookup: a conversation with exactly the same participant set (order-independent)
 * and the same contract_id (null-safe) is considered the same conversation.
 */
export async function findConversationByParticipantSet(ex, participantIds, contractId) {
    const target = [...participantIds].sort().join(",");
    const candidates = await ex
        .selectFrom("conversations as c")
        .innerJoin("conversation_participants as cp", "cp.conversation_id", "c.id")
        .select(["c.id", "c.kind", "c.contract_id", "c.created_at"])
        .select((eb) => eb.fn.countAll().as("participantCount"))
        .groupBy(["c.id", "c.kind", "c.contract_id", "c.created_at"])
        .having((eb) => eb(eb.fn.countAll(), "=", participantIds.length))
        .execute();
    const plausible = candidates.filter((c) => (c.contract_id ?? null) === contractId);
    if (plausible.length === 0)
        return undefined;
    const rows = await ex
        .selectFrom("conversation_participants")
        .select(["conversation_id", "user_id"])
        .where("conversation_id", "in", plausible.map((c) => c.id))
        .execute();
    const byConversation = new Map();
    for (const row of rows) {
        const list = byConversation.get(row.conversation_id) ?? [];
        list.push(row.user_id);
        byConversation.set(row.conversation_id, list);
    }
    for (const candidate of plausible) {
        const ids = (byConversation.get(candidate.id) ?? []).slice().sort().join(",");
        if (ids === target) {
            return {
                id: candidate.id,
                kind: candidate.kind,
                contract_id: candidate.contract_id,
                created_at: candidate.created_at,
            };
        }
    }
    return undefined;
}
export async function createConversation(ex, kind, contractId, participantIds) {
    const conversation = await ex
        .insertInto("conversations")
        .values({ kind, contract_id: contractId })
        .returning(["id", "kind", "contract_id", "created_at"])
        .executeTakeFirstOrThrow();
    await ex
        .insertInto("conversation_participants")
        .values(participantIds.map((userId) => ({ conversation_id: conversation.id, user_id: userId })))
        .execute();
    return conversation;
}
export async function getParticipantsWithUsers(ex, conversationIds) {
    if (conversationIds.length === 0)
        return [];
    return ex
        .selectFrom("conversation_participants as cp")
        .innerJoin("users as u", "u.id", "cp.user_id")
        .select([
        "cp.conversation_id as conversationId",
        "cp.user_id as userId",
        "cp.last_read_at as lastReadAt",
        "cp.is_muted as isMuted",
        "cp.joined_at as joinedAt",
        "u.name",
        "u.image",
    ])
        .where("cp.conversation_id", "in", conversationIds)
        .execute();
}
/** Conversations where the user participates, ordered by last activity (last message time, falling back to creation time). */
export async function listConversationsForUser(ex, userId, limit, offset) {
    const rows = await sql `
    SELECT c.id, c.kind, c.contract_id, c.created_at, cp.last_read_at, cp.is_muted
    FROM conversations c
    INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ${userId}
    ORDER BY COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id), c.created_at) DESC, c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `.execute(ex);
    return rows.rows;
}
export async function countConversationsForUser(ex, userId) {
    const row = await ex
        .selectFrom("conversation_participants")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirst();
    return Number(row?.count ?? 0);
}
export async function lastMessagesFor(ex, conversationIds) {
    if (conversationIds.length === 0)
        return [];
    const rows = await sql `
    SELECT DISTINCT ON (conversation_id) id, conversation_id, sender_id, body, created_at, edited_at, deleted_at
    FROM messages
    WHERE conversation_id IN (${sql.join(conversationIds)})
    ORDER BY conversation_id, created_at DESC
  `.execute(ex);
    return rows.rows;
}
export async function unreadCountsFor(ex, userId, conversationIds) {
    if (conversationIds.length === 0)
        return [];
    const rows = await sql `
    SELECT m.conversation_id, COUNT(*)::int AS count
    FROM messages m
    INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
    WHERE m.conversation_id IN (${sql.join(conversationIds)})
      AND m.created_at > COALESCE(cp.last_read_at, TIMESTAMPTZ 'epoch')
      AND (m.sender_id IS NULL OR m.sender_id <> ${userId})
    GROUP BY m.conversation_id
  `.execute(ex);
    return rows.rows;
}
export async function markConversationRead(ex, conversationId, userId) {
    return ex
        .updateTable("conversation_participants")
        .set({ last_read_at: new Date() })
        .where("conversation_id", "=", conversationId)
        .where("user_id", "=", userId)
        .returning(["last_read_at"])
        .executeTakeFirst();
}
