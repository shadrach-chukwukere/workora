"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { PROPOSAL_STATUS_META } from "@/lib/constants";
import { formatDateShort, formatMoney, formatRelative } from "@/lib/format";
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Icon,
  Message01Icon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ProposalStatus } from "@/lib/types";

export interface ProposalItem {
  id: string;
  status: ProposalStatus;
  cover_letter: string;
  bid_type: "fixed" | "hourly";
  bid_amount_minor: number;
  duration_days: number;
  submitted_at: string;
  updated_at: string;
  project: {
    id: string;
    title: string;
    summary: string | null;
    status: string;
    budget_type: "fixed" | "hourly";
    budget_min_minor: number | null;
    budget_max_minor: number | null;
    currency: string;
    published_at: string | null;
    client_id: string;
  } | null;
  client: {
    id: string;
    name: string | null;
    image: string | null;
    company_name: string | null;
  } | null;
}

type TabId = "all" | ProposalStatus;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

export function ProposalsClient({ initialProposals }: { initialProposals: ProposalItem[] }) {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalItem[]>(() => initialProposals.map((p) => ({ ...p })));
  const [tab, setTab] = useState<TabId>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ProposalItem | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<TabId, number>();
    map.set("all", proposals.length);
    for (const p of proposals) map.set(p.status, (map.get(p.status) ?? 0) + 1);
    return map;
  }, [proposals]);

  const visible = useMemo(
    () =>
      proposals
        .filter((p) => (tab === "all" ? true : p.status === tab))
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    [proposals, tab],
  );

  const pending = proposals.filter((p) => p.status === "pending").length;
  const shortlisted = proposals.filter((p) => p.status === "shortlisted").length;
  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const rejected = proposals.filter((p) => p.status === "rejected").length;
  const decided = accepted + rejected;
  const winRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

  async function withdraw(id: string) {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`${process.env.API_URL}/api/v1/proposals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Could not withdraw proposal", {
          description: body?.message ?? "Only pending or shortlisted proposals can be withdrawn.",
        });
        return;
      }
      setProposals((list) => list.map((p) => (p.id === id ? { ...p, status: "withdrawn" } : p)));
      setWithdrawTarget(null);
      setExpandedId((cur) => (cur === id ? null : cur));
      toast.success("Proposal withdrawn", {
        description: "The client can no longer act on it. Nothing else changes.",
      });
      router.refresh();
    } catch {
      toast.error("Could not withdraw proposal", { description: "Network error. Please try again." });
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your proposals"
        description="Every bid you have sent, where it stands and what the client saw."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Proposals" }]}
        actions={
          <Button href="/freelancer/projects" size="md">
            Find more projects
            <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="In flight"
          value={String(pending + shortlisted)}
          hint={`${pending} pending · ${shortlisted} shortlisted`}
        />
        <StatCard
          label="Accepted"
          value={String(accepted)}
          hint="Proposals that became contracts"
        />
        <StatCard
          label="Win rate"
          value={winRate === null ? "--" : `${winRate}%`}
          hint="Accepted of decided proposals (accepted + rejected)"
        />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Filter proposals by status" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = counts.get(t.id) ?? 0;
          return (
            <Button
              key={t.id}
              role="tab"
              aria-selected={active}
              variant={active ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-3.5",
                  active ? "bg-white/20" : "bg-neutral-100 text-neutral-500",
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">Nothing here yet</p>
          <p className="mt-1 text-sm text-neutral-500">No proposals with this status right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              expanded={expandedId === proposal.id}
              onToggle={() => setExpandedId((cur) => (cur === proposal.id ? null : proposal.id))}
              onWithdraw={() => setWithdrawTarget(proposal)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        title="Withdraw this proposal?"
        description="The client will no longer see your bid as actionable. You can send a new proposal later if the brief is still open."
        confirmLabel="Withdraw proposal"
        tone="danger"
        onConfirm={() => withdrawTarget && withdraw(withdrawTarget.id)}
      />
    </div>
  );
}

function ProposalCard({
  proposal,
  expanded,
  onToggle,
  onWithdraw,
}: {
  proposal: ProposalItem;
  expanded: boolean;
  onToggle: () => void;
  onWithdraw: () => void;
}) {
  const project = proposal.project;
  const client = proposal.client;
  const clientName = client?.name ?? "Client";
  const clientCompany = client?.company_name;
  const positiveOutcome = proposal.status === "shortlisted" || proposal.status === "accepted";
  const bidAmount = Number(proposal.bid_amount_minor) / 100;
  const budgetText = project
    ? project.budget_type === "fixed"
      ? formatMoney(Number(project.budget_max_minor ?? project.budget_min_minor ?? 0) / 100)
      : `${formatMoney(Number(project.budget_min_minor ?? 0) / 100)} - ${formatMoney(Number(project.budget_max_minor ?? 0) / 100)}`
    : null;

  return (
    <li className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <Avatar src={client?.image ?? undefined} name={clientName} size="md" alt="" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{project?.title ?? "Project no longer listed"}</p>
            <StatusBadge status={proposal.status} meta={PROPOSAL_STATUS_META} />
            {positiveOutcome ? (
              <Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} className="text-emerald-600" />
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {clientName}
            {clientCompany ? ` · ${clientCompany}` : ""} · Submitted {formatRelative(proposal.submitted_at)}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-neutral-900">Bid {formatMoney(bidAmount)}</span>
            {budgetText ? <span className="text-xs text-neutral-500">Project budget {budgetText}</span> : null}
            <span className="text-xs text-neutral-500">
              {proposal.bid_type === "fixed" ? "Fixed price" : "Hourly"} · {proposal.duration_days} days
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button variant="secondary" size="sm" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? "Hide details" : "Details"}
          </Button>
          {proposal.status === "pending" ? (
            <Button variant="ghost" size="sm" onClick={onWithdraw} className="text-neutral-500 hover:text-rose-700">
              Withdraw
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Bid breakdown</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-neutral-500">Bid type</dt>
                  <dd className="font-medium text-neutral-900">{proposal.bid_type === "fixed" ? "Fixed price" : "Hourly"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-neutral-500">Total bid</dt>
                  <dd className="font-medium text-neutral-900">{formatMoney(bidAmount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-neutral-500">Timeline</dt>
                  <dd className="font-medium text-neutral-900">{proposal.duration_days} days</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-neutral-500">Submitted</dt>
                  <dd className="font-medium text-neutral-900">{formatDateShort(proposal.submitted_at)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-lg border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                No milestones attached. Timeline is {proposal.duration_days} days for the full scope.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Cover letter</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{proposal.cover_letter}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button href="/freelancer/messages" variant="secondary" size="sm">
                  <Icon icon={Message01Icon} size={14} strokeWidth={1.8} />
                  Message client
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
