import { sql, type Kysely, type RawBuilder, type SqlBool } from "kysely";
import type { DB } from "../../database/types.js";
import type { ListProjectsQuery, ListProposalsQuery, ProjectBody } from "./schemas.js";

type Db = Kysely<DB>;

/* -------------------------------------------------------------------------- */
/* API mappers (snake_case DB <-> camelCase API)                               */
/* -------------------------------------------------------------------------- */

export interface ApiProject {
  id: string;
  clientId: string;
  title: string;
  summary: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  budgetType: string;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  currency: string;
  experienceLevel: string | null;
  durationBucket: string | null;
  proposalsCount: number;
  invitedOnly: boolean;
  publishedAt: string | null;
  deadline: string | null;
  closeReason: string | null;
  clientCompanyName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JoinedProjectRow {
  id: string;
  client_id: string;
  title: string;
  summary: string;
  description: string;
  category_id: string | null;
  status: string;
  budget_type: string;
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: string;
  experience_level: string | null;
  duration_bucket: string | null;
  proposals_count: number;
  invited_only: boolean;
  published_at: Date | string | null;
  deadline: Date | string | null;
  close_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  client_company_name?: string | null;
  category_name?: string | null;
  saved_at?: Date | string;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toNullableNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toApiProject(row: JoinedProjectRow): ApiProject {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    status: row.status,
    budgetType: row.budget_type,
    budgetMinMinor: row.budget_min_minor,
    budgetMaxMinor: row.budget_max_minor,
    currency: row.currency,
    experienceLevel: row.experience_level,
    durationBucket: row.duration_bucket,
    proposalsCount: row.proposals_count,
    invitedOnly: row.invited_only,
    publishedAt: toIso(row.published_at),
    deadline: toDateOnly(row.deadline),
    closeReason: row.close_reason,
    clientCompanyName: row.client_company_name ?? null,
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  };
}

/** camelCase insert/update payloads -> snake_case columns. */
export function toDbProjectInput(input: ProjectBody): Record<string, unknown> {
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    category_id: input.categoryId ?? null,
    budget_type: input.budgetType,
    budget_min_minor: input.budgetMinMinor ?? null,
    budget_max_minor: input.budgetMaxMinor ?? null,
    experience_level: input.experienceLevel ?? null,
    duration_bucket: input.durationBucket ?? null,
    deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null,
    invited_only: input.invitedOnly ?? false,
  };
}

/* -------------------------------------------------------------------------- */
/* Shared select fragments                                                     */
/* -------------------------------------------------------------------------- */

function joinedSelect(eb: any): any[] {
  return [
    eb.ref("p.id").as("id"),
    eb.ref("p.client_id").as("client_id"),
    eb.ref("p.title").as("title"),
    eb.ref("p.summary").as("summary"),
    eb.ref("p.description").as("description"),
    eb.ref("p.category_id").as("category_id"),
    eb.ref("p.status").as("status"),
    eb.ref("p.budget_type").as("budget_type"),
    eb.ref("p.budget_min_minor").as("budget_min_minor"),
    eb.ref("p.budget_max_minor").as("budget_max_minor"),
    eb.ref("p.currency").as("currency"),
    eb.ref("p.experience_level").as("experience_level"),
    eb.ref("p.duration_bucket").as("duration_bucket"),
    eb.ref("p.proposals_count").as("proposals_count"),
    eb.ref("p.invited_only").as("invited_only"),
    eb.ref("p.published_at").as("published_at"),
    eb.ref("p.deadline").as("deadline"),
    eb.ref("p.close_reason").as("close_reason"),
    eb.ref("p.created_at").as("created_at"),
    eb.ref("p.updated_at").as("updated_at"),
    eb.ref("cp.company_name").as("client_company_name"),
    eb.ref("c.name").as("category_name"),
  ];
}

