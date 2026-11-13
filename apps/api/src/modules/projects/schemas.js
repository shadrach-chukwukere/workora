import { z } from "zod";
export const uuidSchema = z.uuid();
/** Shared shape for POST /projects (create) and PUT /projects/:id (replace). */
export const projectBodySchema = z
    .object({
    title: z.string().trim().min(5, "Title must be at least 5 characters").max(200, "Title must be at most 200 characters"),
    summary: z.string().trim().min(1, "Summary is required").max(500, "Summary must be at most 500 characters"),
    description: z.string().trim().min(1, "Description is required").max(50000, "Description is too long"),
    categoryId: uuidSchema.optional(),
    budgetType: z.enum(["fixed", "hourly"]),
    budgetMinMinor: z.number().int("Budget must be an integer").min(0, "Budget must be >= 0").optional(),
    budgetMaxMinor: z.number().int("Budget must be an integer").min(0, "Budget must be >= 0").optional(),
    experienceLevel: z.enum(["entry", "intermediate", "expert"]).optional(),
    durationBucket: z.enum(["lt-1m", "1-3m", "3-6m", "gt-6m"]).optional(),
    deadline: z.iso.date().optional(),
    invitedOnly: z.boolean().optional(),
})
    .superRefine((value, ctx) => {
    if (value.budgetMinMinor !== undefined &&
        value.budgetMaxMinor !== undefined &&
        value.budgetMaxMinor < value.budgetMinMinor) {
        ctx.addIssue({
            code: "custom",
            path: ["budgetMaxMinor"],
            message: "budgetMaxMinor must be greater than or equal to budgetMinMinor",
        });
    }
});
/** Public visibility of projects in the marketplace listing (drafts/flagged are never listed). */
export const publicProjectStatusSchema = z.enum(["open", "in_progress", "paused", "completed", "cancelled"]);
export const listProjectsQuerySchema = z.object({
    q: z.string().trim().min(1).max(200).optional(),
    categoryId: uuidSchema.optional(),
    budgetType: z.enum(["fixed", "hourly"]).optional(),
    experienceLevel: z.enum(["entry", "intermediate", "expert"]).optional(),
    status: publicProjectStatusSchema.default("open"),
    sort: z.enum(["newest", "budget_desc", "budget_asc", "fewest_proposals"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
});
export const idParamSchema = z.object({
    id: uuidSchema,
});
export const closeProjectBodySchema = z.object({
    reason: z.string().trim().min(1).max(1000).optional(),
});
export const listProposalsQuerySchema = z.object({
    status: z.enum(["pending", "shortlisted", "accepted", "rejected", "withdrawn"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
});
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
});
export const projectSkillsBodySchema = z.object({
    skillIds: z.array(uuidSchema).max(50, "A project can have at most 50 skills"),
});
