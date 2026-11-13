import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { workspacePathForRole } from "@/lib/workspace";
import type { Role } from "@/lib/types";
import LoginForm from "./login-form";

const ROLES: readonly Role[] = ["freelancer", "client", "admin"];

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getSessionAccount();
  if (account) redirect(workspacePathForRole(account.role));

  const rawRole = (await searchParams)?.role;
  const roleParam = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const defaultRole: Role = ROLES.includes(roleParam as Role) ? (roleParam as Role) : "freelancer";

  return <LoginForm defaultRole={defaultRole} />;
}
