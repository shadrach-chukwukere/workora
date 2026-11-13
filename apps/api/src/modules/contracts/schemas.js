import { z } from "zod";
export const contractUuidParamSchema = z.object({ id: z.uuid() });
export const listContractsQuerySchema = z.object({
    status: z.enum(["active", "completed", "cancelled", "paused", "disputed"]).optional(),
});
export const cancelContractSchema = z.object({
    reason: z.string().trim().min(3, "Cancellation reason must be at least 3 characters").max(1000),
});
export const CONTRACT_STATUSES = ["active", "completed", "cancelled", "paused", "disputed"];
