import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

/**
 * Short-lived, HMAC-signed confirmation tokens for consequential MCP writes.
 * The first tool call returns a preview plus a token; nothing is written.
 * The second call must present the token, which is bound to the user, action
 * and exact parameters, so an AI assistant cannot silently change the action.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000;

interface ConfirmationPayload {
  kind: string;
  userId: string;
  params: Record<string, unknown>;
  expiresAt: number;
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function issueConfirmation(kind: string, userId: string, params: Record<string, unknown>): string {
  const payload: ConfirmationPayload = {
    kind,
    userId,
    params,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyConfirmation<T extends Record<string, unknown>>(
  token: string | undefined,
  kind: string,
  userId: string,
  params: T,
): boolean {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConfirmationPayload;
    if (payload.kind !== kind || payload.userId !== userId || payload.expiresAt < Date.now()) return false;
    return JSON.stringify(payload.params) === JSON.stringify(params);
  } catch {
    return false;
  }
}

export function confirmationRequired(kind: string, userId: string, params: Record<string, unknown>, preview: unknown) {
  return {
    success: false,
    requiresConfirmation: true,
    message: "Review the preview, then repeat the call with the confirmation token to perform this action.",
    confirmationToken: issueConfirmation(kind, userId, params),
    preview,
  };
}
