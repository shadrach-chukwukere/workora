import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { safeNextPath, workspacePathForRole, withNext } from "@/lib/workspace";
import { VerificationOnboarding } from "./verification-onboarding";

export const metadata = {
  title: "Verify your identity · Workora",
  description: "Submit an identity document and selfie for manual admin review.",
};

export default async function VerifyOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params?.next);
  const account = await getSessionAccount();

  if (!account) redirect(withNext("/login", next ?? "/onboarding/verify"));
  if (account.needsRoleSelection) redirect(withNext("/onboarding/role", next));
  if (!account.verificationRequired || !account.needsVerification || account.role === "admin") {
    redirect(next ?? workspacePathForRole(account.role));
  }

  return <VerificationOnboarding name={account.name} next={next} />;
}
