import { AppError, conflict, notFound, serviceUnavailable } from "../../plugins/error-handler.js";
import { sendEmail } from "../../services/email.js";
import {
  assertVerificationUpload,
  readPrivateDocument,
  storeVerificationUpload,
  type VerificationDocumentCategory,
} from "../../services/storage.js";
import {
  createYotiSession,
  fetchYotiMedia,
  fetchYotiVerification,
  isYotiConfigured,
  type YotiSessionInfo,
} from "../../services/yoti.js";
import type { Kysely } from "kysely";
import type { DB } from "../../database/types.js";
import * as repo from "./repository.js";
import type { VerificationDocumentInput } from "./schemas.js";

/**
 * VERIFICATION (KYC).
 * Request lifecycle: pending → info_requested → approved | rejected.
 * Yoti supplies documents and checks, but an admin always makes the final
 * human decision. Manual uploads are the fallback when Yoti is unavailable or
 * a user cannot complete the Yoti flow.
 */
type Conn = Kysely<DB>;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function ownRequest(request: {
  id: string;
  status: string;
  document_type: string;
  method: string;
  provider: string;
  yoti_state: string | null;
  submitted_at: Date;
  decided_at: Date | null;
  notes: string | null;
}) {
  return {
    id: request.id,
    status: request.status,
    document_type: request.document_type,
    method: request.method,
    provider: request.provider,
    yoti_state: request.yoti_state,
    submitted_at: request.submitted_at,
    decided_at: request.decided_at,
    notes: request.notes,
  };
}

export async function uploadVerificationDocument(
  db: Conn,
  userId: string,
  input: { category: VerificationDocumentCategory; fileName: string; mimeType: string; contentBase64: string },
) {
  await assertUserExists(db, userId);
  let body: Buffer;
  try {
    body = Buffer.from(input.contentBase64, "base64");
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Upload is not valid base64 content");
  }
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError(400, "VALIDATION_ERROR", "Upload must be between 1 byte and 10 MB");
  }

  const stored = await storeVerificationUpload(userId, input.category, input.fileName, input.mimeType, body);
  return {
    category: input.category,
    key: stored.key,
    fileName: input.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
  } satisfies VerificationDocumentInput;
}

async function assertUserExists(db: Conn, userId: string) {
  const user = await db.selectFrom("users").select("verified").where("id", "=", userId).executeTakeFirst();
  if (!user) throw notFound("User not found");
  return user;
}

function assertManualDocuments(documents: VerificationDocumentInput[] | undefined) {
  if (!documents || documents.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Upload an identity document and a photo of yourself");
  }
  const categories = new Set(documents.map((document) => document.category));
  if (!categories.has("identity_document")) {
    throw new AppError(400, "VALIDATION_ERROR", "An identity document is required");
  }
  if (!categories.has("selfie")) {
    throw new AppError(400, "VALIDATION_ERROR", "A clear photo of your face is required");
  }
}

async function assertUploadsBelongToUser(userId: string, documents: VerificationDocumentInput[]) {
  for (const document of documents) {
    await assertVerificationUpload(userId, document.key);
  }
}

export async function createVerificationRequest(
  db: Conn,
  userId: string,
  input: {
    method: "manual" | "yoti";
    documentType: "passport" | "drivers-license" | "national-id" | "other" | "yoti";
    documents?: VerificationDocumentInput[];
  },
): Promise<{ request: ReturnType<typeof ownRequest>; yoti?: YotiSessionInfo }> {
  const user = await assertUserExists(db, userId);
  if (user.verified) {
    throw conflict("Your identity is already verified");
  }

  const open = await repo.findOpenRequestForUser(db, userId);
  if (open) {
    throw conflict("You already have an open verification request", { openRequestId: open.id, status: open.status });
  }

  let yoti: YotiSessionInfo | undefined;
  if (input.method === "yoti") {
    if (!isYotiConfigured()) {
      throw serviceUnavailable("Yoti identity verification is not configured; use manual review instead");
    }
    yoti = await createYotiSession(userId);
  } else {
    assertManualDocuments(input.documents);
    await assertUploadsBelongToUser(userId, input.documents!);
  }

  if (input.documents?.length) {
    await assertUploadsBelongToUser(userId, input.documents);
  }

  const request = await repo.insertVerificationRequest(db, {
    userId,
    documentType: input.method === "yoti" ? "yoti" : input.documentType,
    method: input.method,
    documentKey: input.documents?.[0]?.key ?? null,
    documentName: input.documents?.[0]?.fileName ?? null,
    yotiSessionId: yoti?.sessionId ?? null,
  });

  if (input.documents?.length) {
    await repo.insertVerificationDocuments(db, request.id, input.documents);
  }

  return { request: ownRequest(request), yoti };
}

export async function addDocumentsToRequest(
  db: Conn,
  userId: string,
  requestId: string,
  documents: VerificationDocumentInput[],
) {
  const request = await repo.findRequestById(db, requestId);
  if (!request || request.user_id !== userId) throw notFound("Verification request not found");
  if (request.status !== "info_requested") {
    throw conflict("New documents can only be added when more information was requested", { status: request.status });
  }
  await assertUploadsBelongToUser(userId, documents);
  const updated = await repo.addDocumentsToRequest(db, requestId, documents);
  if (!updated) throw conflict("Verification request changed while documents were being uploaded");
  await repo.insertVerificationDocuments(db, requestId, documents);
  return ownRequest(updated);
}

