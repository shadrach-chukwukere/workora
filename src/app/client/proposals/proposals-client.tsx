"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import {
  Icon,
  Search01Icon,
  StarIcon,
  Tick02Icon,
  MultiplicationSignIcon,
  HandshakeIcon,
} from "@/lib/icons";
import { PROPOSAL_STATUS_META } from "@/lib/constants";
import { formatMoney, formatRelative } from "@/lib/format";
import type { ProposalStatus } from "@/lib/types";

export interface ReceivedProposal {
  id: string;
  project_id: string;
  project_title: string;
  project_status: string;
  cover_letter: string;
  bid_type: "fixed" | "hourly";
  bid_amount_minor: string | number;
  duration_days: number | null;
  status: ProposalStatus;
  submitted_at: string;
  freelancer_id: string;
  freelancer_name: string;
  freelancer_image: string | null;
  freelancer_headline: string | null;
  rating_avg: string | null;
  completed_count: number | null;
}

function ProposalsInner({ proposals }: { proposals: ReceivedProposal[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("projectId") ?? "all";

  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState(projectFilter);
  const [status, setStatus] = useState<"all" | ProposalStatus>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(projectFilter);
  }, [projectFilter]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of proposals) {
      if (p.project_id) seen.set(p.project_id, p.project_title);
    }
    return [{ value: "all", label: "All projects" }, ...Array.from(seen, ([value, label]) => ({ value, label }))];
  }, [proposals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals
      .filter((p) => (projectId === "all" ? true : p.project_id === projectId))
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => {
        if (!q) return true;
        return (
          p.freelancer_name.toLowerCase().includes(q) ||
          (p.freelancer_headline ?? "").toLowerCase().includes(q) ||
          p.project_title.toLowerCase().includes(q) ||
          p.cover_letter.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  }, [proposals, projectId, status, query]);

  const acceptProposal = acceptTarget ? proposals.find((p) => p.id === acceptTarget) : undefined;

  async function runAction(id: string, kind: "shortlist" | "reject" | "accept", successMessage: string) {
    if (actionPending) return;
    setActionPending(id);
    try {
      const res = await fetch(`${process.env.API_URL}/api/v1/proposals/${encodeURIComponent(id)}/${kind}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("That did not work", { description: body?.message ?? "The server rejected the action." });
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("That did not work", { description: "Network error. Please try again." });
    } finally {
      setActionPending(null);
    }
  }

  function confirmAccept() {
    if (!acceptProposal) return;
    setAcceptTarget(null);
    void runAction(acceptProposal.id, "accept", "Offer sent - contract opened");
  }

  function shortlist(p: ReceivedProposal) {
    void runAction(p.id, "shortlist", `Shortlisted ${p.freelancer_name.split(" ")[0]}. They will see this on their proposals board.`);
  }

  function decline(p: ReceivedProposal) {
    void runAction(p.id, "reject", `Declined ${p.freelancer_name.split(" ")[0]}. They will be notified.`);
  }

  const inboxIsEmpty = proposals.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proposals desk"
        description="Evaluate bids on your listings. Accepting releases the brief; nothing else happens until both sides confirm."
      />

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search01Icon} size={16} strokeWidth={1.8} />
          </span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search freelancers, projects or keywords"
            aria-label="Search proposals"
            className="pl-9"
          />
        </div>
        <Select ariaLabel="Filter by project" value={projectId} onChange={setProjectId} options={projectOptions} className="sm:w-56" />
        <Select
          ariaLabel="Filter by status"
          value={status}
          onChange={(v) => setStatus(v as typeof status)}
          className="sm:w-44"
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "shortlisted", label: "Shortlisted" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
            { value: "withdrawn", label: "Withdrawn" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        inboxIsEmpty ? (
          <EmptyState
            title="No proposals yet"
            description="When freelancers apply to your listings, they appear here. Share the listing to get the first bids in."
          />
        ) : (
          <EmptyState
            title="No proposals match"
            description="Try a different search, project or status filter."
          />
        )
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((proposal) => {
            const isExpanded = Boolean(expanded[proposal.id]);
            const isPending = proposal.status === "pending";
            const pending = actionPending === proposal.id;
            const rating = proposal.rating_avg === null ? null : Number(proposal.rating_avg);
            const durationWeeks = proposal.duration_days ? Math.round(proposal.duration_days / 7) : null;
            return (
              <li key={proposal.id} className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <Avatar src={proposal.freelancer_image ?? undefined} name={proposal.freelancer_name} size="lg" alt="" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{proposal.freelancer_name}</p>
                        <StatusBadge status={proposal.status} meta={PROPOSAL_STATUS_META} />
                        {rating !== null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <Icon icon={StarIcon} size={12} strokeWidth={1.8} />
                            {rating.toFixed(1)}
                            <span className="font-normal text-neutral-400">· {proposal.completed_count ?? 0} jobs</span>
                          </span>
                        ) : null}
                      </div>
                      {proposal.freelancer_headline ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{proposal.freelancer_headline}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-neutral-400">
                        On <span className="font-medium text-neutral-600">{proposal.project_title}</span> · submitted {formatRelative(proposal.submitted_at)}
                      </p>
                      <p className={`mt-2 max-w-2xl whitespace-pre-line text-[13px] leading-relaxed text-neutral-600 ${isExpanded ? "" : "line-clamp-3"}`}>
                        {proposal.cover_letter}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [proposal.id]: !isExpanded }))}
                        className="mt-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "Show less" : "Read full"}
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                    <div className="text-left lg:text-right">
                      <p className="text-lg font-semibold tracking-tight text-neutral-900">
                        {formatMoney(Number(proposal.bid_amount_minor) / 100)}
                        {proposal.bid_type === "hourly" ? <span className="text-sm font-medium text-neutral-500"> /hr</span> : null}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {proposal.bid_type === "fixed" ? "fixed price" : "hourly rate"}
                        {durationWeeks !== null ? ` · ${durationWeeks} ${durationWeeks === 1 ? "week" : "weeks"}` : ""}
                      </p>
                    </div>
                    {isPending ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" disabled={pending} onClick={() => shortlist(proposal)}>
                          <Icon icon={Tick02Icon} size={14} strokeWidth={2} />
                          Shortlist
                        </Button>
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => decline(proposal)}>
                          <Icon icon={MultiplicationSignIcon} size={14} strokeWidth={2} />
                          Decline
                        </Button>
                        <Button size="sm" disabled={pending} onClick={() => setAcceptTarget(proposal.id)}>
                          <Icon icon={HandshakeIcon} size={14} strokeWidth={1.8} />
                          Accept
                        </Button>
                      </div>
                    ) : proposal.status === "shortlisted" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => decline(proposal)}>
                          <Icon icon={MultiplicationSignIcon} size={14} strokeWidth={2} />
                          Decline
                        </Button>
                        <Button size="sm" disabled={pending} onClick={() => setAcceptTarget(proposal.id)}>
                          <Icon icon={HandshakeIcon} size={14} strokeWidth={1.8} />
                          Accept
                        </Button>
                      </div>
                    ) : proposal.status === "accepted" ? (
                      <Badge tone="success">Contract opened</Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={acceptTarget !== null}
        onClose={() => setAcceptTarget(null)}
        title={`Accept proposal from ${acceptProposal?.freelancer_name ?? "this freelancer"}?`}
        description="Accepting opens a contract with this freelancer and moves the project to in progress. Funding happens from Contracts."
        confirmLabel="Accept proposal"
        tone="brand"
        onConfirm={confirmAccept}
      />
    </div>
  );
}

export function ProposalsClient({ proposals }: { proposals: ReceivedProposal[] }) {
  return <ProposalsInner proposals={proposals} />;
}
