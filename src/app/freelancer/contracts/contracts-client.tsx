"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/ui/logo";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Progress } from "@/components/ui/progress";
import { formatDateShort, formatMoney } from "@/lib/format";
import {
  HandshakeIcon,
  Icon,
  ShieldCheckIcon,
  Tick02Icon,
} from "@/lib/icons";

export interface MilestoneRow {
  id: string;
  title: string;
  amount_minor: number;
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
  total_minor: number;
  currency: string;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
  started_at: string;
  ended_at: string | null;
  created_at: string;
  project?: { id: string; title: string } | null;
  counterpart?: { id: string; name: string | null; image: string | null; company_name?: string | null } | null;
  milestones: { total: number; paid: number; total_amount_minor: number; paid_amount_minor: number };
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

export function ContractsClient({ initialContracts }: { initialContracts: ContractItem[] }) {
  const router = useRouter();
  const [contracts] = useState(() => initialContracts.map((c) => ({ ...c, milestoneRows: c.milestoneRows?.map((m) => ({ ...m })) })));
  const [submitTarget, setSubmitTarget] = useState<{ contractId: string; milestoneId: string; title: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active = contracts.filter((c) => c.status === "active" || c.status === "paused" || c.status === "disputed");
  const completed = contracts.filter((c) => c.status === "completed");
  const cancelled = contracts.filter((c) => c.status === "cancelled");

  const escrowTotalMinor = active.reduce(
    (sum, c) =>
      sum +
      (c.milestoneRows ?? [])
        .filter((m) => m.status === "funded" || m.status === "in_review" || m.status === "approved")
        .reduce((s, m) => s + Number(m.amount_minor), 0),
    0,
  );
  const awaitingReviewCount = active.reduce(
    (sum, c) => sum + (c.milestoneRows ?? []).filter((m) => m.status === "in_review").length,
    0,
  );

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
                      <Link
                        href={`/project/${contract.project_id}`}
                        className="text-sm font-semibold leading-snug text-neutral-900 hover:text-brand-800"
                      >
                        {title}
                      </Link>
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
                    <p className="text-sm font-semibold text-neutral-900">{formatMoney(paidTotalMinor / 100)}</p>
                    <p className="text-xs text-neutral-400">of {formatMoney(Number(contract.total_minor) / 100)} paid</p>
                  </div>
                </div>
                {milestones.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-neutral-500">No milestones yet.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {milestones.map((milestone) => (
                      <li key={milestone.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-800">{milestone.title}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {milestone.due_date ? `Due ${formatDateShort(milestone.due_date)} · ` : ""}
                            {formatMoney(Number(milestone.amount_minor) / 100)}
                          </p>
                          {milestone.status === "in_review" ? (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                              Client has 5 business days to review
                            </p>
                          ) : null}
                        </div>
                        <StatusBadge status={milestone.status} meta={MILESTONE_STATUS_META} />
                        {milestone.status === "funded" ? (
                          <Button
                            size="sm"
                            onClick={() => setSubmitTarget({ contractId: contract.id, milestoneId: milestone.id, title: milestone.title })}
                          >
                            Submit for review
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Completed */}
      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-5 py-4 text-sm font-semibold text-neutral-900 marker:hidden group-open:border-neutral-100">
          <span>Completed ({completed.length})</span>
          <span className="text-xs font-medium text-brand-700">Toggle</span>
        </summary>
        <ul className="divide-y divide-neutral-100">
          {completed.length === 0 ? (
            <li className="px-5 py-4 text-sm text-neutral-500">No completed contracts yet.</li>
          ) : null}
          {completed.map((contract) => {
            const title = contract.project?.title ?? contract.title_snapshot;
            const counterpartName = contract.counterpart?.company_name ?? contract.counterpart?.name ?? "Client";
            return (
              <li key={contract.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Monogram name={title} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {contract.id} · {counterpartName}{" "}
                    {contract.ended_at ? `· completed ${formatDateShort(contract.ended_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Avatar src={contract.counterpart?.image ?? undefined} name={counterpartName} size="xs" alt="" />
                  <p className="text-sm font-semibold text-neutral-900">{formatMoney(Number(contract.total_minor) / 100)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </details>

      {/* Cancelled */}
      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-5 py-4 text-sm font-semibold text-neutral-900 marker:hidden group-open:border-neutral-100">
          <span>Cancelled ({cancelled.length})</span>
          <span className="text-xs font-medium text-brand-700">Toggle</span>
        </summary>
        <ul className="divide-y divide-neutral-100">
          {cancelled.length === 0 ? (
            <li className="px-5 py-4 text-sm text-neutral-500">No cancelled contracts yet.</li>
          ) : null}
          {cancelled.map((contract) => {
            const title = contract.project?.title ?? contract.title_snapshot;
            const counterpartName = contract.counterpart?.company_name ?? contract.counterpart?.name ?? "Client";
            return (
              <li key={contract.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Monogram name={title} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {contract.id} · {counterpartName} · started {formatDateShort(contract.started_at)}
                  </p>
                </div>
                <StatusBadge status="cancelled" meta={{ cancelled: { label: "Cancelled", tone: "danger" } }} />
              </li>
            );
          })}
        </ul>
      </details>

      <ConfirmDialog
        open={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title="Submit milestone for review?"
        description={`"${submitTarget?.title ?? ""}" will move to the client's review queue. You can still make changes if they request a revision.`}
        confirmLabel="Submit for review"
        onConfirm={submitForReview}
      />
    </div>
  );
}
