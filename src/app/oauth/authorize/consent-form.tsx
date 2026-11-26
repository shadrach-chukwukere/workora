"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPE_LABELS } from "@/lib/agent-scopes";

interface Props {
  params: Record<string, string>;
  clientName: string;
  scopes: string[];
  redirectHost: string;
}

/** Consent is granted only by an explicit click in the logged-in user's browser. */
export function ConsentForm({ params, clientName, scopes, redirectHost }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/oauth/authorize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...params, approved }),
      });
      const body = (await response.json().catch(() => null)) as { redirectUrl?: string; message?: string; error_description?: string } | null;
      if (!response.ok || !body?.redirectUrl) {
        throw new Error(body?.error_description ?? body?.message ?? "Could not complete authorization");
      }
      window.location.assign(body.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete authorization");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {scopes.map((scope) => (
          <li key={scope} className="rounded-lg border border-neutral-200 px-4 py-3">
            <p className="text-sm font-medium text-neutral-900">{AGENT_SCOPE_LABELS[scope] ?? scope}</p>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">{scope}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-600">
        Workora will send the authorization code to <strong className="font-medium text-neutral-900">{redirectHost}</strong>.
        You can review and revoke this connection any time in{" "}
        <a className="underline" href="/settings/integrations">
          AI integrations
        </a>
        .
      </p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={() => void submit(true)}>
          {busy ? "Connecting…" : `Allow ${clientName}`}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit(false)}>
          Deny
        </Button>
      </div>
    </div>
  );
}
