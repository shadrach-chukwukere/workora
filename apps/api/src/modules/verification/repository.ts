import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "../../database/types.js";

/** Data access for the verification (KYC) module. */
export type Conn = Kysely<DB>;

export type VerificationStatus = "pending" | "info_requested" | "approved" | "rejected";

export function findOpenRequestForUser(db: Conn, userId: string) {
  return db
    .selectFrom("verification_requests")
    .selectAll()
    .where("user_id", "=", userId)
    .where("status", "in", ["pending", "info_requested"])
    .executeTakeFirst();
}

export function insertVerificationRequest(db: Conn, row: { userId: string; documentType: string }) {
  return db
    .insertInto("verification_requests")
    .values({
      user_id: row.userId,
      document_type: row.documentType,
      status: "pending",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function listRequestsForUser(db: Conn, userId: string) {
  return db
    .selectFrom("verification_requests")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("submitted_at", "desc")
    .execute();
}

export function listRequestsForAdmin(db: Conn, status?: VerificationStatus, limit = 100) {
  let query = db
    .selectFrom("verification_requests as vr")
    .innerJoin("users as u", "u.id", "vr.user_id")
    .select([
      "vr.id",
      "vr.user_id",
      "vr.status",
      "vr.document_type",
      "vr.submitted_at",
      "vr.decided_at",
      "vr.decided_by",
      "vr.notes",
      "u.name as user_name",
      "u.image as user_image",
      "u.account_type as user_account_type",
    ])
    .orderBy("vr.submitted_at", "desc")
    .limit(limit);

  if (status) {
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
      "vr.submitted_at",
      "vr.decided_at",
      "vr.decided_by",
      "vr.notes",
      "u.name as user_name",
      "u.email as user_email",
      "u.image as user_image",
      "u.account_type as user_account_type",
    ])
    .where("vr.id", "=", id)
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

/** Mark the freelancer profile as identity-verified. Creates a minimal profile row if none exists yet. */
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
