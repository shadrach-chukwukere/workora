import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../database/types.js";
import type { ContactStatus } from "./schemas.js";

export type ContactExecutor = Kysely<DB> | Transaction<DB>;

export interface ContactRow {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: ContactStatus;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactPatch {
  status?: ContactStatus;
  admin_notes?: string | null;
}

export function createContact(ex: ContactExecutor, input: { name: string; email: string; topic: string; message: string }) {
  return ex
    .insertInto("contact_submissions")
    .values({ name: input.name, email: input.email, topic: input.topic, message: input.message })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findContact(ex: ContactExecutor, id: string) {
  return ex.selectFrom("contact_submissions").selectAll().where("id", "=", id).executeTakeFirst();
}

export function updateContact(ex: ContactExecutor, id: string, patch: ContactPatch) {
  return ex
    .updateTable("contact_submissions")
    .set({ ...patch, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}

export async function listContacts(
  ex: ContactExecutor,
  options: { status?: ContactStatus; q: string; limit: number; offset: number },
): Promise<{ rows: ContactRow[]; total: number }> {
  let rowsQuery = ex.selectFrom("contact_submissions").selectAll();
  let countQuery = ex
    .selectFrom("contact_submissions")
    .select((eb) => eb.fn.countAll<number>().as("count"));

  if (options.status) {
    rowsQuery = rowsQuery.where("status", "=", options.status);
    countQuery = countQuery.where("status", "=", options.status);
  }
  if (options.q) {
    const pattern = `%${options.q}%`;
    rowsQuery = rowsQuery.where((eb) =>
      eb.or([
        eb("name", "ilike", pattern),
        eb("email", "ilike", pattern),
        eb("topic", "ilike", pattern),
        eb("message", "ilike", pattern),
      ]),
    );
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb("name", "ilike", pattern),
        eb("email", "ilike", pattern),
        eb("topic", "ilike", pattern),
        eb("message", "ilike", pattern),
      ]),
    );
  }

  const [rows, countRow] = await Promise.all([
    rowsQuery.orderBy("created_at", "desc").limit(options.limit).offset(options.offset).execute(),
    countQuery.executeTakeFirst(),
  ]);
  return { rows: rows as ContactRow[], total: Number(countRow?.count ?? 0) };
}

export async function countByStatus(ex: ContactExecutor): Promise<Record<ContactStatus, number>> {
  const rows = await ex
    .selectFrom("contact_submissions")
    .select("status")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .groupBy("status")
    .execute();
  const counts: Record<ContactStatus, number> = { new: 0, read: 0, replied: 0, archived: 0 };
  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }
  return counts;
}
