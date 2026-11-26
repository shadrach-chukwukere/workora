import { env } from "../../config/env.js";
import { db } from "../../database/connection.js";
import { notFound } from "../../plugins/error-handler.js";
import { sendEmail } from "../../services/email.js";
import * as repository from "./repository.js";
import type { ContactRow } from "./repository.js";
import type { ContactStatus, ContactSubmissionInput, UpdateContactInput } from "./schemas.js";

const SUPPORT_EMAIL = "hello@workora-phi.vercel.app";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serialize(row: ContactRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Email is a best-effort notification; the database row is the source of truth. */
async function notifySupport(row: ContactRow): Promise<void> {
  if (!env.RESEND_API_KEY.trim()) {
    return;
  }
  const subject = `[Contact] ${row.topic} - ${row.name}`.replace(/[\r\n]+/g, " ").slice(0, 200);
  const text = `Name: ${row.name}\nEmail: ${row.email}\nTopic: ${row.topic}\n\n${row.message}`;
  const html = `<p><strong>Name:</strong> ${escapeHtml(row.name)}<br/><strong>Email:</strong> ${escapeHtml(row.email)}<br/><strong>Topic:</strong> ${escapeHtml(row.topic)}</p><p>${escapeHtml(row.message).replace(/\n/g, "<br/>")}</p>`;
  try {
    await sendEmail({ to: SUPPORT_EMAIL, replyTo: row.email, subject, text, html });
  } catch (error) {
    // Never reject a stored contact message because email delivery failed.
    console.warn("[contact] saved message but support email failed:", error instanceof Error ? error.message : error);
  }
}

export async function submitContact(input: ContactSubmissionInput) {
  const instance = await db();
  const row = await repository.createContact(instance, input);
  await notifySupport(row);
  return serialize(row);
}

export async function listForAdmin(query: {
  status?: ContactStatus;
  q: string;
  page: number;
  perPage: number;
}) {
  const instance = await db();
  const offset = (query.page - 1) * query.perPage;
  const [{ rows, total }, counts] = await Promise.all([
    repository.listContacts(instance, {
      status: query.status,
      q: query.q,
      limit: query.perPage,
      offset,
    }),
    repository.countByStatus(instance),
  ]);

  return {
    items: rows.map(serialize),
    total,
    page: query.page,
    perPage: query.perPage,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.perPage),
    hasMore: offset + rows.length < total,
    counts,
  };
}

export async function getForAdmin(id: string) {
  const instance = await db();
  const found = await repository.findContact(instance, id);
  if (!found) {
    throw notFound("Contact message not found");
  }
  if (found.status === "new") {
    const opened = await repository.updateContact(instance, id, { status: "read" });
    return serialize(opened ?? found);
  }
  return serialize(found);
}

export async function updateForAdmin(id: string, input: UpdateContactInput) {
  const instance = await db();
  const patch: repository.ContactPatch = {};
  if (input.status) {
    patch.status = input.status;
  }
  if (input.adminNotes !== undefined) {
    patch.admin_notes = input.adminNotes?.trim() ? input.adminNotes.trim() : null;
  }
  const updated = await repository.updateContact(instance, id, patch);
  if (!updated) {
    throw notFound("Contact message not found");
  }
  return serialize(updated);
}
