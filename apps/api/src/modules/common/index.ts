import type { FastifyInstance } from "fastify";
import { requireAuth, requireAccountType, requirePermission, type AuthedUser } from "../../middleware/authenticate.js";
import type { AppError } from "../../plugins/error-handler.js";
import { ok } from "../../utils/response.js";

export { requireAccountType, requireAuth, requirePermission, ok };
export type { AuthedUser };

export interface ModuleContext {
  app: FastifyInstance;
  db: import("../../database/types.js").DB;
  dbPool: import("kysely").Kysely<import("../../database/types.js").DB>;
}

export function parsePage(query: { page?: string; perPage?: string; limit?: string }): { limit: number; offset: number; page: number } {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(query.perPage ?? query.limit ?? "20", 10) || 20));
  return { limit: perPage, offset: (page - 1) * perPage, page };
}

export function safeUser<T extends Record<string, unknown>>(user: T): Omit<T, "password" | "failed_logins" | "locked_until"> {
  const { password: _p, failed_logins: _f, locked_until: _l, ...rest } = user;
  return rest as Omit<T, "password" | "failed_logins" | "locked_until">;
}
