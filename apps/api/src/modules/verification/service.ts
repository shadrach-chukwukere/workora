import { AppError, conflict, notFound } from "../../plugins/error-handler.js";
import { sendEmail } from "../../services/email.js";
import type { Kysely } from "kysely";
import type { DB } from "../../database/types.js";
import * as repo from "./repository.js";

/**
 * VERIFICATION (KYC).
 * Request lifecycle: pending → info_requested → approved | rejected.
 * Admin decisions are emailed to the applicant via the platform email service
 * (logged to the server console in development when RESEND_API_KEY is unset).
 */

type Conn = Kysely<DB>;

export async function createVerificationRequest(
  db: Conn,
  userId: string,
  input: { documentType: "passport" | "drivers-license" | "national-id" | "other" },
) {
  const open = await repo.findOpenRequestForUser(db, userId);
  if (open) {
    throw conflict("You already have an open verification request", { openRequestId: open.id, status: open.status });
  }
  return repo.insertVerificationRequest(db, { userId, documentType: input.documentType });
}

export function listOwnVerificationRequests(db: Conn, userId: string) {
  return repo.listRequestsForUser(db, userId);
}

export function listVerificationRequestsForAdmin(db: Conn, status?: repo.VerificationStatus) {
  return repo.listRequestsForAdmin(db, status);
}

async function notifyApplicant(
  db: Conn,
  userId: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const contact = await repo.findUserContact(db, userId);
    if (!contact) return;
    await sendEmail({ to: contact.email, subject, html, text: subject });
  } catch (error) {
    // Email delivery must never roll back a KYC decision.
    console.error("[verification] failed to send notification email", error);
  }
}

function assertDecidable(request: { status: string }, action: string) {
  if (request.status === "approved" || request.status === "rejected") {
    throw new AppError(409, "CONFLICT", `Verification request has already been decided (${request.status}); cannot ${action}`);
  }
}

/** Admin approve: flip to approved, stamp freelancer_profiles verified, email the applicant. */
export async function approveVerificationRequest(db: Conn, adminId: string, id: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) {
    throw notFound("Verification request not found");
  }
  assertDecidable(existing, "approve");

  const updated = await db.transaction().execute(async (trx) => {
    const decided = await repo.setRequestDecision(trx, id, {
      status: "approved",
      decidedBy: adminId,
      notes: null,
    });
    await repo.markFreelancerVerified(trx, existing.user_id);
    return decided;
  });

  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — your identity was verified",
    `<p>Good news — your identity verification was approved. Your profile now carries the verified badge.</p>`,
  );
  return updated;
}

/** Admin reject: flip to rejected with the reason stored in notes, email the applicant. */
export async function rejectVerificationRequest(db: Conn, adminId: string, id: string, reason: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) {
    throw notFound("Verification request not found");
  }
  assertDecidable(existing, "reject");

  const updated = await repo.setRequestDecision(db, id, { status: "rejected", decidedBy: adminId, notes: reason });

  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — verification needs attention",
    `<p>Your identity verification was rejected.</p><p><strong>Reason:</strong> ${escapeHtmlFragment(reason)}</p><p>You can submit a new request with an updated document.</p>`,
  );
  return updated;
}

/** Admin request-info: flip to info_requested with notes, email the applicant. */
export async function requestInfoVerificationRequest(db: Conn, adminId: string, id: string, notes: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) {
    throw notFound("Verification request not found");
  }
  assertDecidable(existing, "request info");

  const updated = await repo.setRequestDecision(db, id, { status: "info_requested", decidedBy: adminId, notes, markDecided: false });

  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — more information needed for your verification",
    `<p>Our review team needs more information to verify your identity.</p><p><strong>Requested:</strong> ${escapeHtmlFragment(notes)}</p>`,
  );
  return updated;
}

export async function getVerificationRequestDetail(db: Conn, id: string) {
  const detail = await repo.findRequestDetail(db, id);
  if (!detail) {
    throw notFound("Verification request not found");
  }
  return detail;
}

function escapeHtmlFragment(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
