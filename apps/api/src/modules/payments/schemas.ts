import { z } from "zod";

/** POST /payments/methods — demo-safe: no PAN is ever accepted or stored. */
export const addPaymentMethodSchema = z.object({
  provider: z.enum(["stripe", "paystack"]).default("stripe"),
  brand: z.string().trim().min(1).max(40).optional(),
  lastFour: z
    .string()
    .regex(/^\d{4}$/, "lastFour must be exactly 4 digits")
    .optional(),
  expMonth: z.coerce.number().int().min(1).max(12).optional(),
  expYear: z.coerce.number().int().min(2000).max(2200).optional(),
});

/** POST /payments/initialize — DEMO MODE ONLY. Creates a pending payment row; no provider API is called. */
export const initializePaymentSchema = z.object({
  kind: z.enum(["milestone", "subscription", "topup"]),
  amountMinor: z.coerce.number().int().positive("amountMinor must be a positive integer"),
  currency: z
    .string()
    .trim()
    .length(3, "currency must be a 3-letter ISO code")
    .transform((value) => value.toUpperCase()),
  contractId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
});

/** POST /payments/verify */
export const verifyPaymentSchema = z.object({
  reference: z.string().trim().min(1, "reference is required").max(200),
});

/** GET /payments/transactions — pagination via parsePage, filters via zod. */
export const transactionsQuerySchema = z.object({
  type: z.enum(["milestone", "commission", "refund", "withdrawal", "topup", "payout", "payment"]).optional(),
  status: z.enum(["pending", "completed", "failed"]).optional(),
  dateFrom: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "dateFrom must be a valid ISO date/datetime")
    .optional(),
  dateTo: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "dateTo must be a valid ISO date/datetime")
    .optional(),
});

export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
