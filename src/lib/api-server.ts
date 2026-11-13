import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server-side helper for calling the Fastify API with the caller's session.
 * Distinct from src/lib/api-data.ts (which other pages use): this one takes the
 * cookie header explicitly so pages can build it once and fan out requests.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com";

export class ApiServerError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiServerError";
  }
}

/** True when the API rejected the request because the session is missing or invalid. */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiServerError && error.status === 401;
}

/** Reads the incoming session cookie; redirects to /login when there is none. */
export async function sessionCookie(): Promise<string> {
  const store = await cookies();
  const cookie = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookie) redirect("/login");
  return cookie;
}

/** One calendar month of milestone earnings, minor units, oldest first. */
export interface MonthlyEarningsPoint {
  month: string; // YYYY-MM
  label: string; // e.g. "Nov 26"
  earningsMinor: number;
}

/**
 * Buckets completed milestone transactions (net credits the freelancer received)
 * into the trailing `monthsBack` calendar months. Transactions are signed; the
 * client ledger uses negative amounts for milestone payments, so only strictly
 * positive milestone credits count as earnings.
 */
export function monthlyEarnings(
  transactions: { type: string; status: string; amount_minor: number; created_at: string }[],
  now: Date,
  monthsBack = 13,
): MonthlyEarningsPoint[] {
  const keys: { month: string; label: string }[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    keys.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    });
  }
  const sums = new Map<string, number>(keys.map((k) => [k.month, 0]));
  for (const txn of transactions) {
    if (txn.type !== "milestone" || txn.status !== "completed") continue;
    const amount = Number(txn.amount_minor);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = txn.created_at.slice(0, 7);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + amount);
  }
  return keys.map((k) => ({ month: k.month, label: k.label, earningsMinor: sums.get(k.month) ?? 0 }));
}

interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: Record<string, unknown> };
}

export async function apiServer<T>(path: string, init?: RequestInit, cookie?: string): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (cookie) headers.cookie = cookie;
  if (init?.body !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let envelope: Envelope<T> | null = null;
  try {
    envelope = JSON.parse(text) as Envelope<T>;
  } catch {
    envelope = null;
  }

  if (!res.ok || !envelope?.success || envelope.data === undefined) {
    throw new ApiServerError(
      res.status,
      envelope?.error?.code ?? "REQUEST_FAILED",
      envelope?.message ?? `apiServer ${path} failed with ${res.status}`,
      envelope?.error?.details,
    );
  }
  return envelope.data;
}
