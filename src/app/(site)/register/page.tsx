import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { onboardingDestination, safeNextPath } from "@/lib/workspace";
import RegisterForm from "./register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNextPath((await searchParams)?.next);
  const account = await getSessionAccount();
  if (account) redirect(onboardingDestination(account, next ?? undefined));
  return <RegisterForm next={next ?? undefined} />;
}
