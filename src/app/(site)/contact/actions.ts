"use server";

/**
 * Contact form server action.
 *
 * Validates the submission, then delivers it to the support inbox via the
 * Resend HTTP API when RESEND_API_KEY is set. Without a key (or on any
 * delivery failure) it logs via console.error and returns { ok: false } so
 * the UI can show an honest error toast instead of pretending it sent.
 */

const SUPPORT_EMAIL = "hello@workora.com";
// Resend's shared sandbox sender; override with RESEND_FROM once a domain is verified.
const FROM_ADDRESS = process.env.RESEND_FROM ?? "Workora <onboarding@resend.dev>";
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
 const API = process.env.API_URL ?? "http://localhost:3010";
 try {
  const response = await fetch(`${API}/api/auth/request-password-reset`, {
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
 if (message.length < 20 || message.length > 4000) return { ok: false };

 // Strip CR/LF so user input cannot inject extra headers into the subject line.
 const subject = `[Contact] ${topic || "other"} - ${name}`.replace(/[\r\n]+/g, " ").slice(0, 200);
 const text = `Name: ${name}\nEmail: ${email}\nTopic: ${topic || "other"}\n\n${message}`;
 const html = `<p><strong>Name:</strong> ${escapeHtml(name)}<br/><strong>Email:</strong> ${escapeHtml(email)}<br/><strong>Topic:</strong> ${escapeHtml(topic || "other")}</p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;

 const delivered = await sendEmail({
  to: SUPPORT_EMAIL,
  replyTo: email,
  subject,
  text,
  html,
 });
 return { ok: delivered };
}

async function sendEmail(params: {
 to: string;
 replyTo: string;
 subject: string;
 text: string;
 html: string;
}): Promise<boolean> {
 const apiKey = process.env.RESEND_API_KEY;
 if (!apiKey) {
  console.error(
   `[contact] RESEND_API_KEY is not set; message to ${params.to} was not delivered.`,
   params,
  );
  return false;
 }
 try {
  const response = await fetch("https://api.resend.com/emails", {
   method: "POST",
   headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
   },
   body: JSON.stringify({
    from: FROM_ADDRESS,
    to: [params.to],
    reply_to: params.replyTo,
    subject: params.subject,
    text: params.text,
    html: params.html,
   }),
   cache: "no-store",
  });
  if (!response.ok) {
   console.error(`[contact] Resend responded with HTTP ${response.status}:`, await response.text());
   return false;
  }
  return true;
 } catch (error) {
  console.error("[contact] Could not reach the email provider:", error);
  return false;
 }
}

function escapeHtml(value: string): string {
 return value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
}
