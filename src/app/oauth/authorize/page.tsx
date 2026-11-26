import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { withNext } from "@/lib/workspace";
import { ConsentClient } from "./consent-client";

export const metadata: Metadata = {
  title: "Authorize AI connection",
  description: "Review the permissions an AI assistant is requesting for your Workora account.",
};

const KEYS = ["client_id", "redirect_uri", "response_type", "scope", "state", "code_challenge", "code_challenge_method", "resource"] as const;

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const key of KEYS) {
    const value = raw[key];
    if (typeof value === "string") params[key] = value;
  }
  const account = await getSessionAccount();
  if (!account) {
    const query = new URLSearchParams(params).toString();
    redirect(withNext("/login", `/oauth/authorize?${query}`));
  }

  const missing = KEYS.filter((key) => key !== "resource" && !params[key]);
  if (missing.length > 0) {
    return (
      <main className="container-page flex min-h-dvh max-w-lg items-center py-12">
        <div className="card w-full p-6">
          <h1 className="text-lg font-semibold text-neutral-900">Invalid authorization request</h1>
          <p className="mt-2 text-sm text-neutral-600">Missing parameters: {missing.join(", ")}.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-page flex min-h-dvh max-w-xl items-center py-8 sm:py-12">
      <ConsentClient
        params={params}
        account={{ name: account.name, email: account.email }}
      />
    </main>
  );
}
