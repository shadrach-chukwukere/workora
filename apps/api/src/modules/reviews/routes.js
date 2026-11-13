import { z } from "zod";
import { ok, requireAuth } from "../common/index.js";
import { AppError } from "../../plugins/error-handler.js";
import { createContractReview, deleteReview, getPublicReview, listUserReviews, reportReview, } from "./service.js";
import { createReviewSchema, reportReviewSchema } from "./schemas.js";
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
export default async function reviewsRoutes(app) {
    /** POST /api/v1/contracts/:contractId/reviews — review the other party of a completed contract. */
    app.post("/contracts/:contractId/reviews", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const contractId = parseUuidParam(request.params.contractId, "contractId");
        const parsed = createReviewSchema.safeParse(request.body);
        if (!parsed.success)
            throw validationError(parsed.error);
        const review = await createContractReview({ id: user.id }, contractId, parsed.data);
        reply.status(201).send(ok({ review }, "Review created"));
    });
    /** GET /api/v1/users/:id/reviews — public, paginated list of reviews about a user. */
    app.get("/users/:id/reviews", async (request, reply) => {
        const userId = parseUuidParam(request.params.id, "id");
        const result = await listUserReviews(userId, request.query);
        reply.send(ok(result));
    });
    /** GET /api/v1/reviews/:id — public single review, including its report count. */
    app.get("/reviews/:id", async (request, reply) => {
        const reviewId = parseUuidParam(request.params.id, "id");
        const review = await getPublicReview(reviewId);
        reply.send(ok({ review }));
    });
    /** DELETE /api/v1/reviews/:id — delete a review (author or admin). */
    app.delete("/reviews/:id", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const reviewId = parseUuidParam(request.params.id, "id");
        await deleteReview({ id: user.id, accountType: user.accountType }, reviewId);
        reply.send(ok(null, "Review deleted"));
    });
    /** POST /api/v1/reviews/:id/report — report a review for moderation (authenticated, one report per user). */
    app.post("/reviews/:id/report", { preHandler: requireAuth }, async (request, reply) => {
        const user = request.currentUser;
        if (!user)
            throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
        const reviewId = parseUuidParam(request.params.id, "id");
        const parsed = reportReviewSchema.safeParse(request.body);
        if (!parsed.success)
            throw validationError(parsed.error);
        const report = await reportReview(user.id, reviewId, parsed.data);
        reply.status(201).send(ok({ report }, "Review reported"));
    });
}
