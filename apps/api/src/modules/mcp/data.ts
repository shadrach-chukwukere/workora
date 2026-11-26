import { sql, type Kysely } from "kysely";
import { db } from "../../database/connection.js";
import type { DB } from "../../database/types.js";
import type { AuthedUser } from "../../middleware/authenticate.js";
import { toApiProject, type ApiProject } from "../projects/repository.js";

type Db = Kysely<DB>;

const UUID = /^[0-9a-fA-F-]{36}$/;

export async function loadAuthedUser(userId: string): Promise<AuthedUser> {
  const instance = await db();
  const rows = await instance
    .selectFrom("users")
    .leftJoin("user_roles", "user_roles.user_id", "users.id")
    .leftJoin("roles", "roles.id", "user_roles.role_id")
    .select(["users.account_type", "users.verified", "roles.key as role_key"])
    .where("users.id", "=", userId)
    .execute();
  const keys = [...new Set(rows.map((r) => r.role_key).filter((key): key is string => Boolean(key)))];
  const permissions = new Set<string>();
  if (keys.length > 0) {
    const permRows = await instance
      .selectFrom("roles")
      .innerJoin("role_permissions", "role_permissions.role_id", "roles.id")
      .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
      .select("permissions.key")
      .where("roles.key", "in", keys)
      .execute();
    for (const row of permRows) permissions.add(row.key);
  }
  return {
    id: userId,
    accountType: rows[0]?.account_type ?? "freelancer",
    verified: rows[0]?.verified ?? false,
    roles: keys,
    permissions,
  };
}

export interface FreelancerSearchInput {
  query?: string;
  title?: string;
  location?: string;
  availability?: "available" | "limited" | "unavailable";
  experience?: "entry" | "intermediate" | "expert";
  skill?: string;
  minRating?: number;
  page: number;
  perPage: number;
}

async function skillsFor(instance: Db, userIds: string[]): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await instance
    .selectFrom("freelancer_skills")
    .innerJoin("skills", "skills.id", "freelancer_skills.skill_id")
    .select(["freelancer_skills.freelancer_id", "skills.name"])
    .where("freelancer_skills.freelancer_id", "in", userIds)
    .execute();
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.freelancer_id) ?? [];
    list.push(row.name);
    map.set(row.freelancer_id, list);
  }
  return map;
}

export async function searchFreelancers(input: FreelancerSearchInput) {
  const instance = await db();
  let builder = instance
    .selectFrom("users")
    .innerJoin("freelancer_profiles", "freelancer_profiles.user_id", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.image",
      "users.created_at",
      "freelancer_profiles.headline",
      "freelancer_profiles.location",
      "freelancer_profiles.availability",
      "freelancer_profiles.experience_level",
      "freelancer_profiles.hourly_rate_minor",
      "freelancer_profiles.currency",
      "freelancer_profiles.rating_avg",
      "freelancer_profiles.rating_count",
      "freelancer_profiles.completed_count",
      "freelancer_profiles.verified_identity",
      "freelancer_profiles.about",
    ])
    .where("users.status", "=", "active")
    .where("users.account_type", "=", "freelancer");

  if (input.query) {
    const term = `%${input.query}%`;
    builder = builder.where((eb) =>
      eb.or([
        eb("users.name", "ilike", term),
        eb("freelancer_profiles.headline", "ilike", term),
        eb("freelancer_profiles.about", "ilike", term),
      ]),
    );
  }
  if (input.title) builder = builder.where("freelancer_profiles.headline", "ilike", `%${input.title}%`);
  if (input.location) builder = builder.where("freelancer_profiles.location", "ilike", `%${input.location}%`);
  if (input.availability) builder = builder.where("freelancer_profiles.availability", "=", input.availability);
  if (input.experience) builder = builder.where("freelancer_profiles.experience_level", "=", input.experience);
  if (input.skill) {
    builder = builder.where((eb) =>
      eb.exists(
        eb
          .selectFrom("freelancer_skills")
          .innerJoin("skills", "skills.id", "freelancer_skills.skill_id")
          .select("freelancer_skills.freelancer_id")
          .whereRef("freelancer_skills.freelancer_id", "=", "users.id")
          .where("skills.name", "ilike", `%${input.skill}%`),
      ),
    );
  }
  if (input.minRating != null) {
    builder = builder.where(
      sql<boolean>`CAST(${sql.ref("freelancer_profiles.rating_avg")} AS double precision) >= ${input.minRating}`,
    );
  }

  const offset = (input.page - 1) * input.perPage;
  const [rows, totalRows] = await Promise.all([
    builder
      .orderBy("freelancer_profiles.is_featured", "desc")
      .orderBy("users.created_at", "desc")
      .limit(input.perPage)
      .offset(offset)
      .execute(),
    builder.clearSelect().clearLimit().clearOffset().select("users.id").execute(),
  ]);

  const skillMap = await skillsFor(instance, rows.map((row) => row.id));
  return {
    page: input.page,
    perPage: input.perPage,
    total: totalRows.length,
    freelancers: rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.headline,
      location: row.location,
      availability: row.availability,
      experienceLevel: row.experience_level,
      hourlyRateMinor: row.hourly_rate_minor,
      currency: row.currency,
      rating: row.rating_avg === null ? null : Number(row.rating_avg),
      ratingCount: row.rating_count,
      completedProjects: row.completed_count,
      verified: row.verified_identity,
      skills: skillMap.get(row.id) ?? [],
      profileUrl: `/freelancers/${row.id}`,
    })),
  };
}

