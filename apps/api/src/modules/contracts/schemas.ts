import { z } from "zod";

export const contractUuidParamSchema = z.object({ id: z.uuid() });

export const listContractsQuerySchema = z.object({
  status: z.enum(["active", "completed", "cancelled", "paused", "disputed"]).optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

export const cancelContractSchema = z.object({
  reason: z.string().trim().min(3, "Cancellation reason must be at least 3 characters").max(1000),
});
export type CancelContractInput = z.infer<typeof cancelContractSchema>;

export const CONTRACT_STATUSES = ["active", "completed", "cancelled", "paused", "disputed"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
