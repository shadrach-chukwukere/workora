import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { onboardingDestination, safeNextPath } from "@/lib/workspace";
import { RoleSelectionForm } from "./role-selection-form";

export const metadata = {
  title: "Choose your role · Workora",
  description: "Choose how you want to use Workora. This can’t be changed later.",
};

export default async function RoleSelectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNextPath((await searchParams)?.next);
  const account = await getSessionAccount();
  if (!account) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login?next=/onboarding/role");
  if (!account.needsRoleSelection) redirect(onboardingDestination(account, next ?? undefined));

  return <RoleSelectionForm name={account.name} next={next ?? undefined} />;
}
