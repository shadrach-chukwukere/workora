"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, ShieldCheckIcon, TrashIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { AGENT_SCOPE_LABELS } from "@/lib/agent-scopes";

interface Connection {
  id: string;
  clientName: string;
  clientId: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface ConnectionsResponse {
  connections: Connection[];
}

const SCOPE_LABELS = AGENT_SCOPE_LABELS;

function AssistantMark({ kind }: { kind: "chatgpt" | "claude" | "mcp" }) {
  const letters = kind === "chatgpt" ? "AI" : kind === "claude" ? "✳" : "MCP";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
        kind === "mcp" ? "bg-neutral-100 text-neutral-600" : "bg-brand-100 text-brand-800",
      )}
    >
      {letters}
    </span>
  );
}

const CARDS = [
  {
    kind: "chatgpt" as const,
    name: "ChatGPT",
    description:
      "Search Workora talent and projects, and manage drafts, directly from ChatGPT.",
    match: /chatgpt|openai/i,
  },
  {
    kind: "claude" as const,
    name: "Claude",
    description:
      "Connect Claude to your Workora marketplace and work with your account through conversation.",
    match: /claude|anthropic/i,
  },
];

export function IntegrationsClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/oauth/connections", { credentials: "include", cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: ConnectionsResponse; message?: string }
        | null;
      if (!res.ok || !body?.success || !body.data) throw new Error(body?.message ?? "Could not load connections");
      setConnections(body.data.connections ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/oauth/connections/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not disconnect that assistant");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect");
    } finally {
      setBusyId(null);
    }
  }

  const active = connections.filter((c) => !c.revokedAt);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-700" />
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">How connecting works</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Start the connection from your AI assistant. It will open a secure Workora authorization screen where
              you sign in, review the requested permissions, and approve. Connections are per assistant and can be
              revoked here at any time. Workora never shows access tokens in the dashboard.
            </p>
            <Link href="/developers/mcp" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              Read the connection guide →
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {CARDS.map((card) => {
          const matches = active.filter((c) => card.match.test(c.clientName));
          return (
            <section key={card.kind} className="card flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <AssistantMark kind={card.kind} />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-neutral-900">{card.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{card.description}</p>
                </div>
              </div>
              <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                {matches.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                ) : (
                  <span>Not connected — start from {card.name}&apos;s connector settings.</span>
                )}
              </div>
              <div className="mt-auto">
                {matches.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 py-2.5 text-xs text-neutral-500">
                    <span>
                      Connected {new Date(c.createdAt).toLocaleDateString()}
                      {c.lastUsedAt ? ` · last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : ""}
                    </span>
                    <Button
                      variant="danger-outline"
                      size="sm"
                      disabled={busyId === c.id}
                      onClick={() => void revoke(c.id)}
                    >
                      <Icon icon={TrashIcon} size={14} strokeWidth={1.8} />
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <AssistantMark kind="mcp" />
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Other MCP-compatible assistants</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Any client that speaks the Model Context Protocol can connect to Workora&apos;s remote endpoint.
            </p>
          </div>
        </div>
        <code className="mt-4 block break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          https://workora.com/api/mcp
        </code>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-semibold text-neutral-900 sm:px-6">
          Active connections
        </h2>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500 sm:px-6">Loading connections…</p>
        ) : active.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500 sm:px-6">
            No AI assistants are connected to your account yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {active.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{c.clientName}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Connected {new Date(c.createdAt).toLocaleString()}
                    {c.lastUsedAt ? ` · last activity ${new Date(c.lastUsedAt).toLocaleString()}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.scopes.map((scope) => (
                      <span key={scope} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800" title={SCOPE_LABELS[scope] ?? scope}>
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                <Button variant="danger-outline" size="sm" disabled={busyId === c.id} onClick={() => void revoke(c.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
