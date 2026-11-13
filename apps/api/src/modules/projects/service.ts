import type { Kysely } from "kysely";
import type { DB } from "../../database/types.js";
import type { AuthedUser } from "../../middleware/authenticate.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../plugins/error-handler.js";
import * as repo from "./repository.js";
import type { ListProjectsQuery, ListProposalsQuery, ProjectBody } from "./schemas.js";

type Db = Kysely<DB>;

function assertOwnership(project: { clientId: string }, user: AuthedUser): void {
  if (project.clientId !== user.id) {
    throw forbidden("You can only manage your own projects");
  }
}

function assertOwnerOrAdmin(project: { clientId: string }, user: AuthedUser): void {
  if (user.accountType !== "admin" && project.clientId !== user.id) {
    throw forbidden("You are not allowed to perform this action");
  }
}

async function checkCategory(db: Db, categoryId: string | undefined): Promise<void> {
  if (!categoryId) return;
  const exists = await repo.categoryExists(db, categoryId);
  if (!exists) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: [{ path: "categoryId", message: "Category not found" }],
    });
  }
}

export async function createProject(db: Db, user: AuthedUser, input: ProjectBody) {
  await checkCategory(db, input.categoryId);
  const id = await repo.insertProject(db, user.id, input, "open");
  const project = await repo.findProjectById(db, id);
  if (!project) {
    throw new AppError(500, "INTERNAL_ERROR", "Project was created but could not be loaded", {});
  }
  return project;
}

export async function updateProject(db: Db, user: AuthedUser, id: string, input: ProjectBody) {
  const existing = await repo.findProjectById(db, id);
  if (!existing) {
    throw notFound("Project not found");
  }
  assertOwnership(existing, user);
  if (existing.status !== "draft" && existing.status !== "open") {
    throw conflict("Project can only be edited while it is in draft or open status", { status: existing.status });
  }

  // Validate the merged budget range against what is stored, not only what is being sent.
  const mergedMin = input.budgetMinMinor ?? existing.budgetMinMinor;
  const mergedMax = input.budgetMaxMinor ?? existing.budgetMaxMinor;
  if (mergedMin !== null && mergedMin !== undefined && mergedMax !== null && mergedMax !== undefined && mergedMax < mergedMin) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: [{ path: "budgetMaxMinor", message: "budgetMaxMinor must be greater than or equal to budgetMinMinor" }],
    });
  }

  await checkCategory(db, input.categoryId);
  await repo.updateProject(db, id, input);
  const project = await repo.findProjectById(db, id);
  return project;
}

export async function publishProject(db: Db, user: AuthedUser, id: string) {
  const existing = await repo.findProjectById(db, id);
  if (!existing) {
    throw notFound("Project not found");
  }
  assertOwnership(existing, user);
  if (existing.status === "open") {
    throw conflict("Project is already published");
  }
  if (existing.status !== "draft") {
    throw conflict("Only draft projects can be published", { status: existing.status });
  }
  if (existing.title.trim().length < 5 || existing.description.trim().length < 1) {
    throw badRequest("Project must have a title and a description before it can be published", {
      issues: [
        ...(existing.title.trim().length >= 5 ? [] : [{ path: "title", message: "Title is required" }]),
        ...(existing.description.trim().length >= 1 ? [] : [{ path: "description", message: "Description is required" }]),
      ],
    });
  }
  await repo.updateProjectStatus(db, id, "open", { publishedAt: new Date() });
  return repo.findProjectById(db, id);
}

export async function closeProject(db: Db, user: AuthedUser, id: string, reason?: string) {
  const existing = await repo.findProjectById(db, id);
  if (!existing) {
    throw notFound("Project not found");
  }
  assertOwnerOrAdmin(existing, user);
  if (existing.status !== "open") {
    throw conflict("Only open projects can be closed", { status: existing.status });
  }
  const trimmedReason = reason?.trim();
  if (trimmedReason) {
    await repo.updateProjectStatus(db, id, "cancelled", { closeReason: trimmedReason });
  } else {
    await repo.updateProjectStatus(db, id, "completed", { closeReason: null });
  }
  return repo.findProjectById(db, id);
}

export async function listProjects(db: Db, filters: ListProjectsQuery) {
  const { rows, total } = await repo.listProjects(db, filters);
  return { projects: rows, page: filters.page, perPage: filters.perPage, total };
}

export async function getProjectById(db: Db, id: string, user: AuthedUser | undefined) {
  const project = await repo.findProjectById(db, id);
  if (!project) {
    throw notFound("Project not found");
  }
  // Drafts and flagged projects are private to their owner and admins.
  if (
    (project.status === "draft" || project.status === "flagged") &&
    !(user && (user.id === project.clientId || user.accountType === "admin"))
  ) {
    throw notFound("Project not found");
  }
  const [client, skills] = await Promise.all([
    repo.getClientSummary(db, project.clientId),
    repo.getProjectSkills(db, project.id),
  ]);
  return { ...project, client, skills };
}

export async function saveProject(db: Db, user: AuthedUser, id: string): Promise<void> {
  const existing = await repo.findProjectById(db, id);
  if (!existing) {
    throw notFound("Project not found");
  }
  await repo.saveProject(db, user.id, id);
}

export async function unsaveProject(db: Db, user: AuthedUser, id: string): Promise<void> {
  const existing = await repo.findProjectById(db, id);
  if (!existing) {
    throw notFound("Project not found");
  }
  await repo.unsaveProject(db, user.id, id);
}

export async function listSavedProjects(db: Db, user: AuthedUser, page: number, perPage: number) {
  const { rows, total } = await repo.listSavedProjects(db, user.id, page, perPage);
  return { projects: rows, page, perPage, total };
}

export async function listProjectProposals(db: Db, user: AuthedUser, projectId: string, filters: ListProposalsQuery) {
  const existing = await repo.findProjectRaw(db, projectId);
  if (!existing) {
    throw notFound("Project not found");
  }
  assertOwnerOrAdmin({ clientId: existing.client_id }, user);
  const { rows, total } = await repo.listProposalsForProject(db, projectId, filters);
  return { proposals: rows, page: filters.page, perPage: filters.perPage, total };
}

export async function replaceProjectSkills(db: Db, user: AuthedUser, projectId: string, skillIds: string[]) {
  const existing = await repo.findProjectRaw(db, projectId);
  if (!existing) {
    throw notFound("Project not found");
  }
  if (existing.client_id !== user.id) {
    throw forbidden("You can only manage skills for your own projects");
  }
  if (existing.status !== "draft" && existing.status !== "open") {
    throw conflict("Skills can only be changed while the project is in draft or open status", {
      status: existing.status,
    });
  }

  const uniqueIds = [...new Set(skillIds)];
  const found = await repo.existingSkillIds(db, uniqueIds);
  if (found.length !== uniqueIds.length) {
    const foundSet = new Set(found);
    const missing = uniqueIds.filter((skillId) => !foundSet.has(skillId));
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: [{ path: "skillIds", message: `Unknown skill ids: ${missing.join(", ")}` }],
    });
  }

  await repo.replaceProjectSkills(db, projectId, uniqueIds);
  const skills = await repo.getProjectSkills(db, projectId);
  return skills;
}
