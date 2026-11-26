import type { Role } from "@/lib/types";
import type { SessionAccount } from "@/lib/workspace";

/** Short-lived client cache so public navigations don't re-check the session. */
let cached: { at: number; value: Promise<SessionAccount | null> } | null = null;

async function readAccount(): Promise<SessionAccount | null> {
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
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  cached = { at: Date.now(), value: readAccount() };
  return cached.value;
}

export function clearClientAccountCache() {
  cached = null;
}
