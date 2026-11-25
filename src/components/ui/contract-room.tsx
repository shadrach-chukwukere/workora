"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Progress } from "@/components/ui/progress";
import { Monogram } from "@/components/ui/logo";
import { formatDateShort, formatMoney } from "@/lib/format";
import { MILESTONE_STATUS_META } from "@/lib/constants";
import {
  Alert02Icon,
  ArrowRight02Icon,
  Icon,
  ShieldCheckIcon,
  StarIcon,
} from "@/lib/icons";

export interface MilestoneRow {
  id: string;
  title: string;
  description?: string;
  amount_minor: string | number;
  status: "upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid" | "cancelled";
  due_date: string | null;
  in_review_at: string | null;
  updated_at: string;
}

export interface ContractItem {
  id: string;
  project_id: string;
  proposal_id: string | null;
  title_snapshot: string;
  total_minor: string | number;
  currency: string;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
  started_at: string;
  ended_at: string | null;
  created_at: string;
  project?: { id: string; title: string } | null;
  counterpart?: { id: string; name: string | null; image: string | null; company_name?: string | null } | null;
  milestones: { total: number; paid: number; total_amount_minor: string | number; paid_amount_minor: string | number };
  milestoneRows?: MilestoneRow[];
}

type MilestoneStatus = MilestoneRow["status"];

