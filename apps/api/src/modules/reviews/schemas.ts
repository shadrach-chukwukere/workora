import { z } from "zod";

/** POST /contracts/:contractId/reviews */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .trim()
    .min(10, "Comment must be at least 10 characters")
    .max(1000, "Comment must be at most 1000 characters"),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** POST /reviews/:id/report */
export const reportReviewSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason must be at most 500 characters"),
});
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
