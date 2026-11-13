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
import {
  Alert02Icon,
  ArrowRight02Icon,
  Icon,
  ShieldCheckIcon,
  StarIcon,
} from "@/lib/icons";
import { formatDateShort, formatMoney, formatRelative } from "@/lib/format";
import { MILESTONE_STATUS_META } from "@/lib/constants";

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
  viewer_role?: "client" | "freelancer";
  counterpart?: { id: string; name: string | null; image: string | null; company_name?: string | null } | null;
  milestones: { total: number; paid: number; total_amount_minor: string | number; paid_amount_minor: string | number };
  milestoneRows?: MilestoneRow[];
}

type MilestoneStatus = MilestoneRow["status"];

const MILESTONE_META: Record<MilestoneStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "brand" }> = {
  ...MILESTONE_STATUS_META,
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const CONTRACT_STATUS_META: Record<ContractItem["status"], { label: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  paused: { label: "Paused", tone: "warning" },
  disputed: { label: "Disputed", tone: "danger" },
};

export function ContractsClient({ initialContracts }: { initialContracts: ContractItem[] }) {
  const router = useRouter();
  const [contracts] = useState<ContractItem[]>(initialContracts);
  const [approveTarget, setApproveTarget] = useState<{ contractId: string; milestoneId: string; amountMinor: number; title: string } | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<{ contractId: string; milestoneId: string; title: string } | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [actionPending, setActionPending] = useState(false);

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
        toast.success(`Milestone approved. ${formatMoney(approveTarget.amountMinor / 100)} moved from escrow to the freelancer.`);
        setApproveTarget(null);
        router.refresh();
      } else {
        toast.error("Could not approve", { description: result.message ?? "Only milestones in review can be approved." });
      }
    } catch {
      toast.error("Could not approve", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  async function requestRevisionConfirmed() {
    if (!revisionTarget || actionPending) return;
    const note = revisionNote.trim();
    if (!note) {
      toast.error("Add a note for the freelancer describing what needs to change.");
      return;
    }
    setActionPending(true);
    try {
      const result = await postAction(
        `/api/v1/contracts/${encodeURIComponent(revisionTarget.contractId)}/milestones/${encodeURIComponent(revisionTarget.milestoneId)}/request-revision`,
        { note },
      );
      if (result.ok) {
        toast.success("Revision requested. The freelancer has been notified.");
        setRevisionTarget(null);
        setRevisionNote("");
        router.refresh();
      } else {
        toast.error("Could not request a revision", { description: result.message ?? "Only milestones in review can be sent back." });
      }
    } catch {
      toast.error("Could not request a revision", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contracts"
        description="Active work with your freelancers, escrow included. Approvals release funds and are final."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active contracts" value={String(active.length)} hint="Work currently in flight" />
        <StatCard label="In escrow" value={formatMoney(escrowTotalMinor / 100)} hint="Funded milestones not yet released" />
        <StatCard label="Paid to date" value={formatMoney(paidTotalMinor / 100)} hint="Across every contract you have run" />
        <StatCard
          label="Awaiting your review"
          value={String(awaitingReviewCount)}
          hint="Deliverables the freelancer submitted"
        />
      </div>

      {active.map((contract) => {
        const milestones = contract.milestoneRows ?? [];
        const total = milestones.length;
        const paid = milestones.filter((m) => m.status === "paid").length;
        const paidAmountMinor = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount_minor), 0);
        const awaiting = milestones.find((m) => m.status === "in_review");
        const contractEscrowMinor = milestones
          .filter((m) => m.status === "funded" || m.status === "in_review" || m.status === "approved")
          .reduce((s, m) => s + Number(m.amount_minor), 0);
        const title = contract.project?.title ?? contract.title_snapshot;
        const counterpartName = contract.counterpart?.name ?? "Freelancer";
        const counterpartFirst = counterpartName.split(" ")[0];
        return (
          <section key={contract.id} className="card overflow-hidden">
            {/* Contract header */}
            <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={contract.counterpart?.image ?? undefined} name={counterpartName} size="md" alt="" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-neutral-400">
                    {contract.id} · started {formatDateShort(contract.started_at)}
                  </p>
                  <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
                  <p className="text-xs text-neutral-500">
                    {counterpartName} · {formatMoney(Number(contract.total_minor) / 100)} total
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32">
                  <Progress value={total === 0 ? 0 : Math.round((paid / total) * 100)} />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {paid} of {total} milestones paid
                  </p>
                </div>
                <Badge tone={CONTRACT_STATUS_META[contract.status]?.tone ?? "neutral"}>
                  {CONTRACT_STATUS_META[contract.status]?.label ?? contract.status}
                </Badge>
              </div>
            </div>

            {/* Banner */}
            {awaiting ? (
              <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3.5">
                <Icon icon={Alert02Icon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-amber-900">Deliverable awaiting your review</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                    {awaiting.title} · submitted {awaiting.in_review_at ? formatRelative(awaiting.in_review_at) : formatRelative(awaiting.updated_at)}.
                    Approve to release {formatMoney(Number(awaiting.amount_minor) / 100)} from escrow.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 border-b border-brand-100 bg-brand-50 px-5 py-3.5">
                <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <p className="text-[13px] font-semibold text-brand-900">{formatMoney(contractEscrowMinor / 100)} secured via your payment provider</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-brand-800">
                    Funds stay in escrow until you approve a milestone. Nothing releases automatically while work is open.
                  </p>
                </div>
              </div>
            )}

            {/* Milestones */}
            {milestones.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-500">No milestones yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {milestones.map((milestone) => (
                  <li key={milestone.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-neutral-900">{milestone.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {milestone.due_date ? `Due ${formatDateShort(milestone.due_date)} · ` : ""}
                        {formatMoney(Number(milestone.amount_minor) / 100)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <StatusBadge status={milestone.status} meta={MILESTONE_META} />
                      {milestone.status === "in_review" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRevisionTarget({ contractId: contract.id, milestoneId: milestone.id, title: milestone.title });
                              setRevisionNote("");
                            }}
                          >
                            Request revision
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              setApproveTarget({
                                contractId: contract.id,
                                milestoneId: milestone.id,
                                amountMinor: Number(milestone.amount_minor),
                                title: milestone.title,
                              })
                            }
                          >
                            <Icon icon={ShieldCheckIcon} size={15} strokeWidth={1.8} />
                            Approve
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Action row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
              <Link href="/client/messages" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                Message {counterpartFirst}
                <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
              </Link>
              <p className="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-500">
                <span aria-hidden className="size-2 rounded-full bg-neutral-300" />
                {paidAmountMinor > 0 ? `${formatMoney(paidAmountMinor / 100)} paid so far` : "Nothing paid yet"}
              </p>
            </div>
          </section>
        );
      })}
      {active.length === 0 ? (
        <p className="card px-5 py-6 text-sm text-neutral-500">
          No active contracts. Accept a proposal from{" "}
          <Link href="/client/proposals" className="font-medium text-brand-700 hover:text-brand-800">Proposals</Link> to get started.
        </p>
      ) : null}

      {/* Completed */}
      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-5 py-4 text-sm font-semibold text-neutral-900 marker:hidden group-open:border-neutral-100">
          <span>Completed ({past.length})</span>
          <span className="text-xs font-medium text-brand-700">Toggle</span>
        </summary>
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {past.length === 0 ? <li className="px-5 py-4 text-sm text-neutral-500">No completed contracts yet.</li> : null}
          {past.map((contract) => {
            const title = contract.project?.title ?? contract.title_snapshot;
            const counterpartName = contract.counterpart?.name ?? "Freelancer";
            return (
              <li key={contract.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-neutral-400">
                    {contract.id} · completed{contract.ended_at ? ` ${formatDateShort(contract.ended_at)}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {counterpartName} · {formatMoney(Number(contract.total_minor) / 100)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button href="/client/reviews" variant="secondary" size="sm">
                    <Icon icon={StarIcon} size={14} strokeWidth={1.8} />
                    Leave a review
                  </Button>
                  <StatusBadge status={contract.status} meta={CONTRACT_STATUS_META} />
                </div>
              </li>
            );
          })}
        </ul>
      </details>

      {/* Cancelled */}
      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-5 py-4 text-sm font-semibold text-neutral-900 marker:hidden group-open:border-neutral-100">
          <span>Cancelled ({cancelled.length})</span>
          <span className="text-xs font-medium text-brand-700">Toggle</span>
        </summary>
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {cancelled.length === 0 ? <li className="px-5 py-4 text-sm text-neutral-500">No cancelled contracts.</li> : null}
          {cancelled.map((contract) => {
            const title = contract.project?.title ?? contract.title_snapshot;
            const counterpartName = contract.counterpart?.name ?? "Freelancer";
            return (
              <li key={contract.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Monogram name={title} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {contract.id} · {counterpartName}
                  </p>
                </div>
                <StatusBadge status="cancelled" meta={{ cancelled: { label: "Cancelled", tone: "danger" } }} />
              </li>
            );
          })}
        </ul>
      </details>

      {/* Approve confirm */}
      <ConfirmDialog
        open={approveTarget !== null}
        onClose={() => (actionPending ? undefined : setApproveTarget(null))}
        loading={actionPending}
        title={`Approve and release ${approveTarget ? formatMoney(approveTarget.amountMinor / 100) : ""}?`}
        description="Funds move from escrow to the freelancer. Approval is final."
        confirmLabel="Approve and release"
        tone="brand"
        onConfirm={approveMilestoneConfirmed}
      />

      {/* Request revision */}
      <Modal
        open={revisionTarget !== null}
        onClose={() => (actionPending ? undefined : setRevisionTarget(null))}
        title="Request a revision"
        description={revisionTarget ? `What needs to change on "${revisionTarget.title}"?` : undefined}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setRevisionTarget(null)} disabled={actionPending}>
              Cancel
            </Button>
            <Button size="md" onClick={requestRevisionConfirmed} loading={actionPending}>
              Send to freelancer
            </Button>
          </>
        }
      >
        <Field label="Note for the freelancer" required hint="Be specific: what to change, and what done looks like.">
          <Textarea
            rows={5}
            autoFocus
            value={revisionNote}
            onChange={(event) => setRevisionNote(event.target.value)}
            placeholder="e.g. The retention chart uses the wrong cohort window. Please rebuild it with the 30-day cohort and resubmit."
          />
        </Field>
      </Modal>
    </div>
  );
}
