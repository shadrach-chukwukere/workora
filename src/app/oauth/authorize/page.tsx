import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionAccount } from "@/components/layout/session-guard";
import { serverApiBase } from "@/lib/api-base";
import { ConsentForm } from "./consent-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authorize AI assistant · Workora",
  description: "Review the permissions an AI assistant is requesting for your Workora account.",
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function safeRedirectHost(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.hash) return null;
    if (url.protocol === "https:") return url.host;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) return url.host;
    return null;
  } catch {
    return null;
  }
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
  const query = await searchParams;
  const raw: Record<string, string> = {
    client_id: one(query.client_id),
    redirect_uri: one(query.redirect_uri),
    response_type: one(query.response_type),
    scope: one(query.scope),
    state: one(query.state),
    code_challenge: one(query.code_challenge),
    code_challenge_method: one(query.code_challenge_method),
  };
  if (one(query.resource)) raw.resource = one(query.resource);

  const redirectHost = safeRedirectHost(raw.redirect_uri);
  const valid =
    raw.client_id.length > 0 &&
    raw.client_id.length <= 2048 &&
    raw.response_type === "code" &&
    raw.scope.length > 0 &&
    raw.state.length > 0 &&
    /^[A-Za-z0-9_-]{43}$/.test(raw.code_challenge) &&
    raw.code_challenge_method === "S256" &&
    redirectHost !== null;

  if (!valid) {
    return (
      <main className="container-page py-12">
        <h1 className="text-2xl font-semibold">Invalid authorization request</h1>
        <p className="mt-3 text-neutral-600">
          The assistant sent an incomplete or unsupported authorization request. Close this page and try again from your assistant.
        </p>
      </main>
    );
  }

  const account = await getSessionAccount();
  if (!account) {
    const next = `/oauth/authorize?${new URLSearchParams(raw).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map((item) => `${item.name}=${item.value}`).join("; ");
  let clientName = raw.client_id;
  try {
    const response = await fetch(`${serverApiBase}/api/v1/oauth/client-info?client_id=${encodeURIComponent(raw.client_id)}`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const info = (await response.json()) as { client_name?: string; redirect_uris?: string[] };
      if (info.client_name) clientName = info.client_name;
      if (info.redirect_uris && !info.redirect_uris.includes(raw.redirect_uri)) {
        return (
          <main className="container-page py-12">
            <h1 className="text-2xl font-semibold">Unregistered redirect address</h1>
            <p className="mt-3 text-neutral-600">This assistant is not registered to receive a code at {redirectHost}.</p>
          </main>
        );
      }
    }
  } catch {
    // Keep the client_id visible; the API revalidates the redirect on submit.
  }

  const scopes = [...new Set(raw.scope.split(/\s+/).filter(Boolean))].slice(0, 20);

  return (
    <main className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-neutral-900">Connect {clientName} to Workora</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You are signed in as {account.email}. Only you can approve this connection. No password, passkey or verification step is skipped.
        </p>
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-neutral-900">Requested permissions</h2>
          <p className="mb-4 mt-1 text-xs text-neutral-500">Each consequential action still needs a separate confirmation.</p>
          <ConsentForm params={raw} clientName={clientName} scopes={scopes} redirectHost={redirectHost!} />
        </div>
      </div>
    </main>
  );
}
