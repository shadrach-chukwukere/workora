import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodType } from "zod";
import { ok } from "../common/index.js";
import { db } from "../../database/connection.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  authenticateBeginSchema,
  authenticateFinishSchema,
  passkeyIdParamSchema,
  registerFinishSchema,
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

function webAuthnFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : "Passkey request failed";
  throw new AppError(400, "BAD_REQUEST", message);
}

const passkeyLimits = { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } };

/** Passkey registration/authentication. All challenges are issued and verified server-side. */
export default async function passkeysRoutes(app: FastifyInstance) {
  /** GET /api/v1/passkeys — passkeys registered by the signed-in user. */
  app.get("/passkeys", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    reply.send(ok({ passkeys: await service.listPasskeys(user.id) }));
  });

  /** DELETE /api/v1/passkeys/:id — remove one of your passkeys. */
  app.delete("/passkeys/:id", async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const { id } = parse(passkeyIdParamSchema, request.params);
    const removed = await service.removePasskey(user.id, id);
    if (!removed) {
      reply.status(404).send({ success: false, message: "Passkey not found", error: { code: "NOT_FOUND", details: {} } });
      return;
    }
    reply.send(ok(null, "Passkey removed"));
  });

  /** POST /api/v1/passkeys/register/begin — issue a registration challenge. */
  app.post("/passkeys/register/begin", passkeyLimits, async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    try {
      reply.send(ok(await service.beginRegistration(user.id)));
    } catch (error) {
      webAuthnFailure(error);
    }
  });

  /** POST /api/v1/passkeys/register/finish — verify and store the new credential. */
  app.post("/passkeys/register/finish", passkeyLimits, async (request, reply) => {
    const user = request.currentUser;
    if (!user) {
      reply.status(401).send({ success: false, message: "Authentication required", error: { code: "UNAUTHENTICATED", details: {} } });
      return;
    }
    const input = parse(registerFinishSchema, request.body);
    try {
      reply.send(ok({ passkey: await service.finishRegistration({ id: user.id }, input.token, input.credential) }, "Passkey added"));
    } catch (error) {
      webAuthnFailure(error);
    }
  });

  /** POST /api/v1/passkeys/authenticate/begin — issue a login challenge. */
  app.post("/passkeys/authenticate/begin", passkeyLimits, async (request, reply) => {
    const input = parse(authenticateBeginSchema, request.body);
    try {
      reply.send(ok(await service.beginAuthentication(input.email)));
    } catch (error) {
      webAuthnFailure(error);
    }
  });

  /** POST /api/v1/passkeys/authenticate/finish — verify assertion and sign in. */
  app.post("/passkeys/authenticate/finish", passkeyLimits, async (request, reply) => {
    const input = parse(authenticateFinishSchema, request.body);
    let result: service.AuthenticationResult;
    try {
      result = await service.finishAuthentication(input.token, input.credential);
    } catch (error) {
      webAuthnFailure(error);
    }
    appendSessionCookie(reply, result.cookie);
    const userRow = await (await db())
      .selectFrom("users")
      .select(["id", "name", "email", "account_type", "image"])
      .where("id", "=", result.userId)
      .executeTakeFirst();
    if (!userRow) throw new AppError(401, "UNAUTHENTICATED", "Account not found");
    reply.send(ok({ user: {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      accountType: userRow.account_type,
      image: userRow.image,
    } }, "Signed in with passkey"));
  });
}

function appendSessionCookie(reply: FastifyReply, cookie: string): void {
  const existing = reply.getHeader("set-cookie");
  const cookies = Array.isArray(existing)
    ? [...existing, cookie]
    : existing
      ? [String(existing), cookie]
      : [cookie];
  reply.header("set-cookie", cookies);
}