function escapeIlike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function filterFragments(filters: ListProjectsQuery): RawBuilder<SqlBool>[] {
  const fragments: RawBuilder<SqlBool>[] = [sql<SqlBool>`p.status = ${filters.status}`];
  if (filters.q) {
    const pattern = `%${escapeIlike(filters.q)}%`;
    fragments.push(
      sql<SqlBool>`(p.title ilike ${pattern} escape '\\' or p.summary ilike ${pattern} escape '\\' or p.description ilike ${pattern} escape '\\')`,
    );
  }
  if (filters.categoryId) {
    fragments.push(sql<SqlBool>`p.category_id = ${filters.categoryId}`);
  }
  if (filters.budgetType) {
    fragments.push(sql<SqlBool>`p.budget_type = ${filters.budgetType}`);
  }
  if (filters.experienceLevel) {
    fragments.push(sql<SqlBool>`p.experience_level = ${filters.experienceLevel}`);
  }
  return fragments;
}

function combinedWhere(fragments: RawBuilder<SqlBool>[]): RawBuilder<SqlBool> {
  return sql<SqlBool>`(${sql.join(fragments, sql` and `)})`;
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

export async function insertProject(db: Db, clientId: string, input: ProjectBody, status: "draft" | "open" = "draft") {
  const values = toDbProjectInput(input);
  const row = await db
    .insertInto("projects")
    .values({ ...values, client_id: clientId, status } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function updateProject(db: Db, id: string, input: ProjectBody): Promise<void> {
  const values = toDbProjectInput(input);
  await db
    .updateTable("projects")
    .set(values as never)
    .where("id", "=", id)
    .execute();
}

export async function updateProjectStatus(
  db: Db,
  id: string,
  status: "open" | "completed" | "cancelled",
  extra: { publishedAt?: Date; closeReason?: string | null } = {},
): Promise<void> {
  const set: Record<string, unknown> = { status };
  if (extra.publishedAt !== undefined) {
    set.published_at = extra.publishedAt;
  }
  if (extra.closeReason !== undefined) {
    set.close_reason = extra.closeReason;
  }
  await db
    .updateTable("projects")
    .set(set as never)
    .where("id", "=", id)
    .execute();
}

export async function findProjectById(db: Db, id: string): Promise<ApiProject | null> {
  const row = await db
    .selectFrom("projects as p")
    .leftJoin("client_profiles as cp", "cp.user_id", "p.client_id")
    .leftJoin("categories as c", "c.id", "p.category_id")
    .select((eb) => joinedSelect(eb))
    .where("p.id", "=", id)
    .executeTakeFirst();
  return row ? toApiProject(row as unknown as JoinedProjectRow) : null;
}

export async function findProjectRaw(db: Db, id: string) {
  return db.selectFrom("projects").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function listProjects(
  db: Db,
  filters: ListProjectsQuery,
): Promise<{ rows: ApiProject[]; total: number }> {
  const fragments = filterFragments(filters);
  const where = combinedWhere(fragments);

  const base = db
    .selectFrom("projects as p")
    .leftJoin("client_profiles as cp", "cp.user_id", "p.client_id")
    .leftJoin("categories as c", "c.id", "p.category_id")
    .where(where);

  const totalRow = await db
    .selectFrom("projects as p")
    .select(sql<number>`count(*)`.as("total"))
    .where(where)
    .executeTakeFirstOrThrow();

  let ordered = base.select((eb) => joinedSelect(eb));
  switch (filters.sort) {
    case "budget_desc":
      ordered = ordered.orderBy(sql`coalesce(p.budget_max_minor, p.budget_min_minor) desc nulls last`);
      break;
    case "budget_asc":
      ordered = ordered.orderBy(sql`coalesce(p.budget_max_minor, p.budget_min_minor) asc nulls last`);
      break;
    case "fewest_proposals":
      ordered = ordered.orderBy("p.proposals_count", "asc");
      break;
    case "newest":
    default:
      ordered = ordered.orderBy(sql`coalesce(p.published_at, p.created_at) desc nulls last`);
      break;
  }

  const rows = await ordered.orderBy("p.created_at", "desc").limit(filters.perPage).offset((filters.page - 1) * filters.perPage).execute();

  return { rows: rows.map((row) => toApiProject(row as unknown as JoinedProjectRow)), total: Number(totalRow.total) };
}

export async function categoryExists(db: Db, categoryId: string): Promise<boolean> {
  const row = await db.selectFrom("categories").select("id").where("id", "=", categoryId).executeTakeFirst();
  return row !== undefined;
}

/* -------------------------------------------------------------------------- */
/* Client summary + skills (project detail)                                    */
/* -------------------------------------------------------------------------- */

export interface ApiClientSummary {
  id: string;
  name: string;
  image: string | null;
  companyName: string | null;
  companySize: string | null;
  industry: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  projectsCount: number;
  memberSince: string;
}

export async function getClientSummary(db: Db, clientId: string): Promise<ApiClientSummary | null> {
  const row = await db
    .selectFrom("users as u")
    .leftJoin("client_profiles as cp", "cp.user_id", "u.id")
    .select([
      "u.id as id",
      "u.name as name",
      "u.image as image",
      "u.created_at as created_at",
      "cp.company_name as company_name",
      "cp.company_size as company_size",
      "cp.industry as industry",
      "cp.rating_avg as rating_avg",
      "cp.rating_count as rating_count",
      "cp.projects_count as projects_count",
    ])
    .where("u.id", "=", clientId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    companyName: row.company_name ?? null,
    companySize: row.company_size ?? null,
    industry: row.industry ?? null,
    ratingAvg: toNullableNumber(row.rating_avg as string | number | null),
    ratingCount: row.rating_count ?? 0,
    projectsCount: row.projects_count ?? 0,
    memberSince: toIsoRequired(row.created_at as Date | string),
  };
}

export interface ApiProjectSkill {
  id: string;
  slug: string;
  name: string;
  position: number;
}

export async function getProjectSkills(db: Db, projectId: string): Promise<ApiProjectSkill[]> {
  const rows = await db
    .selectFrom("project_skills as ps")
    .innerJoin("skills as s", "s.id", "ps.skill_id")
    .select(["s.id as id", "s.slug as slug", "s.name as name", "ps.position as position"])
    .where("ps.project_id", "=", projectId)
    .orderBy("ps.position", "asc")
    .execute();
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, position: row.position }));
}

export async function existingSkillIds(db: Db, skillIds: string[]): Promise<string[]> {
  if (skillIds.length === 0) return [];
  const rows = await db.selectFrom("skills").select("id").where("id", "in", skillIds).execute();
  return rows.map((row) => row.id);
}

export async function replaceProjectSkills(db: Db, projectId: string, skillIds: string[]): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("project_skills").where("project_id", "=", projectId).execute();
    if (skillIds.length > 0) {
      await trx
        .insertInto("project_skills")
        .values(skillIds.map((skill_id, index) => ({ project_id: projectId, skill_id, position: index })))
        .execute();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Saved projects                                                              */
/* -------------------------------------------------------------------------- */

export async function saveProject(db: Db, userId: string, projectId: string): Promise<void> {
  await db
    .insertInto("saved_projects")
    .values({ user_id: userId, project_id: projectId })
    .onConflict((oc) => oc.columns(["user_id", "project_id"]).doNothing())
    .execute();
}

export async function unsaveProject(db: Db, userId: string, projectId: string): Promise<void> {
  await db.deleteFrom("saved_projects").where("user_id", "=", userId).where("project_id", "=", projectId).execute();
}

export async function listSavedProjects(
  db: Db,
  userId: string,
  page: number,
  perPage: number,
): Promise<{ rows: Array<ApiProject & { savedAt: string }>; total: number }> {
  const totalRow = await db
    .selectFrom("saved_projects as sp")
    .select(sql<number>`count(*)`.as("total"))
    .where("sp.user_id", "=", userId)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom("saved_projects as sp")
    .innerJoin("projects as p", "p.id", "sp.project_id")
    .leftJoin("client_profiles as cp", "cp.user_id", "p.client_id")
    .leftJoin("categories as c", "c.id", "p.category_id")
    .select((eb) => [...joinedSelect(eb), eb.ref("sp.created_at").as("saved_at")])
    .where("sp.user_id", "=", userId)
    .orderBy("sp.created_at", "desc")
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  return {
    rows: rows.map((row) => ({
      ...toApiProject(row as unknown as JoinedProjectRow),
      savedAt: toIsoRequired((row as unknown as JoinedProjectRow).saved_at as Date | string),
    })),
    total: Number(totalRow.total),
  };
}

/* -------------------------------------------------------------------------- */
/* Proposals                                                                   */
/* -------------------------------------------------------------------------- */

export interface ApiProposal {
  id: string;
  projectId: string;
  freelancerId: string;
  coverLetter: string;
  bidType: string;
  bidAmountMinor: number;
  durationDays: number | null;
  status: string;
  submittedAt: string;
  updatedAt: string;
  freelancer: {
    name: string;
    image: string | null;
    headline: string | null;
    hourlyRateMinor: number | null;
    completedCount: number;
    ratingAvg: number | null;
  };
}

export async function listProposalsForProject(
  db: Db,
  projectId: string,
  filters: ListProposalsQuery,
): Promise<{ rows: ApiProposal[]; total: number }> {
  let where = sql<SqlBool>`pr.project_id = ${projectId}`;
  if (filters.status) {
    where = sql<SqlBool>`${where} and pr.status = ${filters.status}`;
  }

  const totalRow = await db
    .selectFrom("proposals as pr")
    .select(sql<number>`count(*)`.as("total"))
    .where(where)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom("proposals as pr")
    .innerJoin("users as u", "u.id", "pr.freelancer_id")
    .leftJoin("freelancer_profiles as fp", "fp.user_id", "pr.freelancer_id")
    .select([
      "pr.id as id",
      "pr.project_id as project_id",
      "pr.freelancer_id as freelancer_id",
      "pr.cover_letter as cover_letter",
      "pr.bid_type as bid_type",
      "pr.bid_amount_minor as bid_amount_minor",
      "pr.duration_days as duration_days",
      "pr.status as status",
      "pr.submitted_at as submitted_at",
      "pr.updated_at as updated_at",
      "u.name as freelancer_name",
      "u.image as freelancer_image",
      "fp.headline as freelancer_headline",
      "fp.hourly_rate_minor as freelancer_hourly_rate_minor",
      "fp.completed_count as freelancer_completed_count",
      "fp.rating_avg as freelancer_rating_avg",
    ])
    .where(where)
    .orderBy("pr.submitted_at", "desc")
    .limit(filters.perPage)
    .offset((filters.page - 1) * filters.perPage)
    .execute();

  return {
    rows: rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      freelancerId: row.freelancer_id,
      coverLetter: row.cover_letter,
      bidType: row.bid_type,
      bidAmountMinor: row.bid_amount_minor,
      durationDays: row.duration_days,
      status: row.status,
      submittedAt: toIsoRequired(row.submitted_at as Date | string),
      updatedAt: toIsoRequired(row.updated_at as Date | string),
      freelancer: {
        name: row.freelancer_name,
        image: row.freelancer_image,
        headline: row.freelancer_headline ?? null,
        hourlyRateMinor: row.freelancer_hourly_rate_minor ?? null,
        completedCount: row.freelancer_completed_count ?? 0,
        ratingAvg: toNullableNumber(row.freelancer_rating_avg as string | number | null),
      },
    })),
    total: Number(totalRow.total),
  };
}
