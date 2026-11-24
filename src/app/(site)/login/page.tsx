import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { onboardingDestination, safeNextPath } from "@/lib/workspace";
import type { Role } from "@/lib/types";
import LoginForm from "./login-form";

const ROLES: readonly Role[] = ["freelancer", "client", "admin"];

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params?.next);
  const account = await getSessionAccount();
  if (account) redirect(onboardingDestination(account, next ?? undefined));

  const rawRole = params?.role;
  const roleParam = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const defaultRole: Role = ROLES.includes(roleParam as Role) ? (roleParam as Role) : "freelancer";

  return <LoginForm defaultRole={defaultRole} next={next ?? undefined} />;
}
