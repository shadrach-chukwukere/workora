import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../database/types.js";

export type Executor = Kysely<DB> | Transaction<DB>;

export interface ReviewRow {
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
  created_at: Date;
}

export interface ReviewListRow extends ReviewRow {
  reviewer_name: string;
  reviewer_image: string | null;
  contract_title: string;
}

export async function findContractById(ex: Executor, contractId: string) {
  return ex
    .selectFrom("contracts")
    .select(["id", "client_id", "freelancer_id", "status", "title_snapshot"])
    .where("id", "=", contractId)
    .executeTakeFirst();
}

export async function findUserById(ex: Executor, userId: string) {
  return ex.selectFrom("users").select(["id", "name", "image"]).where("id", "=", userId).executeTakeFirst();
}

export async function findReviewById(ex: Executor, reviewId: string): Promise<ReviewRow | undefined> {
  return ex
    .selectFrom("reviews")
    .select(["id", "contract_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"])
    .where("id", "=", reviewId)
    .executeTakeFirst();
}

export async function findReviewByContractAndReviewer(
  ex: Executor,
  contractId: string,
  reviewerId: string,
): Promise<ReviewRow | undefined> {
  return ex
    .selectFrom("reviews")
    .select(["id", "contract_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"])
    .where("contract_id", "=", contractId)
    .where("reviewer_id", "=", reviewerId)
    .executeTakeFirst();
}

export async function createReview(
  ex: Executor,
  input: { contractId: string; reviewerId: string; revieweeId: string; rating: number; comment: string },
): Promise<ReviewRow> {
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

export async function listReviewsForUser(
  ex: Executor,
  revieweeId: string,
  limit: number,
  offset: number,
): Promise<ReviewListRow[]> {
  const rows = await sql<ReviewListRow>`
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

export async function countReviewsForUser(ex: Executor, revieweeId: string): Promise<number> {
  const row = await ex
    .selectFrom("reviews")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("reviewee_id", "=", revieweeId)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function averageRatingForUser(ex: Executor, revieweeId: string): Promise<number | null> {
  const rows = await sql<{ average: number | null }>`
    SELECT AVG(rating)::float8 AS average FROM reviews WHERE reviewee_id = ${revieweeId}
  `.execute(ex);
  const average = rows.rows[0]?.average;
  return average === null || average === undefined ? null : Number(average);
}

export async function deleteReviewById(ex: Executor, reviewId: string): Promise<boolean> {
  const result = await ex.deleteFrom("reviews").where("id", "=", reviewId).execute();
  return (result[0]?.numDeletedRows ?? 0n) > 0n;
}

export async function findReportByReviewAndReporter(
  ex: Executor,
  reviewId: string,
  reporterId: string,
) {
  return ex
    .selectFrom("review_reports")
    .select(["id", "status"])
    .where("review_id", "=", reviewId)
    .where("reporter_id", "=", reporterId)
    .executeTakeFirst();
}

export async function createReviewReport(
  ex: Executor,
  input: { reviewId: string; reporterId: string; reason: string },
) {
  return ex
    .insertInto("review_reports")
    .values({ review_id: input.reviewId, reporter_id: input.reporterId, reason: input.reason })
    .returning(["id", "review_id", "reporter_id", "reason", "status", "created_at"])
    .executeTakeFirstOrThrow();
}

export async function createModerationAction(
  ex: Executor,
  input: { actorId: string; targetId: string; reason: string },
) {
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

export async function countReportsForReview(ex: Executor, reviewId: string): Promise<number> {
  const row = await ex
    .selectFrom("review_reports")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("review_id", "=", reviewId)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function findReviewDetailsById(ex: Executor, reviewId: string) {
  const rows = await sql<ReviewListRow>`
    SELECT r.id, r.contract_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
           u.name AS reviewer_name, u.image AS reviewer_image, c.title_snapshot AS contract_title
    FROM reviews r
    INNER JOIN users u ON u.id = r.reviewer_id
    INNER JOIN contracts c ON c.id = r.contract_id
    WHERE r.id = ${reviewId}
  `.execute(ex);
  return rows.rows[0];
}