const MILESTONE_STATUS_META: Record<MilestoneStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "brand" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  funded: { label: "Funded", tone: "brand" },
  in_review: { label: "In review", tone: "warning" },
  revision: { label: "Revision requested", tone: "danger" },
  approved: { label: "Approved", tone: "success" },
  paid: { label: "Paid", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const CONTRACT_STATUS_META: Record<ContractItem["status"], { label: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  paused: { label: "Paused", tone: "warning" },
  disputed: { label: "Disputed", tone: "danger" },
};

function formatMilestoneMeta(status: MilestoneStatus) {
  const meta = MILESTONE_STATUS_META[status];
  return meta ? `<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-${meta.tone}-600}">${meta.label}</span>` : "";
}

export function ContractsClient({
  initialContracts,
  onContractClick,
  onMilestoneSubmit,
  onMilestoneApprove,
  onMilestoneRequestRevision,
  onMilestoneFund,
  onCancelContract,
}: {
  initialContracts: ContractItem[];
  onContractClick?: (contract: ContractItem) => void;
  onMilestoneSubmit?: (contractId: string, milestoneId: string, title: string) => void;
  onMilestoneApprove?: (contractId: string, milestoneId: string) => void;
  onMilestoneRequestRevision?: (contractId: string, milestoneId: string, note: string) => void;
  onMilestoneFund?: (contractId: string, milestoneId: string, amountMinor: number) => void;
  onCancelContract?: (contractId: string, reason: string) => void;
}) {
  const router = useRouter();
  const [contracts] = useState<ContractItem[]>(initialContracts.map((c) => ({ ...c, milestoneRows: c.milestoneRows?.map((m) => ({ ...m })) })));
  const [approveTarget, setApproveTarget] = useState<{ contractId: string; milestoneId: string; amountMinor: number; title: string } | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<{ contractId: string; milestoneId: string; title: string } | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [fundTarget, setFundTarget] = useState<{ contractId: string; milestoneId: string; title: string; amountMinor: number } | null>(null);

  const active = contracts.filter((c) => c.status === "active" || c.status === "paused" || c.status === "disputed");
  const past = contracts.filter((c) => c.status === "completed");
  const cancelled = contracts.filter((c) => c.status === "cancelled");

  const escrowTotalMinor = active.reduce(
    (sum, c) =>
      sum +
      (c.milestoneRows ?? [])
        .filter((m) => m.status === "funded" || m.status === "in_review" || m.status === "approved")
        .reduce((s, m) => s + Number(m.amount_minor), 0),
    0,
  );
  const paidTotalMinor = contracts.reduce(
    (sum, c) =>
      sum +
      (c.milestoneRows ?? [])
        .filter((m) => m.status === "paid")
        .reduce((s, m) => s + Number(m.amount_minor), 0),
    0,
  );
  const awaitingReviewCount = active.reduce(
    (sum, c) => sum + (c.milestoneRows ?? []).filter((m) => m.status === "in_review").length,
    0,
  );

  async function postAction(path: string, body?: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      router.push("/login");
      return { ok: false };
    }
    const envelope = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    return { ok: res.ok && Boolean(envelope?.success), message: envelope?.message };
  }

  async function approveMilestoneConfirmed() {
    if (!approveTarget || actionPending) return;
    setActionPending(true);
    try {
      const result = await postAction(
        `/api/v1/contracts/${encodeURIComponent(approveTarget.contractId)}/milestones/${encodeURIComponent(approveTarget.milestoneId)}/approve`,
      );
      if (result.ok) {
        toast.success(`Milestone released. ${formatMoney(approveTarget.amountMinor / 100)} was sent to the freelancer's Paystack balance.`);
        setApproveTarget(null);
        router.refresh();
      } else {
        toast.error("Could not release funds", { description: result.message ?? "Check the milestone and payout setup, then try again." });
      }
    } catch {
      toast.error("Could not approve", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  async function fundMilestone(contract: ContractItem, milestone: MilestoneRow) {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch("/api/v1/payments/initialize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "milestone",
          amountMinor: Number(milestone.amount_minor),
          currency: contract.currency,
          contractId: contract.id,
          milestoneId: milestone.id,
        }),
      });
      const envelope = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: { checkoutUrl?: string };
      } | null;
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      if (!res.ok || !envelope?.success || !envelope.data?.checkoutUrl) {
        toast.error("Could not start secure checkout", {
          description: envelope?.message ?? "Paystack checkout is currently unavailable.",
        });
        return;
      }
      window.location.assign(envelope.data.checkoutUrl);
    } catch {
      toast.error("Could not start secure checkout", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  async function submitForReview() {
    if (!submitTarget || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${encodeURIComponent(submitTarget.contractId)}/milestones/${encodeURIComponent(submitTarget.milestoneId)}/submit`,
        { method: "POST", credentials: "include" },
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Could not submit for review", {
          description: body?.message ?? "Only funded milestones can be submitted.",
        });
        return;
      }
      toast.success("Submitted for client review", {
        description: "The client has 5 business days to approve or request changes.",
      });
      setSubmitTarget(null);
      router.refresh();
    } catch {
      toast.error("Could not submit for review", { description: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelContractConfirmed() {
    if (!actionPending) return;
    const reason = prompt("Enter a reason for cancelling the contract (optional):");
    if (reason === null) return;
    setActionPending(true);
    try {
      const result = await postAction(
        `/api/v1/contracts/${encodeURIComponent(cancelTarget!.contractId)}/cancel`,
        { reason },
      );
      if (result.ok) {
        toast.success("Contract cancelled");
        setCancelTarget(null);
        router.refresh();
      } else {
        toast.error("Could not cancel contract", { description: result.message ?? "Unknown error." });
      }
    } catch {
      toast.error("Could not cancel contract", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contracts"
        description="Funded milestones, work in review and finished engagements."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Contracts" }]}
      />

      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active escrow"
          value={formatMoney(escrowTotalMinor / 100)}
          hint="Milestones funded and waiting on delivery or approval"
          icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Milestones in review"
          value={String(awaitingReviewCount)}
          hint="Submitted by you, awaiting client approval"
          icon={<Icon icon={HandshakeIcon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Completed contracts"
          value={String(completed.length)}
          hint="All milestones paid out"
          icon={<Icon icon={Tick02Icon} size={16} strokeWidth={1.8} />}
        />
      </div>

      {/* Active contracts */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Active</h2>
        {active.length === 0 ? (
          <p className="card px-5 py-6 text-sm text-neutral-500">No active contracts right now.</p>
        ) : (
          active.map((contract) => {
            const milestones = contract.milestoneRows ?? [];
            const total = milestones.length;
            const paid = milestones.filter((m) => m.status === "paid").length;
            const paidTotalMinor = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount_minor), 0);
            const title = contract.project?.title ?? contract.title_snapshot;
            const counterpartName = contract.counterpart?.company_name ?? contract.counterpart?.name ?? "Client";
            return (
              <article key={contract.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Monogram name={title} size={40} />
                    <div className="min-w-0">
                      {onContractClick && (
                        <Link
                          href={`#`}
                          onClick={() => onContractClick(contract)}
                          className="text-sm font-semibold leading-snug text-neutral-900 hover:text-brand-800"
                        >
                          {title}
                        </Link>
                      )}
                      {!onContractClick && (
                        <Link
                          href={`/project/${contract.project_id}`}
                          className="text-sm font-semibold leading-snug text-neutral-900 hover:text-brand-800"
                        >
                          {title}
                        </Link>
                      )}
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {contract.id} · started {formatDateShort(contract.started_at)} · {counterpartName}
                      </p>
                      <div className="mt-2.5 flex w-44 items-center gap-2">
                        <Progress value={total === 0 ? 0 : Math.round((paid / total) * 100)} className="flex-1" />
                        <span className="text-[11px] tabular-nums text-neutral-500">{paid}/{total}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={contract.status} meta={{ ...CONTRACT_STATUS_META[contract.status] }} />
                  </div>
                </div>
                <div className="px-5 py-3">
                  {milestones.map((milestone) => {
                    const paid = milestones.filter((m) => m.status === "paid").length;
                    const paidTotal = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount_minor), 0);
                    const pending = milestones.filter((m) => m.status !== "paid" && m.status !== "cancelled").length;
                    return (
                      <div key={milestone.id} className="flex items-center gap-3 px-5 py-2 border-b border-neutral-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800">{milestone.title}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {milestone.due_date ? `Due ${formatDateShort(milestone.due_date)} · ` : ""}
                            {formatMilestoneMeta(milestone.status)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] tabular-nums text-neutral-500">{formatMoney(Number(milestone.amount_minor) / 100)}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {milestone.status === "upcoming" && onMilestoneSubmit && (
                            <Button
                              size="sm"
                              onClick={() => onMilestoneSubmit(contract.id, milestone.id, milestone.title)}
                              disabled={actionPending}
                            >
                              Submit
                            </Button>
                          )}
                          {milestone.status === "funded" && onMilestoneApprove && (
                            <Button
                              size="sm"
                              onClick={() => setApproveTarget({ contractId: contract.id, milestoneId: milestone.id, amountMinor: Number(milestone.amount_minor), title: milestone.title })}
                              className="text-xs"
                            >
                              Approve
                            </Button>
                          )}
                          {milestone.status === "in_review" && onMilestoneRequestRevision && (
                            <Button
                              size="sm"
                              onClick={() => setRevisionTarget({ contractId: contract.id, milestoneId: milestone.id, title: milestone.title })}
                              className="text-xs"
                            >
                              Revision
                            </Button>
                          )}
                          {milestone.status === "revision" && onMilestoneFund && (
                            <Button
                              size="sm"
                              onClick={() => setFundTarget({ contractId: contract.id, milestoneId: milestone.id, title: milestone.title, amountMinor: Number(milestone.amount_minor) })}
                              className="text-xs"
                            >
                              Pay
                            </Button>
                          )}
                          {milestone.status === "approved" && onMilestoneFund && (
                            <Button
                              size="sm"
                              onClick={() => setFundTarget({ contractId: contract.id, milestoneId: milestone.id, title: milestone.title, amountMinor: Number(milestone.amount_minor) })}
                              className="text-xs"
                            >
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {milestones.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-neutral-500">No milestones yet.</p>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Cancelled contracts */}
      {cancelled.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Cancelled</h2>
          <ul className="divide-y divide-neutral-100">
            {cancelled.map((contract) => {
              const title = contract.project?.title ?? contract.title_snapshot;
              const counterpartName = contract.counterpart?.company_name ?? contract.counterpart?.name ?? "Client";
              return (
                <li key={contract.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Monogram name={title} size={40} />
                    <div className="min-w-0">
                      <Link
        href={`/project/${contract.project_id}`}
        className="text-sm font-semibold leading-snug text-neutral-900 hover:text-brand-800">
        {title}
      </Link>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {contract.id} · started {formatDateShort(contract.started_at)} · {counterpartName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status="cancelled" meta={{ label: "Cancelled", tone: "danger" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}