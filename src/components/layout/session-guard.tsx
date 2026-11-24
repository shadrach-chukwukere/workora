import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverApiBase } from "@/lib/api-base";
import type { Role } from "@/lib/types";
import { onboardingDestination, workspacePathForRole, withNext, type SessionAccount } from "@/lib/workspace";

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

/**
 * Next/Vercel expose the current route on these internal headers. Layouts do
 * not receive pathname, so this lets the guard preserve a deep link through
 * onboarding. Returns null when unavailable and silently falls back.
 */
async function currentPathFromHeaders(): Promise<string | null> {
  const hdrs = await headers();
  const path = hdrs.get("x-invoke-path") ?? hdrs.get("x-matched-path");
  if (!path?.startsWith("/") || path.startsWith("//")) return null;

  const rawQuery = hdrs.get("x-invoke-query");
  if (!rawQuery) return path;
  try {
    const parsed = JSON.parse(rawQuery) as Record<string, unknown>;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value) && typeof value[0] === "string") query.set(key, value[0]!);
    }
    const serialized = query.toString();
    return serialized ? `${path}?${serialized}` : path;
  } catch {
    return rawQuery.startsWith("?") ? `${path}${rawQuery}` : path;
  }
}

async function fetchSessionAccount(): Promise<SessionAccount | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  if (!cookie) return null;

  const origin = await bareOrigin();
  try {
    const res = await fetch(`${serverApiBase}/api/auth/get-session`, {
      headers: { cookie, origin },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const session = (await res.json()) as {
      user?: { id: string; name: string; email: string; image: string | null; verified?: boolean };
    } | null;
    if (!session?.user) return null;

    let accountType: Role = "freelancer";
    let needsRoleSelection = false;
    let verified = session.user.verified === true;
    let needsVerification = !verified;
    try {
      const meRes = await fetch(`${serverApiBase}/api/v1/users/me`, {
        headers: { cookie, origin },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      const meBody = (await meRes.json()) as {
        data?: {
          user?: {
            account_type?: Role;
            needsRoleSelection?: boolean;
            needsVerification?: boolean;
            verified?: boolean;
          };
        };
      } | null;
      const meUser = meBody?.data?.user;
      if (meUser?.account_type) accountType = meUser.account_type;
      if (typeof meUser?.verified === "boolean") verified = meUser.verified;
      needsRoleSelection = meUser?.needsRoleSelection === true;
      needsVerification = meUser?.needsVerification === true || !verified;
    } catch {
      // Keep the session-derived verification state rather than logging out.
    }

    return {
      userId: session.user.id,
      role: accountType,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
      needsRoleSelection,
      needsVerification,
      verified,
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

/** Server-side guard. Redirects through mandatory onboarding before role checks. */
export async function requireSession({
  requiredRole,
  next,
}: { requiredRole?: Role; next?: string | null } = {}): Promise<SessionAccount> {
  const account = await getSessionAccount();
  if (!account) redirect(withNext("/login", next ?? (await currentPathFromHeaders())));

  const intended = next ?? (await currentPathFromHeaders());
  if (account.needsRoleSelection || (account.needsVerification && account.role !== "admin")) {
    redirect(onboardingDestination(account, intended));
  }

  if (requiredRole && account.role !== requiredRole) {
    redirect(workspacePathForRole(account.role));
  }

  return account;
}
