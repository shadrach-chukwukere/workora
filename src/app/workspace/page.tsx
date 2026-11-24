import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { onboardingDestination, safeNextPath } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNextPath((await searchParams)?.next);
  const account = await getSessionAccount();
  if (!account) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  redirect(onboardingDestination(account, next ?? undefined));
}
