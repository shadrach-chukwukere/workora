import Link from "next/link";
import { ApiError } from "@/lib/api";

/** Honest 403 card shown when the console API rejects the session as non-admin. */
export function AdminAccessCard({ message }: { message?: string }) {
 return (
 <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
 <p className="text-sm font-semibold text-amber-900">You need admin access</p>
 <p className="text-sm leading-relaxed text-amber-900/80">
 {message ?? "The API rejected this session for admin-only data. Sign in with an admin account to view the console."}
 </p>
 <Link href="/login" className="text-[13px] font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950">
 Sign in with an admin account
 </Link>
 </div>
 );
}

export type AdminFetchError =
 | { kind: "login" }
 | { kind: "forbidden"; message: string }
 | { kind: "error"; message: string };

/**
 * Classifies a client-side `api()` failure. Callers redirect on "login",
 * render AdminAccessCard on "forbidden", and surface the message otherwise.
 */
export function classifyAdminError(error: unknown): AdminFetchError {
 if (error instanceof ApiError) {
 if (error.status === 401) return { kind: "login" };
 if (error.status === 403) return { kind: "forbidden", message: error.message };
 return { kind: "error", message: error.message };
 }
 return { kind: "error", message: error instanceof Error ? error.message : "Request failed" };
}
