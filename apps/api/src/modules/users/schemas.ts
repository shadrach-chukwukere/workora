import { z } from "zod";

/**
 * Bare domains such as `github.com/name` are accepted and normalised to
 * `https://github.com/name` before validation, so a pasted link always works.
 */
const contactUrl = z
  .union([z.string().trim().max(500), z.null()])
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  })
  .pipe(z.string().url("Enter a valid URL").nullable());

/** Empty input clears the stored URL. */
const imageUrl = z
  .union([z.string().trim().max(2000), z.null()])
  .transform((value) => value?.trim() || null)
  .pipe(z.string().url("Enter a valid URL").nullable());

const phone = z
  .union([z.string().trim().max(40), z.null()])
  .transform((value) => value?.trim() || null)
  .pipe(z.string().regex(/^[+\d\s().-]{7,40}$/, "Enter a valid phone number").nullable());

/** PATCH /api/v1/users/me — whitelist of safe, self-service fields. */
export const updateMeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long").optional(),
  image: imageUrl.optional(),
  banner_url: imageUrl.optional(),
  phone: phone.optional(),
  github_url: contactUrl.optional(),
  linkedin_url: contactUrl.optional(),
  twitter_url: contactUrl.optional(),
  instagram_url: contactUrl.optional(),
  website_url: contactUrl.optional(),
  portfolio_url: contactUrl.optional(),
});

export type UpdateMeValues = z.infer<typeof updateMeSchema>;
