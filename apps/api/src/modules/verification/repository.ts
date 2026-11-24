import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "../../database/types.js";
import type { VerificationDocumentInput } from "./schemas.js";

/** Data access for the verification (KYC) module. */
export type Conn = Kysely<DB>;

export type VerificationStatus = "pending" | "info_requested" | "approved" | "rejected";

export function findOpenRequestForUser(db: Conn, userId: string) {
  return db
    .selectFrom("verification_requests")
    .selectAll()
    .where("user_id", "=", userId)
    .where("status", "in", ["pending", "info_requested"])
    .orderBy("submitted_at", "desc")
    .executeTakeFirst();
}

export function insertVerificationRequest(
  db: Conn,
  row: {
    userId: string;
    documentType: string;
    method: "manual" | "yoti";
    documentKey?: string | null;
    documentName?: string | null;
    yotiSessionId?: string | null;
  },
) {
  return db
    .insertInto("verification_requests")
    .values({
      user_id: row.userId,
      document_type: row.documentType,
      document_url: row.documentKey ?? null,
      document_name: row.documentName ?? null,
      method: row.method,
      provider: row.method === "yoti" ? "yoti" : "workora",
      yoti_session_id: row.yotiSessionId ?? null,
      status: "pending",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function insertVerificationDocuments(db: Conn, requestId: string, documents: VerificationDocumentInput[]) {
  if (documents.length === 0) return Promise.resolve([]);
  return db
    .insertInto("verification_documents")
    .values(
      documents.map((document) => ({
        request_id: requestId,
        file_name: document.fileName,
        url: document.key,
        mime_type: document.mimeType,
        size_bytes: document.sizeBytes,
        category: document.category,
        source: "upload",
        storage: document.key.startsWith("verification/") ? "s3" : "blob",
      })),
    )
    .returningAll()
    .execute();
}

export function insertYotiMedia(
  db: Conn,
  requestId: string,
  media: Array<{ id: string; category: "identity_document" | "selfie" | "supporting_document"; type: string }>,
) {
  if (media.length === 0) return Promise.resolve([]);
  return db
    .insertInto("verification_documents")
    .values(
      media.map((item) => ({
        request_id: requestId,
        file_name: `${item.category}-${item.id}`,
        url: null,
        mime_type: "application/octet-stream",
        size_bytes: 0,
        category: item.category,
        source: "yoti",
        storage: "yoti",
        yoti_media_id: item.id,
      })),
    )
    .onConflict((oc) => oc.columns(["request_id", "yoti_media_id"]).doNothing())
    .returningAll()
    .execute();
}

export function listRequestsForUser(db: Conn, userId: string) {
  return db
    .selectFrom("verification_requests")
    .select([
      "id", "status", "document_type", "method", "provider", "yoti_state", "submitted_at",
      "decided_at", "notes",
    ])
    .where("user_id", "=", userId)
    .orderBy("submitted_at", "desc")
    .execute();
}

export function listRequestsForAdmin(db: Conn, status?: VerificationStatus | "all", limit = 100) {
  let query = db
    .selectFrom("verification_requests as vr")
    .innerJoin("users as u", "u.id", "vr.user_id")
    .leftJoin("verification_documents as vd", "vd.request_id", "vr.id")
    .select([
      "vr.id",
      "vr.user_id",
      "vr.status",
      "vr.document_type",
      "vr.method",
      "vr.provider",
      "vr.submitted_at",
      "vr.decided_at",
      "vr.decided_by",
      "vr.notes",
      "vr.yoti_state",
      sql<number>`count(vd.id)::int`.as("document_count"),
      "u.name as user_name",
      "u.email as user_email",
      "u.image as user_image",
      "u.account_type as user_account_type",
      "u.verified as user_verified",
    ])
    .groupBy([
      "vr.id", "u.id", "u.name", "u.email", "u.image", "u.account_type", "u.verified",
    ])
    .orderBy("vr.submitted_at", "desc")
    .limit(limit);

  if (status && status !== "all") {
    query = query.where("vr.status", "=", status);
  }
  return query.execute();
}

export function findRequestDetail(db: Conn, id: string) {
  return db
    .selectFrom("verification_requests as vr")
    .innerJoin("users as u", "u.id", "vr.user_id")
    .select([
      "vr.id",
      "vr.user_id",
      "vr.status",
      "vr.document_type",
      "vr.method",
      "vr.provider",
      "vr.submitted_at",
      "vr.decided_at",
      "vr.decided_by",
      "vr.notes",
      "vr.yoti_state",
      "vr.yoti_summary",
      "u.name as user_name",
      "u.email as user_email",
      "u.image as user_image",
      "u.account_type as user_account_type",
      "u.verified as user_verified",
    ])
    .where("vr.id", "=", id)
    .executeTakeFirst();
}

export function findRequestDocuments(db: Conn, requestId: string) {
  return db
    .selectFrom("verification_documents")
    .select([
      "id", "file_name", "url", "mime_type", "size_bytes", "category", "source", "storage", "yoti_media_id", "created_at",
    ])
    .where("request_id", "=", requestId)
    .orderBy("created_at", "asc")
    .execute();
}

export function findDocumentForRequest(db: Conn, requestId: string, documentId: string) {
  return db
    .selectFrom("verification_documents")
    .selectAll()
    .where("id", "=", documentId)
    .where("request_id", "=", requestId)
    .executeTakeFirst();
}

export function addDocumentsToRequest(db: Conn, requestId: string, documents: VerificationDocumentInput[]) {
  return db
    .updateTable("verification_requests")
    .set({ status: "pending", decided_at: null, decided_by: null, notes: null })
    .where("id", "=", requestId)
    .where("status", "=", "info_requested")
    .returningAll()
    .executeTakeFirst();
}

export function setYotiResult(
  db: Conn,
  requestId: string,
  result: { state: string; summary: Record<string, unknown> },
) {
  return db
    .updateTable("verification_requests")
    .set({
      yoti_state: result.state,
      yoti_summary: result.summary,
      status: "pending",
      decided_at: null,
      decided_by: null,
      notes: null,
    })
    .where("id", "=", requestId)
    .returningAll()
    .executeTakeFirst();
}

export function findRequestById(db: Conn, id: string) {
  return db.selectFrom("verification_requests").selectAll().where("id", "=", id).executeTakeFirst();
}

export function setRequestDecision(
  db: Conn,
  id: string,
  decision: { status: VerificationStatus; decidedBy: string; notes?: string | null; markDecided?: boolean },
) {
  const decided = decision.markDecided !== false;
  return db
    .updateTable("verification_requests")
    .set(
      decided
        ? {
            status: decision.status,
            decided_at: new Date(),
            decided_by: decision.decidedBy,
            notes: decision.notes ?? null,
          }
        : {
            status: decision.status,
            decided_by: decision.decidedBy,
            notes: decision.notes ?? null,
          },
    )
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}

/** Set the user-level marketplace verification flag. Never touches email_verified. */
export async function markUserVerified(db: Conn, userId: string, method: "manual" | "yoti") {
  await sql`
    UPDATE users
    SET verified = true,
        verification_provider = 'workora',
        verification_method = ${method},
        verified_at = now()
    WHERE id = ${userId}
  `.execute(db);
}

/** Keep the legacy freelancer badge in sync for public profile cards. */
export async function markFreelancerVerified(db: Conn, userId: string) {
  const result = await sql`
    UPDATE freelancer_profiles
    SET verified_identity = true, verified_at = now(), updated_at = now()
    WHERE user_id = ${userId}
  `.execute(db);

  if (Number(result.numAffectedRows ?? 0) === 0) {
    await sql`
      INSERT INTO freelancer_profiles (user_id, headline, verified_identity, verified_at)
      VALUES (${userId}, '', true, now())
      ON CONFLICT (user_id) DO UPDATE SET verified_identity = true, verified_at = now(), updated_at = now()
    `.execute(db);
  }
}

export function findUserContact(db: Conn, userId: string) {
  return db
    .selectFrom("users")
    .select(["id", "name", "email"])
    .where("id", "=", userId)
    .executeTakeFirst();
}
