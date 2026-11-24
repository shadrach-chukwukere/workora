import type { Role } from "@/lib/types";

export interface SessionAccount {
  userId: string;
  role: Role;
  name: string;
  email: string;
  image: string | null;
  /** True until the user has chosen (or skipped to the default) their marketplace role. */
  needsRoleSelection: boolean;
  /** True until an admin has reviewed an identity verification request. */
  needsVerification: boolean;
  verified: boolean;
}

/** Where a role lands after sign-in / when opening the workspace. */
export function workspacePathForRole(role: Role | null | undefined): string {
  if (role === "client") return "/client/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/freelancer/dashboard";
}

/**
 * Only allow same-site internal paths as post-onboarding destinations.
 * Blocks protocol-relative URLs, backslashes, control characters and encoded
 * line breaks that browsers could otherwise treat as an external redirect.
 */
export function safeNextPath(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/\\|[\u0000-\u001F\u007F]/.test(value)) return null;

  try {
    const url = new URL(value, "http://workora.local");
    if (url.origin !== "http://workora.local") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Append a sanitized `next` parameter without double-encoding it. */
export function withNext(path: string, next?: string | string[] | null): string {
  const target = safeNextPath(next);
  return target ? `${path}?next=${encodeURIComponent(target)}` : path;
}

type OnboardingAccount = Pick<SessionAccount, "role" | "needsRoleSelection" | "needsVerification">;

/** Resolve the first incomplete onboarding step (role → verification → destination). */
export function onboardingDestination(account: OnboardingAccount, next?: string | string[] | null): string {
  if (account.needsRoleSelection) return withNext("/onboarding/role", next);
  if (account.needsVerification && account.role !== "admin") return withNext("/onboarding/verify", next);
  return safeNextPath(next) ?? workspacePathForRole(account.role);
}
