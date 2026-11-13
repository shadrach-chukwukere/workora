import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { workspacePathForRole } from "@/lib/workspace";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const account = await getSessionAccount();
  if (account) redirect(workspacePathForRole(account.role));
  return <RegisterForm />;
}
