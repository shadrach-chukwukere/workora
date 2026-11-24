import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { workspacePathForRole } from "@/lib/workspace";
import { RoleSelectionForm } from "./role-selection-form";

export const metadata = {
  title: "Choose your role · Workora",
  description: "Choose how you want to use Workora. This can’t be changed later.",
};

export default async function RoleSelectionPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/login?next=/onboarding/role");
  if (!account.needsRoleSelection) redirect(workspacePathForRole(account.role));

  return <RoleSelectionForm name={account.name} />;
}
