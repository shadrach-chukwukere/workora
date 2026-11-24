"use server";

/**
 * Contact form server actions.
 *
 * Contact messages are persisted by the API so admins can review them even
 * when email delivery is not configured. Password reset stays on Better Auth.
 */

import { serverApiBase } from "@/lib/api-base";

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

// Contact submissions are handled client-side via the same-origin /api/v1/contact
// rewrite. That keeps the public form independent of server-action serialization
// and lets the UI show the API's real validation message.
