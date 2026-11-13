import { z } from "zod";

/** POST /verification-requests — freelancers only. */
export const createVerificationRequestSchema = z.object({
  documentType: z.enum(["passport", "drivers-license", "national-id", "other"]),
});

/** POST /verification-requests/:id/reject */
export const rejectVerificationSchema = z.object({
  reason: z.string().trim().min(3, "reason must be at least 3 characters").max(1000),
});

/** POST /verification-requests/:id/request-info */
export const requestInfoVerificationSchema = z.object({
  notes: z.string().trim().min(3, "notes must be at least 3 characters").max(1000),
});

/** GET /verification-requests — admin list filter. */
export const listVerificationQuerySchema = z.object({
  status: z.enum(["pending", "info_requested", "approved", "rejected"]).optional(),
});

export type CreateVerificationRequestInput = z.infer<typeof createVerificationRequestSchema>;
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;
export type RequestInfoVerificationInput = z.infer<typeof requestInfoVerificationSchema>;
export type ListVerificationQuery = z.infer<typeof listVerificationQuerySchema>;
