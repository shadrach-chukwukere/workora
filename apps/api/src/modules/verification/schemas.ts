import { z } from "zod";

export const documentCategorySchema = z.enum(["identity_document", "selfie", "supporting_document"]);

/** POST /verification-requests/uploads — client uploads one private file. */
export const verificationUploadSchema = z.object({
  category: documentCategorySchema,
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(100),
  contentBase64: z.string().min(1),
});

/** A private upload returned by /verification-requests/uploads. */
export const verificationDocumentInputSchema = z.object({
  category: documentCategorySchema,
  key: z.string().trim().min(1).max(2048),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.coerce.number().int().positive().max(10 * 1024 * 1024),
});

/** POST /verification-requests — any signed-in user. */
export const createVerificationRequestSchema = z.object({
  method: z.enum(["manual", "yoti"]).default("manual"),
  documentType: z.enum(["passport", "drivers-license", "national-id", "other", "yoti"]).default("other"),
  documents: z.array(verificationDocumentInputSchema).max(10).optional(),
  /** Safe same-site destination to preserve through a Yoti round trip. */
  next: z.string().trim().max(2048).optional(),
});

/** POST /verification-requests/:id/documents — replace/add documents after info_requested. */
export const addVerificationDocumentsSchema = z.object({
  documents: z.array(verificationDocumentInputSchema).min(1).max(10),
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
  status: z.enum(["pending", "info_requested", "approved", "rejected", "all"]).optional(),
});

export type VerificationDocumentInput = z.infer<typeof verificationDocumentInputSchema>;
