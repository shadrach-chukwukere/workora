import { AppError, conflict, notFound } from "../../plugins/error-handler.js";
import { sendEmail } from "../../services/email.js";
import { assertVerificationUpload } from "../../services/storage.js";
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
  input: {
    documentType: "passport" | "drivers-license" | "national-id" | "other";
    documentKey: string;
    documentName: string;
  },
) {
  const profile = await db
    .selectFrom("freelancer_profiles")
    .select("verified_identity")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!profile) {
    throw notFound("Freelancer profile not found");
  }
  if (profile.verified_identity) {
    throw conflict("Your identity is already verified");
  }
  const open = await repo.findOpenRequestForUser(db, userId);
  if (open) {
    throw conflict("You already have an open verification request", { openRequestId: open.id, status: open.status });
  }
  await assertVerificationUpload(userId, input.documentKey);
  const request = await repo.insertVerificationRequest(db, {
    userId,
    documentType: input.documentType,
    documentKey: input.documentKey,
    documentName: input.documentName,
  });
  return ownRequest(request);
}

export async function replaceVerificationDocument(
  db: Conn,
  userId: string,
  requestId: string,
  documentKey: string,
  documentName: string,
) {
  const request = await repo.findRequestById(db, requestId);
  if (!request || request.user_id !== userId) {
    throw notFound("Verification request not found");
  }
  if (request.status !== "info_requested") {
    throw conflict("A new document can only be uploaded when more information was requested", { status: request.status });
  }
  await assertVerificationUpload(userId, documentKey);
  const updated = await repo.updateRequestDocument(db, requestId, documentKey, documentName);
  if (!updated) {
    throw conflict("Verification request changed while the document was being uploaded");
  }
  return ownRequest(updated);
}

export async function getVerificationDocumentKey(db: Conn, requestId: string) {
  const request = await repo.findRequestById(db, requestId);
  if (!request) {
    throw notFound("Verification request not found");
  }
  if (!request.document_url) {
    throw notFound("No identity document is attached to this request");
  }
  return { key: request.document_url, name: request.document_name };
}

function ownRequest(request: {
  id: string;
  status: string;
  document_type: string;
  submitted_at: Date;
  decided_at: Date | null;
  notes: string | null;
}) {
  return {
    id: request.id,
    status: request.status,
    document_type: request.document_type,
    submitted_at: request.submitted_at,
    decided_at: request.decided_at,
    notes: request.notes,
  };
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
  if (!existing.document_url) {
    throw conflict("A verification request without an identity document cannot be approved");
  }

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
