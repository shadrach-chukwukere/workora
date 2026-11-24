import { z } from "zod";

export const CONTACT_TOPICS = ["project", "billing", "trust", "press", "other"] as const;
export const CONTACT_STATUSES = ["new", "read", "replied", "archived"] as const;

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120, "Keep the name under 120 characters"),
  email: z.email("Enter a valid email address").max(254),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(20, "Give us at least 20 characters").max(4000, "Keep the message under 4000 characters"),
});

export const contactStatusSchema = z.enum(CONTACT_STATUSES);

export const updateContactSchema = z
  .object({
    status: contactStatusSchema.optional(),
    adminNotes: z.string().trim().max(4000, "Keep notes under 4000 characters").nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.adminNotes !== undefined, {
    message: "Provide a status or admin notes",
  });

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
