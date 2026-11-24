import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { verificationRequired } from "../config/env.js";

export interface AuthedUser {
  id: string;
  accountType: "freelancer" | "client" | "admin";
  verified: boolean;
  roles: string[];
  permissions: Set<string>;
}

/** Attach the authenticated user (with role/permission lookup) to the request. */
export async function authenticate(request: FastifyRequest): Promise<void> {
  const { auth } = await import("../modules/auth/auth.js");
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    return;
  }

  const db = await import("../database/connection.js").then((m) => m.db());
  const rows = await sql<{ account_type: "freelancer" | "client" | "admin"; verified: boolean; key: string }>`
    SELECT u.account_type, u.verified, COALESCE(r.key, '') AS key
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${session.user.id}
  `.execute(db);

  if (rows.rows.length === 0) {
    return;
  }

  const accountType = rows.rows[0]!.account_type;
  const roles = [...new Set(rows.rows.map((r) => r.key).filter((key) => key.length > 0))];
  const permissionRows =
    roles.length === 0
      ? []
      : (
          await sql<{ key: string }>`
            SELECT DISTINCT p.key
            FROM roles r
            JOIN role_permissions rp ON rp.role_id = r.id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE r.key IN ${sql`(${sql.join(roles)})`}
          `.execute(db)
        ).rows;

  request.currentUser = {
    id: session.user.id,
    accountType,
    verified: rows.rows[0]!.verified,
    roles,
    permissions: new Set(permissionRows.map((r) => r.key)),
  };
}

/** Terminates the request unless a user is attached. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  if (!request.currentUser) {
    return reply.status(401).send({
      success: false,
      message: "Authentication required",
      error: { code: "UNAUTHENTICATED", details: {} },
    });
  }
}

export function requireAccountType(...types: Array<AuthedUser["accountType"]>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const user = request.currentUser;
    if (!user || !types.includes(user.accountType)) {
      return reply.status(403).send({
        success: false,
        message: "You are not allowed to perform this action",
        error: { code: "FORBIDDEN", details: {} },
      });
    }
  };
}

/**
 * Terminates unless the signed-in user has completed identity verification.
 * Verification is temporarily disabled by default; in that mode this is a
 * no-op so missing Yoti/storage keys can never block posting or proposals.
 */
export async function requireVerified(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  if (!verificationRequired) {
    return;
  }
  if (!request.currentUser?.verified) {
    return reply.status(403).send({
      success: false,
      message: "Identity verification is required for this action",
      error: { code: "VERIFICATION_REQUIRED", details: {} },
    });
  }
}

/** Terminates unless the request carries one of the given admin permissions. */
export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const user = request.currentUser;
    const hasPermission = user && (user.accountType === "admin" && permissions.some((p) => user.permissions.has(p)));
    if (!hasPermission) {
      return reply.status(403).send({
        success: false,
        message: "You are not allowed to perform this action",
        error: { code: "FORBIDDEN", details: {} },
      });
    }
  };
}
