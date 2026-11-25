import { z } from "zod";

export const aiParseBodySchema = z
  .object({
    text: z.string().trim().max(20_000, "Resume text must be 20,000 characters or fewer").optional(),
    fileBase64: z.string().min(1).max(14_000_000).optional(),
    mimeType: z.literal("application/pdf").optional(),
  })
  .refine((value) => Boolean(value.text?.trim()) || Boolean(value.fileBase64), {
    message: "Paste resume text or upload a PDF",
  });

export const aiGenerateBodySchema = z.object({
  targetRole: z.string().trim().max(120).optional(),
  tone: z.enum(["professional", "concise", "confident"]).optional(),
});

const rawExperience = z.object({
  company: z.string().catch(""),
  role: z.string().catch(""),
  startDate: z.string().catch(""),
  endDate: z.string().catch(""),
  description: z.string().catch(""),
  achievements: z.array(z.string()).catch([]),
});

const rawEducation = z.object({
  school: z.string().catch(""),
  degree: z.string().catch(""),
  field: z.string().catch(""),
  startYear: z.union([z.number(), z.string()]).catch(0),
  endYear: z.union([z.number(), z.string(), z.null()]).catch(null),
});

const rawCertification = z.object({
  name: z.string().catch(""),
  issuer: z.string().catch(""),
  year: z.union([z.number(), z.string(), z.null()]).catch(null),
  credentialUrl: z.string().catch(""),
});

export const rawResumeSchema = z.object({
  headline: z.string().catch(""),
  about: z.string().catch(""),
  skills: z.array(z.string()).catch([]),
  experience: z.array(rawExperience).catch([]),
  education: z.array(rawEducation).catch([]),
  certifications: z.array(rawCertification).catch([]),
});

export const rawGenerateSchema = z.object({
  headlineOptions: z.array(z.string()).catch([]),
  about: z.string().catch(""),
  experienceBullets: z
    .array(
      z.object({
        company: z.string().catch(""),
        role: z.string().catch(""),
        bullets: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  suggestedSkills: z.array(z.string()).catch([]),
});

function month(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1980 || year > 2100) return null;
  const rawMonth = match[2] ? Number(match[2]) : 1;
  if (rawMonth < 1 || rawMonth > 12) return null;
  return `${year}-${String(rawMonth).padStart(2, "0")}`;
}

function year(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) && number >= 1980 && number <= 2100 ? Math.floor(number) : null;
}

export interface NormalizedResume {
  headline: string;
  about: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    start_date: string;
    end_date: string | null;
    description: string;
  }[];
  education: {
    school: string;
    degree: string;
    field: string | null;
    start_year: number;
    end_year: number | null;
  }[];
  certifications: {
    name: string;
    issuer: string | null;
    year: number | null;
    credential_url: string | null;
  }[];
}

/** Converts the model payload into the exact shapes accepted by /users/me/resume/import. */
export function normalizeResume(raw: unknown): { resume: NormalizedResume; warnings: string[] } {
  const parsed = rawResumeSchema.parse(raw);
  const warnings: string[] = [];

  const experience = parsed.experience
    .map((item) => {
      const start = month(item.startDate);
      if (!item.company.trim() || !item.role.trim() || !start) return null;
      const bullets = item.achievements.map((bullet) => bullet.trim()).filter(Boolean);
      const description = [item.description.trim(), bullets.map((bullet) => `• ${bullet}`).join("\n")]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 2000);
      return {
        company: item.company.trim().slice(0, 200),
        role: item.role.trim().slice(0, 200),
        start_date: start,
        end_date: month(item.endDate),
        description,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 20);

  if (experience.length < parsed.experience.length) {
    warnings.push("Some experience entries were skipped because they were missing a company, role, or start date.");
  }

  const education = parsed.education
    .map((item) => {
      const startYear = year(item.startYear);
      if (!item.school.trim() || !item.degree.trim() || startYear === null) return null;
      return {
        school: item.school.trim().slice(0, 200),
        degree: item.degree.trim().slice(0, 200),
        field: item.field.trim().slice(0, 200) || null,
        start_year: startYear,
        end_year: year(item.endYear),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 10);

  const certifications = parsed.certifications
    .map((item) => {
      if (!item.name.trim()) return null;
      const credentialUrl = item.credentialUrl.trim();
      return {
        name: item.name.trim().slice(0, 200),
        issuer: item.issuer.trim().slice(0, 200) || null,
        year: year(item.year),
        credential_url: /^https?:\/\//i.test(credentialUrl) ? credentialUrl.slice(0, 500) : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 20);

  const skills = [...new Set(parsed.skills.map((skill) => skill.trim()).filter(Boolean))].slice(0, 40);

  return {
    resume: {
      headline: parsed.headline.trim().slice(0, 200),
      about: parsed.about.trim().slice(0, 5000),
      skills,
      experience,
      education,
      certifications,
    },
    warnings,
  };
}

export interface GenerateSuggestions {
  headlineOptions: string[];
  about: string;
  experienceBullets: { company: string; role: string; bullets: string[] }[];
  suggestedSkills: string[];
}

export function normalizeSuggestions(raw: unknown): GenerateSuggestions {
  const parsed = rawGenerateSchema.parse(raw);
  return {
    headlineOptions: [...new Set(parsed.headlineOptions.map((value) => value.trim()).filter(Boolean))].slice(0, 3),
    about: parsed.about.trim().slice(0, 5000),
    experienceBullets: parsed.experienceBullets
      .map((item) => ({
        company: item.company.trim().slice(0, 200),
        role: item.role.trim().slice(0, 200),
        bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 8),
      }))
      .filter((item) => item.company || item.role)
      .slice(0, 20),
    suggestedSkills: [...new Set(parsed.suggestedSkills.map((value) => value.trim()).filter(Boolean))].slice(0, 20),
  };
}

export const RESUME_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    about: { type: "STRING" },
    skills: { type: "ARRAY", items: { type: "STRING" } },
    experience: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          company: { type: "STRING" },
          role: { type: "STRING" },
          startDate: { type: "STRING" },
          endDate: { type: "STRING" },
          description: { type: "STRING" },
          achievements: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["company", "role", "startDate", "endDate", "description", "achievements"],
      },
    },
    education: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          school: { type: "STRING" },
          degree: { type: "STRING" },
          field: { type: "STRING" },
          startYear: { type: "INTEGER" },
          endYear: { type: "INTEGER", nullable: true },
        },
        required: ["school", "degree", "field", "startYear", "endYear"],
      },
    },
    certifications: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          issuer: { type: "STRING" },
          year: { type: "INTEGER", nullable: true },
          credentialUrl: { type: "STRING" },
        },
        required: ["name", "issuer", "year", "credentialUrl"],
      },
    },
  },
  required: ["headline", "about", "skills", "experience", "education", "certifications"],
} as const;

export const GENERATE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headlineOptions: { type: "ARRAY", items: { type: "STRING" } },
    about: { type: "STRING" },
    experienceBullets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          company: { type: "STRING" },
          role: { type: "STRING" },
          bullets: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["company", "role", "bullets"],
      },
    },
    suggestedSkills: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["headlineOptions", "about", "experienceBullets", "suggestedSkills"],
} as const;