export async function completeYotiVerification(db: Conn, userId: string, requestId: string) {
  const request = await repo.findRequestById(db, requestId);
  if (!request || request.user_id !== userId) throw notFound("Verification request not found");
  if (request.method !== "yoti" || !request.yoti_session_id) {
    throw conflict("This verification request is not a Yoti session", { method: request.method });
  }
  if (request.status === "approved" || request.status === "rejected") {
    throw conflict(`Verification request has already been decided (${request.status})`);
  }

  const summary = await fetchYotiVerification(request.yoti_session_id);
  const allChecksDone = summary.checks.length > 0 && summary.checks.every((check) => check.state === "DONE");
  const sessionDone = summary.state === "DONE" || summary.state === "COMPLETED";
  if (!sessionDone && !allChecksDone) {
    throw conflict("Yoti has not finished processing this session yet", {
      state: summary.state,
      checks: summary.checks,
    });
  }
  if (summary.media.length === 0) {
    throw conflict("Yoti has not returned any photos or documents for review yet", { state: summary.state });
  }

  await repo.insertYotiMedia(db, request.id, summary.media);
  const updated = await repo.setYotiResult(db, request.id, {
    state: summary.state,
    summary: { checks: summary.checks, mediaCount: summary.media.length },
  });
  if (!updated) throw conflict("Verification request changed while Yoti results were being imported");

  return { request: ownRequest(updated), summary };
}

export function listOwnVerificationRequests(db: Conn, userId: string) {
  return repo.listRequestsForUser(db, userId);
}

export async function listVerificationRequestsForAdmin(db: Conn, status?: repo.VerificationStatus | "all") {
  return repo.listRequestsForAdmin(db, status);
}

export async function getVerificationRequestDetail(db: Conn, id: string) {
  const detail = await repo.findRequestDetail(db, id);
  if (!detail) throw notFound("Verification request not found");
  const documents = await repo.findRequestDocuments(db, id);
  return { ...detail, documents };
}

export async function getVerificationDocument(db: Conn, requestId: string, documentId: string) {
  const document = await repo.findDocumentForRequest(db, requestId, documentId);
  if (!document) throw notFound("Verification document not found");

  if (document.source === "yoti") {
    const request = await repo.findRequestById(db, requestId);
    if (!request?.yoti_session_id || !document.yoti_media_id) {
      throw notFound("Yoti media is no longer available");
    }
    const media = await fetchYotiMedia(request.yoti_session_id, document.yoti_media_id);
    if (!media) throw notFound("Yoti media is empty");
    return { ...media, fileName: document.file_name };
  }

  if (!document.url) throw notFound("Verification document has no stored file");
  const stored = await readPrivateDocument(document.url);
  if (!stored) throw serviceUnavailable("Private document storage is not configured");
  return { body: stored.body, mimeType: document.mime_type || stored.contentType, fileName: document.file_name };
}

/** Legacy endpoint compatibility: return the first attached document. */
export async function getVerificationDocumentKey(db: Conn, requestId: string) {
  const documents = await repo.findRequestDocuments(db, requestId);
  const document = documents[0];
  const request = await repo.findRequestById(db, requestId);
  if (!request) throw notFound("Verification request not found");
  if (document?.url) return { key: document.url, name: document.file_name };
  if (request.document_url) return { key: request.document_url, name: request.document_name };
  throw notFound("No identity document is attached to this request");
}

async function notifyApplicant(db: Conn, userId: string, subject: string, html: string): Promise<void> {
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

async function assertHasReviewableMaterial(db: Conn, id: string) {
  const documents = await repo.findRequestDocuments(db, id);
  if (documents.length > 0) return;
  const request = await repo.findRequestById(db, id);
  if (request?.document_url) return;
  throw conflict("A verification request without any photo or document cannot be approved");
}

/** Admin approve: set the user-level verified flag and keep legacy badges in sync. */
export async function approveVerificationRequest(db: Conn, adminId: string, id: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) throw notFound("Verification request not found");
  assertDecidable(existing, "approve");
  await assertHasReviewableMaterial(db, id);

  const updated = await db.transaction().execute(async (trx) => {
    const decided = await repo.setRequestDecision(trx, id, {
      status: "approved",
      decidedBy: adminId,
      notes: null,
    });
    await repo.markUserVerified(trx, existing.user_id, existing.method === "yoti" ? "yoti" : "manual");
    await repo.markFreelancerVerified(trx, existing.user_id);
    return decided;
  });

  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — your identity was verified",
    `<p>Good news — your identity verification was approved after manual review. Your account now carries the verified badge.</p>`,
  );
  return updated;
}

export async function rejectVerificationRequest(db: Conn, adminId: string, id: string, reason: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) throw notFound("Verification request not found");
  assertDecidable(existing, "reject");

  const updated = await repo.setRequestDecision(db, id, { status: "rejected", decidedBy: adminId, notes: reason });
  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — verification needs attention",
    `<p>Your identity verification was rejected.</p><p><strong>Reason:</strong> ${escapeHtmlFragment(reason)}</p><p>You can submit a new request with updated photos and documents.</p>`,
  );
  return updated;
}

export async function requestInfoVerificationRequest(db: Conn, adminId: string, id: string, notes: string) {
  const existing = await repo.findRequestById(db, id);
  if (!existing) throw notFound("Verification request not found");
  assertDecidable(existing, "request info");

  const updated = await repo.setRequestDecision(db, id, {
    status: "info_requested",
    decidedBy: adminId,
    notes,
    markDecided: false,
  });
  await notifyApplicant(
    db,
    existing.user_id,
    "Workora — more information needed for your verification",
    `<p>Our review team needs more information to verify your identity.</p><p><strong>Requested:</strong> ${escapeHtmlFragment(notes)}</p>`,
  );
  return updated;
}

function escapeHtmlFragment(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
