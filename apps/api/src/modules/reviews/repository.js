import { sql } from "kysely";
export async function findContractById(ex, contractId) {
    return ex
        .selectFrom("contracts")
        .select(["id", "client_id", "freelancer_id", "status", "title_snapshot"])
        .where("id", "=", contractId)
        .executeTakeFirst();
}
export async function findUserById(ex, userId) {
    return ex.selectFrom("users").select(["id", "name", "image"]).where("id", "=", userId).executeTakeFirst();
}
export async function findReviewById(ex, reviewId) {
    return ex
        .selectFrom("reviews")
        .select(["id", "contract_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"])
        .where("id", "=", reviewId)
        .executeTakeFirst();
}
export async function findReviewByContractAndReviewer(ex, contractId, reviewerId) {
    return ex
        .selectFrom("reviews")
        .select(["id", "contract_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"])
        .where("contract_id", "=", contractId)
        .where("reviewer_id", "=", reviewerId)
        .executeTakeFirst();
}
export async function createReview(ex, input) {
    return ex
        .insertInto("reviews")
        .values({
        contract_id: input.contractId,
        reviewer_id: input.reviewerId,
        reviewee_id: input.revieweeId,
        rating: input.rating,
        comment: input.comment,
    })
        .returning(["id", "contract_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function listReviewsForUser(ex, revieweeId, limit, offset) {
    const rows = await sql `
    SELECT r.id, r.contract_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
           u.name AS reviewer_name, u.image AS reviewer_image, c.title_snapshot AS contract_title
    FROM reviews r
    INNER JOIN users u ON u.id = r.reviewer_id
    INNER JOIN contracts c ON c.id = r.contract_id
    WHERE r.reviewee_id = ${revieweeId}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `.execute(ex);
    return rows.rows;
}
export async function countReviewsForUser(ex, revieweeId) {
    const row = await ex
        .selectFrom("reviews")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("reviewee_id", "=", revieweeId)
        .executeTakeFirst();
    return Number(row?.count ?? 0);
}
export async function averageRatingForUser(ex, revieweeId) {
    const rows = await sql `
    SELECT AVG(rating)::float8 AS average FROM reviews WHERE reviewee_id = ${revieweeId}
  `.execute(ex);
    const average = rows.rows[0]?.average;
    return average === null || average === undefined ? null : Number(average);
}
export async function deleteReviewById(ex, reviewId) {
    const result = await ex.deleteFrom("reviews").where("id", "=", reviewId).execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
}
export async function findReportByReviewAndReporter(ex, reviewId, reporterId) {
    return ex
        .selectFrom("review_reports")
        .select(["id", "status"])
        .where("review_id", "=", reviewId)
        .where("reporter_id", "=", reporterId)
        .executeTakeFirst();
}
export async function createReviewReport(ex, input) {
    return ex
        .insertInto("review_reports")
        .values({ review_id: input.reviewId, reporter_id: input.reporterId, reason: input.reason })
        .returning(["id", "review_id", "reporter_id", "reason", "status", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function createModerationAction(ex, input) {
    return ex
        .insertInto("moderation_actions")
        .values({
        actor_id: input.actorId,
        target_type: "review",
        target_id: input.targetId,
        action: "report",
        reason: input.reason,
    })
        .returning(["id", "action", "created_at"])
        .executeTakeFirstOrThrow();
}
export async function countReportsForReview(ex, reviewId) {
    const row = await ex
        .selectFrom("review_reports")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("review_id", "=", reviewId)
        .executeTakeFirst();
    return Number(row?.count ?? 0);
}
export async function findReviewDetailsById(ex, reviewId) {
    const rows = await sql `
    SELECT r.id, r.contract_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
           u.name AS reviewer_name, u.image AS reviewer_image, c.title_snapshot AS contract_title
    FROM reviews r
    INNER JOIN users u ON u.id = r.reviewer_id
    INNER JOIN contracts c ON c.id = r.contract_id
    WHERE r.id = ${reviewId}
  `.execute(ex);
    return rows.rows[0];
}
