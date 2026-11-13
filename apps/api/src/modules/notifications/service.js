import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { parsePage } from "../common/index.js";
import { clearReadNotifications, deleteNotification, findOwnNotification, listNotifications, markAllNotificationsRead, markNotificationRead, unreadCount, } from "./repository.js";
function serializeNotification(n) {
    return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        entityType: n.entity_type,
        entityId: n.entity_id,
        isRead: n.is_read,
        createdAt: n.created_at,
    };
}
export function parseUnreadFilter(value) {
    if (!value)
        return false;
    return value === "true" || value === "1";
}
export async function listOwnNotifications(userId, query) {
    const instance = await db();
    const { limit, offset, page } = parsePage(query);
    const unreadOnly = parseUnreadFilter(query.unread);
    const { rows, total } = await listNotifications(instance, userId, { unreadOnly, limit, offset });
    return {
        notifications: rows.map(serializeNotification),
        page,
        perPage: limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        hasMore: offset + rows.length < total,
        unreadOnly,
    };
}
export async function markOneRead(userId, notificationId) {
    const instance = await db();
    const existing = await findOwnNotification(instance, userId, notificationId);
    if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Notification not found");
    }
    await markNotificationRead(instance, userId, notificationId);
    return { id: notificationId, isRead: true };
}
export async function markAllRead(userId) {
    const instance = await db();
    const updated = await markAllNotificationsRead(instance, userId);
    return { updated };
}
export async function getUnreadCount(userId) {
    const instance = await db();
    const count = await unreadCount(instance, userId);
    return { count };
}
export async function deleteOwnNotification(userId, notificationId) {
    const instance = await db();
    const existing = await findOwnNotification(instance, userId, notificationId);
    if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Notification not found");
    }
    await deleteNotification(instance, userId, notificationId);
}
/** Clear read notifications; unread ones are preserved. Returns the number deleted. */
export async function clearRead(userId) {
    const instance = await db();
    const deleted = await clearReadNotifications(instance, userId);
    return { deleted };
}
