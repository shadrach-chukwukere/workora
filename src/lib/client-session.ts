import type { Role } from "@/lib/types";
import type { SessionAccount } from "@/lib/workspace";

/**
 * Sign-in hint stored in sessionStorage. The real session cookie is HttpOnly,
 * so the browser cannot read it directly. Auth flows set this hint once; public
 * pages use it to avoid calling the rate-limited /api/auth/get-session endpoint
 * for visitors who are definitely signed out.
 */
const SESSION_HINT_KEY = "workora.auth.hint";
const CACHE_TTL_MS = 5 * 60_000;

let cached: { at: number; value: Promise<SessionAccount | null> } | null = null;

function hasSessionHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

async function readAccount(): Promise<SessionAccount | null> {
  if (!hasSessionHint()) return null;

  try {
    const res = await fetch("/api/auth/get-session", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const session = (await res.json()) as {
      user?: { id: string; name: string; email: string; image: string | null };
    } | null;
    const user = session?.user;
    if (!user) return null;

    let role: Role = "freelancer";
    try {
      const meRes = await fetch("/api/v1/users/me", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          data?: { user?: { account_type?: Role } };
        };
        if (me.data?.user?.account_type) role = me.data.user.account_type;
      }
    } catch {
      // Keep the safe freelancer default when the role lookup fails.
    }

    return {
      userId: user.id,
      role,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      needsRoleSelection: false,
      needsVerification: false,
      verificationRequired: false,
      verified: false,
    };
  } catch {
    return null;
  }
}

export function getClientAccount(): Promise<SessionAccount | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  cached = { at: Date.now(), value: readAccount() };
  return cached.value;
}

/** Called after a successful sign-in/up or whenever the server already has a session. */
export function markClientSessionActive() {
  const wasMarked = hasSessionHint();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SESSION_HINT_KEY, "1");
    } catch {
      // Storage can be unavailable; the server-side session is still authoritative.
    }
  }
  if (!wasMarked) cached = null;
}

/** Re-check on bfcache restore without forgetting that the user has a session. */
export function invalidateClientAccount() {
  cached = null;
}

/** Called on sign-out so subsequent public pages stop asking for a session. */
export function clearClientAccountCache() {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_HINT_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
  cached = null;
}
