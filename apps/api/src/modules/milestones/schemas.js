import { z } from "zod";
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be in YYYY-MM-DD format");
export const milestoneParamsSchema = z.object({
    contractId: z.uuid(),
});
export const milestoneItemParamsSchema = z.object({
    contractId: z.uuid(),
    milestoneId: z.uuid(),
});
export const createMilestoneSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    description: z.string().trim().max(4000).optional(),
    amountMinor: z.number().int("amountMinor must be an integer").positive("amountMinor must be a positive integer"),
    dueDate: dateString.optional(),
    sequencing: z.number().int().min(1).max(10000).optional(),
});
export const submitMilestoneSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    note: z.string().trim().max(4000).optional(),
    url: z.string().trim().max(2048).optional(),
});
export const requestRevisionSchema = z.object({
    note: z.string().trim().min(1, "A revision note is required").max(2000),
});
export const MILESTONE_STATUSES = ["upcoming", "funded", "in_review", "revision", "approved", "paid", "cancelled"];
