import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { workspacePathForRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const account = await getSessionAccount();
  if (!account) {
    redirect("/login");
  }
  redirect(workspacePathForRole(account.role));
}