export async function isUuid(value: string): Promise<boolean> {
  return UUID.test(value);
}

export async function getFreelancerProfile(id: string) {
  const instance = await db();
  const user = await instance
    .selectFrom("users")
    .innerJoin("freelancer_profiles", "freelancer_profiles.user_id", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.image",
      "users.created_at",
      "freelancer_profiles.headline",
      "freelancer_profiles.about",
      "freelancer_profiles.location",
      "freelancer_profiles.availability",
      "freelancer_profiles.experience_level",
      "freelancer_profiles.hourly_rate_minor",
      "freelancer_profiles.currency",
      "freelancer_profiles.response_time_hours",
      "freelancer_profiles.rating_avg",
      "freelancer_profiles.rating_count",
      "freelancer_profiles.completed_count",
      "freelancer_profiles.verified_identity",
    ])
    .where("users.id", "=", id)
    .where("users.account_type", "=", "freelancer")
    .executeTakeFirst();
  if (!user) return null;

  const [skills, portfolio, experience, reviewRows] = await Promise.all([
    instance
      .selectFrom("freelancer_skills")
      .innerJoin("skills", "skills.id", "freelancer_skills.skill_id")
      .select(["skills.name", "skills.slug"])
      .where("freelancer_skills.freelancer_id", "=", id)
      .execute(),
    instance
      .selectFrom("portfolio_projects")
      .select(["id", "title", "summary", "description", "role", "year", "project_url", "image_url"])
      .where("freelancer_id", "=", id)
      .orderBy("sort_order", "asc")
      .execute(),
    instance
      .selectFrom("work_experiences")
      .select(["id", "company", "role", "start_date", "end_date", "description"])
      .where("freelancer_id", "=", id)
      .orderBy("start_date", "desc")
      .execute(),
    instance
      .selectFrom("reviews")
      .select(["rating", "comment", "created_at"])
      .where("reviewee_id", "=", id)
      .orderBy("created_at", "desc")
      .limit(5)
      .execute(),
  ]);

  return {
    id: user.id,
    name: user.name,
    title: user.headline,
    about: user.about,
    location: user.location,
    availability: user.availability,
    experienceLevel: user.experience_level,
    hourlyRateMinor: user.hourly_rate_minor,
    currency: user.currency,
    responseTimeHours: user.response_time_hours,
    verified: user.verified_identity,
    memberSince: user.created_at.getUTCFullYear(),
    rating: user.rating_avg === null ? null : Number(user.rating_avg),
    ratingCount: user.rating_count,
    completedProjects: user.completed_count,
    skills: skills.map((s) => ({ name: s.name, slug: s.slug })),
    portfolio: portfolio.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      description: p.description,
      role: p.role,
      year: p.year,
      url: p.project_url,
      imageUrl: p.image_url,
    })),
    experience: experience.map((e) => ({
      company: e.company,
      role: e.role,
      startDate: e.start_date.toISOString().slice(0, 10),
      endDate: e.end_date ? e.end_date.toISOString().slice(0, 10) : null,
      description: e.description,
    })),
    reviews: reviewRows.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at.toISOString(),
    })),
    profileUrl: `/freelancers/${id}`,
  };
}

export async function getFreelancerPortfolio(id: string) {
  const instance = await db();
  const rows = await instance
    .selectFrom("portfolio_projects")
    .select(["id", "title", "summary", "description", "role", "year", "project_url", "image_url"])
    .where("freelancer_id", "=", id)
    .orderBy("sort_order", "asc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    role: row.role,
    year: row.year,
    url: row.project_url,
    imageUrl: row.image_url,
  }));
}

