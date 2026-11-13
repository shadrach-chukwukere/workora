export async function listNotifications(ex, userId, options) {
    let builder = ex
        .selectFrom("notifications")
        .select([
        "id",
        "user_id",
        "type",
        "title",
        "body",
        "url",
        "entity_type",
        "entity_id",
        "is_read",
        "created_at",
    ])
        .where("user_id", "=", userId);
    if (options.unreadOnly) {
        builder = builder.where("is_read", "=", false);
    }
    let countBuilder = ex
        .selectFrom("notifications")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("user_id", "=", userId);
    if (options.unreadOnly) {
        countBuilder = countBuilder.where("is_read", "=", false);
    }
    const [rows, countRow] = await Promise.all([
        builder.orderBy("created_at", "desc").limit(options.limit).offset(options.offset).execute(),
        countBuilder.executeTakeFirst(),
    ]);
    return { rows, total: Number(countRow?.count ?? 0) };
}
export async function findOwnNotification(ex, userId, notificationId) {
    return ex
        .selectFrom("notifications")
        .select(["id", "is_read"])
        .where("id", "=", notificationId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
}
export async function unreadCount(ex, userId) {
    const row = await ex
        .selectFrom("notifications")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("user_id", "=", userId)
        .where("is_read", "=", false)
        .executeTakeFirst();
    return Number(row?.count ?? 0);
}
export async function markNotificationRead(ex, userId, notificationId) {
    const result = await ex
        .updateTable("notifications")
        .set({ is_read: true })
        .where("id", "=", notificationId)
        .where("user_id", "=", userId)
        .execute();
    return (result[0]?.numUpdatedRows ?? 0n) > 0n;
}
export async function markAllNotificationsRead(ex, userId) {
    const result = await ex
        .updateTable("notifications")
        .set({ is_read: true })
        .where("user_id", "=", userId)
        .where("is_read", "=", false)
        .execute();
    return Number(result[0]?.numUpdatedRows ?? 0);
}
export async function deleteNotification(ex, userId, notificationId) {
    const result = await ex
        .deleteFrom("notifications")
        .where("id", "=", notificationId)
        .where("user_id", "=", userId)
        .execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
}
/** Delete only the read notifications; unread ones are preserved. Returns the number deleted. */
export async function clearReadNotifications(ex, userId) {
    const result = await ex
        .deleteFrom("notifications")
        .where("user_id", "=", userId)
        .where("is_read", "=", true)
        .execute();
    return Number(result[0]?.numDeletedRows ?? 0);
}
