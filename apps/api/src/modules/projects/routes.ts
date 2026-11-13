import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { ok, requireAccountType, requireAuth } from "../common/index.js";
import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  closeProjectBodySchema,
  idParamSchema,
  listProjectsQuerySchema,
  listProposalsQuerySchema,
  paginationQuerySchema,
  projectBodySchema,
  projectSkillsBodySchema,
} from "./schemas.js";
import * as service from "./service.js";

function parse<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return result.data;
}

function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid route parameters", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return result.data;
}

export default async function projectsRoutes(app: FastifyInstance) {
  /** POST /api/v1/projects — create a draft project (client only). */
  app.post("/projects", { preHandler: [requireAuth, requireAccountType("client")] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parse(projectBodySchema, request.body);
    const project = await service.createProject(await db(), request.currentUser!, input);
    reply.send(ok({ project }, "Project created"));
  });

  /** GET /api/v1/projects — public, paginated marketplace listing. */
  app.get("/projects", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parse(listProjectsQuerySchema, request.query);
    const result = await service.listProjects(await db(), query);
    reply.send(ok(result));
  });

  /** GET /api/v1/projects/:id — public detail; drafts/flagged visible to owner/admin only. */
  app.get("/projects/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const project = await service.getProjectById(await db(), id, request.currentUser);
    reply.send(ok({ project }));
  });

  /** PUT /api/v1/projects/:id — replace a project (own client only, draft/open only). */
  app.put("/projects/:id", { preHandler: [requireAuth, requireAccountType("client")] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const input = parse(projectBodySchema, request.body);
    const project = await service.updateProject(await db(), request.currentUser!, id, input);
    reply.send(ok({ project }, "Project updated"));
  });

  /** POST /api/v1/projects/:id/publish — draft -> open (own client only). */
  app.post("/projects/:id/publish", { preHandler: [requireAuth, requireAccountType("client")] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const project = await service.publishProject(await db(), request.currentUser!, id);
    reply.send(ok({ project }, "Project published"));
  });

  /** POST /api/v1/projects/:id/close — open -> completed (or cancelled with { reason }) (own client or admin). */
  app.post("/projects/:id/close", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const body = parse(closeProjectBodySchema, request.body ?? {});
    const project = await service.closeProject(await db(), request.currentUser!, id, body.reason);
    reply.send(ok({ project }, body.reason ? "Project cancelled" : "Project completed"));
  });

  /** POST /api/v1/projects/:id/save — save a project for the current user. */
  app.post("/projects/:id/save", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    await service.saveProject(await db(), request.currentUser!, id);
    reply.send(ok({ saved: true }, "Project saved"));
  });

  /** DELETE /api/v1/projects/:id/save — remove a project from the current user's saved list. */
  app.delete("/projects/:id/save", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    await service.unsaveProject(await db(), request.currentUser!, id);
    reply.send(ok({ saved: false }, "Project removed from saved"));
  });

  /** POST /api/v1/projects/:id/skills — replace the project's skill set (own client only, draft/open). */
  app.post("/projects/:id/skills", { preHandler: [requireAuth, requireAccountType("client")] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const { skillIds } = parse(projectSkillsBodySchema, request.body);
    const skills = await service.replaceProjectSkills(await db(), request.currentUser!, id, skillIds);
    reply.send(ok({ skills }, "Project skills updated"));
  });

  /** GET /api/v1/projects/:id/proposals — proposals for a project (own client or admin). */
  app.get("/projects/:id/proposals", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(idParamSchema, request.params);
    const query = parse(listProposalsQuerySchema, request.query);
    const result = await service.listProjectProposals(await db(), request.currentUser!, id, query);
    reply.send(ok(result));
  });

  /** GET /api/v1/users/me/saved-projects — paginated list of the current user's saved projects. */
  app.get("/users/me/saved-projects", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, perPage } = parse(paginationQuerySchema, request.query);
    const result = await service.listSavedProjects(await db(), request.currentUser!, page, perPage);
    reply.send(ok(result));
  });
}
