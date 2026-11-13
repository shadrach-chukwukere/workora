import { z } from "zod";
/** Path param that must be a UUID. */
export const uuidParamSchema = z.object({ id: z.uuid() });
export const createProposalSchema = z.object({
    coverLetter: z.string().trim().min(50, "Cover letter must be at least 50 characters").max(2000),
    bidType: z.enum(["fixed", "hourly"]),
    bidAmountMinor: z.number().int("bidAmountMinor must be an integer").positive("bidAmountMinor must be a positive integer"),
    durationDays: z.number().int().min(1).max(365).optional(),
});
export const myProposalsQuerySchema = z.object({
    status: z.enum(["pending", "shortlisted", "accepted", "rejected", "withdrawn"]).optional(),
    sort: z.enum(["newest", "oldest"]).optional(),
});
export const PROPOSAL_STATUSES = ["pending", "shortlisted", "accepted", "rejected", "withdrawn"];
