import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";
import { workspacePathForRole, type SessionAccount } from "@/lib/workspace";

/** Absolute backend URL for server-side session lookup. Browser code never uses
 * this; it is not exposed to the client. */
const API = process.env.API_URL ?? "https://workora-backend-x5il.onrender.com";

export type { SessionAccount };
export { workspacePathForRole };

/** Bare origin (scheme + host) the API allowlist accepts. Referer carries a path and is rejected. */
async function bareOrigin(): Promise<string> {
  const hdrs = await headers();
  const originHeader = hdrs.get("origin") ?? hdrs.get("referer");
  try {
    if (originHeader) return new URL(originHeader).origin;
  } catch {
    // keep the default
  }
  return "http://localhost:3000";
}

async function fetchSessionAccount(): Promise<SessionAccount | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  if (!cookie) return null;

  const origin = await bareOrigin();
  try {
    const res = await fetch(`${API}/api/auth/get-session`, { headers: { cookie, origin }, cache: "no-store" });
    if (!res.ok) return null;
    const session = (await res.json()) as { user?: { id: string; name: string; email: string; image: string | null } } | null;
    if (!session?.user) return null;

    // Role comes only from the authenticated API response. A failed role lookup
    // is treated as an explicit failure: we never silently fall back to a
    // default workspace, because that would send a client or admin to the wrong
    // dashboard (or let them into one) without a verified role.
    let accountType: Role | null = null;
    try {
      const meRes = await fetch(`${API}/api/v1/users/me`, { headers: { cookie, origin }, cache: "no-store" });
      if (!meRes.ok) return null;
      const meBody = (await meRes.json()) as { data?: { user?: { account_type?: Role } } } | null;
      accountType = meBody?.data?.user?.account_type ?? null;
    } catch {
      return null;
    }
    if (!accountType) return null;

    return {
      userId: session.user.id,
      role: accountType,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Session for the current request, or null when signed out / unreachable.
 * Cached per request so a layout and its page share one round trip.
 */
export const getSessionAccount = cache(fetchSessionAccount);

/** Server-side guard. Reads the Better Auth session cookie and redirects to /login (or the matching workspace) on failure. */
export async function requireSession({ requiredRole }: { requiredRole?: Role } = {}): Promise<SessionAccount> {
  const account = await getSessionAccount();
  if (!account) redirect("/login");

  if (requiredRole && account.role !== requiredRole) {
    redirect(workspacePathForRole(account.role));
  }

  return account;
}