export interface ProjectSearchInput {
  q?: string;
  category?: string;
  skill?: string;
  budgetType?: "fixed" | "hourly";
  minBudgetMinor?: number;
  maxBudgetMinor?: number;
  experience?: "entry" | "intermediate" | "expert";
  page: number;
  perPage: number;
}

export async function searchProjects(input: ProjectSearchInput) {
  const instance = await db();
  let builder = instance
    .selectFrom("projects")
    .leftJoin("categories", "categories.id", "projects.category_id")
    .leftJoin("users", "users.id", "projects.client_id")
    .leftJoin("client_profiles", "client_profiles.user_id", "projects.client_id")
    .select([
      "projects.id",
      "projects.client_id",
      "projects.title",
      "projects.summary",
      "projects.description",
      "projects.category_id",
      "categories.name as category_name",
      "projects.cover_image_url",
      "projects.status",
      "projects.budget_type",
      "projects.budget_min_minor",
      "projects.budget_max_minor",
      "projects.currency",
      "projects.experience_level",
      "projects.duration_bucket",
      "projects.proposals_count",
      "projects.invited_only",
      "projects.published_at",
      "projects.deadline",
      "projects.close_reason",
      "projects.created_at",
      "projects.updated_at",
      "client_profiles.company_name as client_company_name",
    ])
    .where("projects.status", "=", "open");

  if (input.q) {
    const term = `%${input.q}%`;
    builder = builder.where((eb) =>
      eb.or([eb("projects.title", "ilike", term), eb("projects.summary", "ilike", term), eb("projects.description", "ilike", term)]),
    );
  }
  if (input.category) builder = builder.where("categories.slug", "=", input.category);
  if (input.skill) {
    builder = builder.where((eb) =>
      eb.exists(
        eb
          .selectFrom("project_skills")
          .innerJoin("skills", "skills.id", "project_skills.skill_id")
          .select("project_skills.project_id")
          .whereRef("project_skills.project_id", "=", "projects.id")
          .where("skills.name", "ilike", `%${input.skill}%`),
      ),
    );
  }
  if (input.budgetType) builder = builder.where("projects.budget_type", "=", input.budgetType);
  if (input.minBudgetMinor != null) builder = builder.where("projects.budget_max_minor", ">=", input.minBudgetMinor);
  if (input.maxBudgetMinor != null) builder = builder.where("projects.budget_min_minor", "<=", input.maxBudgetMinor);
  if (input.experience) builder = builder.where("projects.experience_level", "=", input.experience);

  const offset = (input.page - 1) * input.perPage;
  const [rows, totalRows] = await Promise.all([
    builder.orderBy("projects.published_at", "desc").limit(input.perPage).offset(offset).execute(),
    builder.clearSelect().clearLimit().clearOffset().select("projects.id").execute(),
  ]);

  const projects: ApiProject[] = rows.map((row) => toApiProject(row));
  const skillsByProject = new Map<string, string[]>();
  if (projects.length > 0) {
    const skillRows = await instance
      .selectFrom("project_skills")
      .innerJoin("skills", "skills.id", "project_skills.skill_id")
      .select(["project_skills.project_id", "skills.name"])
      .where("project_skills.project_id", "in", projects.map((p) => p.id))
      .execute();
    for (const row of skillRows) {
      const list = skillsByProject.get(row.project_id) ?? [];
      list.push(row.name);
      skillsByProject.set(row.project_id, list);
    }
  }
  return {
    page: input.page,
    perPage: input.perPage,
    total: totalRows.length,
    projects: projects.map((p) => ({ ...p, skills: skillsByProject.get(p.id) ?? [], projectUrl: `/project/${p.id}` })),
  };
}

/** Real skill-based recommendations from the freelancer's own skill rows. */
export async function recommendedProjects(freelancerId: string, limit: number) {
  const instance = await db();
  const skills = await instance
    .selectFrom("freelancer_skills")
    .innerJoin("skills", "skills.id", "freelancer_skills.skill_id")
    .select("skills.name")
    .where("freelancer_skills.freelancer_id", "=", freelancerId)
    .execute();
  if (skills.length === 0) return { projects: [], matchedSkills: [] as string[] };
  const names = skills.map((s) => s.name);
  const result = await searchProjects({ skill: names[0]!, page: 1, perPage: Math.min(limit, 50) });
  const matched = new Set(names.map((n) => n.toLowerCase()));
  return {
    matchedSkills: names.filter((name) =>
      result.projects.some((p) => p.skills.some((s) => s.toLowerCase() === name.toLowerCase())),
    ),
    projects: result.projects.filter((p) => p.skills.some((s) => matched.has(s.toLowerCase()))),
  };
}
