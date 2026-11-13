import type { Role } from "@/lib/types";

export interface SessionAccount {
  userId: string;
  role: Role;
  name: string;
  email: string;
  image: string | null;
}

/** Where a role lands after sign-in / when opening the workspace. */
export function workspacePathForRole(role: Role | null | undefined): string {
  if (role === "client") return "/client/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/freelancer/dashboard";
}
