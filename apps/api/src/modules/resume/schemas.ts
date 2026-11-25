import { z } from "zod";

/** Accepts YYYY-MM or YYYY-MM-DD; normalized to the first day of the month. */
const yearMonth = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/, "Use a YYYY-MM date");

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

export const experienceBodySchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(200, "Company is too long"),
  role: z.string().trim().min(1, "Role is required").max(200, "Role is too long"),
  start_date: yearMonth,
  end_date: z.union([yearMonth, z.null()]).optional(),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer").optional(),
});

export const experiencePatchSchema = experienceBodySchema.partial();

export const educationBodySchema = z.object({
  school: z.string().trim().min(1, "School is required").max(200, "School is too long"),
  degree: z.string().trim().min(1, "Degree is required").max(200, "Degree is too long"),
  field: optionalText(200),
  start_year: z.number().int().min(1980).max(2100),
  end_year: z.union([z.number().int().min(1980).max(2100), z.null()]).optional(),
});

export const educationPatchSchema = educationBodySchema.partial();

export const certificationBodySchema = z.object({
  name: z.string().trim().min(1, "Certification name is required").max(200, "Name is too long"),
  issuer: optionalText(200),
  year: z.union([z.number().int().min(1980).max(2100), z.null()]).optional(),
  credential_url: z.union([z.string().trim().url("Enter a valid URL"), z.null()]).optional(),
});

export const certificationPatchSchema = certificationBodySchema.partial();

export const skillsBodySchema = z.object({
  skillIds: z.array(z.uuid()).max(30, "Choose at most 30 skills"),
});

export const resumeFileBodySchema = z.object({
  url: z.string().trim().url("Enter a valid file URL"),
  fileName: z.string().trim().min(1, "File name is required").max(255),
  visibility: z.enum(["public", "private"]).optional(),
});

export const resumeImportSchema = z.object({
  headline: z.string().trim().max(200).optional(),
  about: z.string().trim().max(5000).optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
  experience: z.array(experienceBodySchema).max(20).optional(),
  education: z.array(educationBodySchema).max(10).optional(),
  certifications: z.array(certificationBodySchema).max(20).optional(),
  sections: z
    .array(z.enum(["headline", "about", "skills", "experience", "education", "certifications"]))
    .optional(),
});

export type ExperienceBody = z.infer<typeof experienceBodySchema>;
export type EducationBody = z.infer<typeof educationBodySchema>;
export type CertificationBody = z.infer<typeof certificationBodySchema>;
export type ResumeImportBody = z.infer<typeof resumeImportSchema>;

/** YYYY-MM -> YYYY-MM-01 for PostgreSQL date columns. */
export function toDate(value: string): string {
  return value.length === 7 ? `${value}-01` : value;
}
