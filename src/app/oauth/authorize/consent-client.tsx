"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { Icon, ShieldCheckIcon } from "@/lib/icons";

const SCOPE_LABELS: Record<string, string> = {
  "freelancers:read": "Search freelancers and view public profiles",
  "projects:read": "Search projects and view public project details",
  "profile:read": "Read your own profile and account summary",
  "proposals:read": "Read your submitted proposals",
  "proposals:write": "Prepare and submit your proposals",
  "jobs:read": "Read your projects",
  "jobs:write": "Create job drafts and publish your projects",
  "invitations:read": "Read project invitations",
  "invitations:write": "Accept or decline invitations",
  "contracts:read": "Read contracts you are a party to",
  "notifications:read": "Read your notifications",
  "connections:read": "Read your connections",
};

export function ConsentClient({
  params,
  account,
}: {
  params: Record<string, string>;
  account: { name: string; email: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopes = (params.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approved: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...params, approved }),
      });
      const body = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
        error_description?: string;
        message?: string;
      } | null;
      if (!response.ok || !body?.redirectUrl) {
        throw new Error(body?.error_description ?? body?.message ?? "Authorization could not be completed");
      }
      window.location.assign(body.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authorization could not be completed");
      setBusy(false);
    }
  }

  return (
    <section className="card w-full overflow-hidden">
      <div className="border-b border-neutral-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Workora authorization</p>
            <h1 className="text-lg font-semibold text-neutral-900">Connect an AI assistant</h1>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-6">
        <p className="text-sm leading-relaxed text-neutral-600">
          An AI assistant is asking to access your Workora account. Review the permissions below. You can revoke this
          connection at any time from AI Integrations in your settings.
        </p>

        <div className="rounded-lg bg-neutral-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-neutral-900">{account.name}</p>
          <p className="truncate text-xs text-neutral-500">{account.email}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Requested permissions</p>
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {scopes.map((scope) => (
              <li key={scope} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 self-start rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-medium text-brand-800">
                  {scope}
                </span>
                <span className="text-xs text-neutral-600">{SCOPE_LABELS[scope] ?? "Workora permission"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3 text-xs leading-relaxed text-neutral-600">
          <Icon icon={ShieldCheckIcon} size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-700" />
          <p>
            No passwords or payment details are shared. Write actions such as publishing a job or submitting a proposal
            require a separate, explicit confirmation each time.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void decide(false)} className="w-full sm:w-auto">
            Decline
          </Button>
          <Button size="md" disabled={busy} onClick={() => void decide(true)} className="w-full sm:w-auto">
            {busy ? "Connecting…" : "Allow access"}
          </Button>
        </div>
      </div>
    </section>
  );
}
