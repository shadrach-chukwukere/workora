import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import { parsePage } from "../common/index.js";
/** Postgres unique-violation error code (pg surfaces it directly on the error object). */
function isUniqueViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505");
}
import { averageRatingForUser, countReportsForReview, countReviewsForUser, createModerationAction, createReview, createReviewReport, deleteReviewById, findContractById, findReportByReviewAndReporter, findReviewByContractAndReviewer, findReviewById, findReviewDetailsById, findUserById, listReviewsForUser, } from "./repository.js";
function serializeReview(review) {
    const hasJoins = "reviewer_name" in review;
    return {
        id: review.id,
        contractId: review.contract_id,
        reviewerId: review.reviewer_id,
        revieweeId: review.reviewee_id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
        ...(hasJoins
            ? {
                reviewer: {
                    id: review.reviewer_id,
                    name: review.reviewer_name,
                    image: review.reviewer_image,
                },
                contractTitle: review.contract_title,
            }
            : {}),
    };
}
export async function createContractReview(actor, contractId, input) {
    const instance = await db();
    const contract = await findContractById(instance, contractId);
    if (!contract) {
        throw new AppError(404, "NOT_FOUND", "Contract not found");
    }
    if (contract.status !== "completed") {
        throw new AppError(400, "BAD_REQUEST", "Contract must be completed before it can be reviewed", {
            contractStatus: contract.status,
        });
    }
    const isParticipant = contract.client_id === actor.id || contract.freelancer_id === actor.id;
    if (!isParticipant) {
        throw new AppError(403, "FORBIDDEN", "Only contract participants can review this contract");
    }
    const revieweeId = contract.client_id === actor.id ? contract.freelancer_id : contract.client_id;
    const existing = await findReviewByContractAndReviewer(instance, contractId, actor.id);
    if (existing) {
        throw new AppError(409, "CONFLICT", "You have already reviewed this contract");
    }
    try {
        const review = await createReview(instance, {
            contractId,
            reviewerId: actor.id,
            revieweeId,
            rating: input.rating,
            comment: input.comment,
        });
        return serializeReview(review);
    }
    catch (error) {
        if (isUniqueViolation(error)) {
            throw new AppError(409, "CONFLICT", "You have already reviewed this contract");
        }
        throw error;
    }
}
export async function listUserReviews(userId, query) {
    const instance = await db();
    const user = await findUserById(instance, userId);
    if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found");
    }
    const { limit, offset, page } = parsePage(query);
    const [total, rows, average] = await Promise.all([
        countReviewsForUser(instance, userId),
        listReviewsForUser(instance, userId, limit, offset),
        averageRatingForUser(instance, userId),
    ]);
    return {
        reviews: rows.map((row) => ({
            id: row.id,
            contractId: row.contract_id,
            rating: row.rating,
            comment: row.comment,
            createdAt: row.created_at,
            reviewer: { id: row.reviewer_id, name: row.reviewer_name, image: row.reviewer_image },
            contractTitle: row.contract_title,
        })),
        page,
        perPage: limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        hasMore: offset + rows.length < total,
        averageRating: average === null ? null : Math.round(average * 100) / 100,
    };
}
export async function getPublicReview(reviewId) {
    const instance = await db();
    const [review, reportCount] = await Promise.all([
        findReviewDetailsById(instance, reviewId),
        countReportsForReview(instance, reviewId),
    ]);
    if (!review) {
        throw new AppError(404, "NOT_FOUND", "Review not found");
    }
    return {
        ...serializeReview(review),
        reportCount,
        isReported: reportCount > 0,
    };
}
export async function reportReview(reporterId, reviewId, input) {
    const instance = await db();
    const review = await findReviewById(instance, reviewId);
    if (!review) {
        throw new AppError(404, "NOT_FOUND", "Review not found");
    }
    const existing = await findReportByReviewAndReporter(instance, reviewId, reporterId);
    if (existing) {
        throw new AppError(409, "CONFLICT", "You have already reported this review");
    }
    try {
        const report = await instance.transaction().execute(async (trx) => {
            const created = await createReviewReport(trx, { reviewId, reporterId, reason: input.reason });
            await createModerationAction(trx, { actorId: reporterId, targetId: reviewId, reason: input.reason });
            return created;
        });
        return {
            id: report.id,
            reviewId: report.review_id,
            reporterId: report.reporter_id,
            reason: report.reason,
            status: report.status,
            createdAt: report.created_at,
        };
    }
    catch (error) {
        if (isUniqueViolation(error)) {
            throw new AppError(409, "CONFLICT", "You have already reported this review");
        }
        throw error;
    }
}
export async function deleteReview(actor, reviewId) {
    const instance = await db();
    const review = await findReviewById(instance, reviewId);
    if (!review) {
        throw new AppError(404, "NOT_FOUND", "Review not found");
    }
    const isAuthor = review.reviewer_id === actor.id;
    const isAdmin = actor.accountType === "admin";
    if (!isAuthor && !isAdmin) {
        throw new AppError(403, "FORBIDDEN", "You can only delete your own reviews");
    }
    await deleteReviewById(instance, reviewId);
}
