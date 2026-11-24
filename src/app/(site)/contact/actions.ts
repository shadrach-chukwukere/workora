"use server";

/**
 * Contact form server actions.
 *
 * Contact messages are persisted by the API so admins can review them even
 * when email delivery is not configured. Password reset stays on Better Auth.
 */

import { serverApiBase } from "@/lib/api-base";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactResult {
  ok: boolean;
}

export interface PasswordResetResult {
  ok: boolean;
  message: string;
}

/**
 * Server action: asks the API to email a password reset link.
 * Note: docs/api-contract.md lists POST /api/auth/forget-password, but the
 * installed better-auth exposes POST /api/auth/request-password-reset
 * (forget-password returns 404). The endpoint takes a JSON body { email }.
 * Lives here because client components may only import server actions from a
 * "use server" module.
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  try {
    const response = await fetch(`${serverApiBase}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
      cache: "no-store",
    });
   let message = response.ok ? "Check your inbox." : "Could not send the reset link.";
   try {
    const body = (await response.json()) as { message?: string } | null;
    if (body && typeof body.message === "string" && body.message.length > 0) {
     message = body.message;
    }
   } catch {
    // keep the default message
   }
   return { ok: response.ok, message };
  } catch {
   return { ok: false, message: "Could not reach the server. Please try again." };
  }
}

export async function sendContactMessage(input: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): Promise<ContactResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const topic = (input.topic ?? "").trim();
  const message = (input.message ?? "").trim();

  if (name.length < 2 || name.length > 120) return { ok: false };
  if (!EMAIL_RE.test(email)) return { ok: false };
  if (!topic) return { ok: false };
  if (message.length < 20 || message.length > 4000) return { ok: false };

  try {
    const response = await fetch(`${serverApiBase}/api/v1/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, topic, message }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return { ok: response.ok && body?.success === true };
  } catch {
    return { ok: false };
  }
}
