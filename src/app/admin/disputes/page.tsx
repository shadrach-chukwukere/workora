"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber, formatRelative, labelize } from "@/lib/format";
import {
 Alert02Icon,
 CheckmarkCircle02Icon,
 Icon,
 SearchRemoveIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface DisputeRow {
 id: string;
 contract_id: string;
 title_snapshot: string | null;
 contract_total_minor: string | number;
 opened_by: string;
 opened_by_name: string;
 client_name: string;
 freelancer_name: string;
 status: string;
 reason: string;
 details: string | null;
 amount_minor: string | number | null;
 currency: string;
 resolution: string | null;
 resolution_outcome: string | null;
 opened_at: string;
 resolved_at: string | null;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const TABS = [
 { id: "open", label: "Open" },
 { id: "under_review", label: "Under review" },
 { id: "resolved", label: "Resolved" },
 { id: "withdrawn", label: "Withdrawn" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const OUTCOME_OPTIONS = [
 { value: "freelancer", label: "Freelancer wins" },
 { value: "client", label: "Client wins" },
 { value: "split", label: "Split the difference" },
 { value: "no_action", label: "No action / close" },
];

export default function AdminDisputesPage() {
 const router = useRouter();
 const [items, setItems] = useState<DisputeRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [tab, setTab] = useState<TabId>("open");
 const [resolveTarget, setResolveTarget] = useState<DisputeRow | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await api<{ disputes: DisputeRow[] }>("/api/v1/admin/disputes");
 setItems(data.disputes);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [router]);

 useEffect(() => {
 void load();
 }, [load]);

 const counts = useMemo(() => {
 const list = items ?? [];
 return {
 open: list.filter((d) => d.status === "open").length,
 under_review: list.filter((d) => d.status === "under_review").length,
 resolved: list.filter((d) => d.status === "resolved").length,
 withdrawn: list.filter((d) => d.status === "withdrawn").length,
 };
 }, [items]);

 const visible = useMemo(() => (items ?? []).filter((d) => d.status === tab), [items, tab]);

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Disputes"
 description="Resolution queue for contract disputes: what is open, what is under review and how past cases closed."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Disputes" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Open" value={formatNumber(counts.open)} hint="Awaiting a ruling" />
 <StatCard label="Under review" value={formatNumber(counts.under_review)} hint="Evidence being weighed" />
 <StatCard label="Resolved" value={formatNumber(counts.resolved)} hint="Closed with an outcome" />
 <StatCard label="Withdrawn" value={formatNumber(counts.withdrawn)} hint="Withdrawn by the opener" />
 </div>

 <Tabs
 value={tab}
 ariaLabel="Filter disputes by status"
 onChange={(id) => setTab(id as TabId)}
 items={TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
 />

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load disputes"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 ) : items === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : visible.length === 0 ? (
 <EmptyState
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title={`No ${labelize(tab)} disputes`}
 description={tab === "open" || tab === "under_review" ? "The queue is clear right now." : "Nothing in this bucket yet."}
 />
 ) : (
 <div className="flex flex-col gap-4">
 {visible.map((d) => {
 const actionable = d.status === "open" || d.status === "under_review";
 return (
 <article key={d.id} className="card overflow-hidden">
 <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-mono text-[11px] text-neutral-400">{d.id.slice(0, 8)}</span>
 <Badge tone={d.status === "resolved" ? "success" : d.status === "under_review" ? "brand" : d.status === "open" ? "warning" : "neutral"}>
 {labelize(d.status)}
 </Badge>
 </div>
 <p className="mt-1.5 text-sm font-semibold text-neutral-900">{d.reason}</p>
 {d.details ? <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-neutral-600">{d.details}</p> : null}
 </div>
 <div className="shrink-0 text-right">
 <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">At stake</p>
 <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
 {d.amount_minor == null ? "—" : formatMoney(n(d.amount_minor) / 100)}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
 <div className="min-w-0 text-xs text-neutral-500">
 <p>
 <span className="font-medium text-neutral-700">{d.opened_by_name}</span> opened it · {d.client_name} (client) vs {d.freelancer_name} (freelancer)
 </p>
 <p className="mt-1">
 Contract: {d.title_snapshot ?? d.contract_id.slice(0, 8)} · opened {formatRelative(d.opened_at)}
 </p>
 {d.status === "resolved" && d.resolution ? (
 <p className="mt-2 flex max-w-3xl items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-emerald-900">
 <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.8} />
 <span>
 <span className="font-semibold">Resolution{d.resolution_outcome ? ` (${labelize(d.resolution_outcome)})` : ""}.</span> {d.resolution}
 </span>
 </p>
 ) : null}
 </div>
 {actionable ? (
 <Button size="sm" onClick={() => setResolveTarget(d)}>
 Resolve
 </Button>
 ) : null}
 </div>
 </article>
 );
 })}
 </div>
 )}

 <ResolveModal
 dispute={resolveTarget}
 onClose={() => setResolveTarget(null)}
 onDone={() => {
 setResolveTarget(null);
 void load();
 }}
 />
 </div>
 );
}

function ResolveModal({
 dispute,
 onClose,
 onDone,
}: {
 dispute: DisputeRow | null;
 onClose: () => void;
 onDone: () => void;
}) {
 const [outcome, setOutcome] = useState("no_action");
 const [resolution, setResolution] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [touched, setTouched] = useState(false);

 // Reset the form whenever a new dispute is targeted.
 const [targetId, setTargetId] = useState<string | null>(null);
 const disputeId = dispute?.id ?? null;
 if (targetId !== disputeId) {
 setTargetId(disputeId);
 setOutcome("no_action");
 setResolution("");
 setTouched(false);
 }

 const resolutionValid = resolution.trim().length > 0;

 async function submit() {
 setTouched(true);
 if (!dispute || !resolutionValid) return;
 setSubmitting(true);
 try {
 await api(`/api/v1/disputes/${encodeURIComponent(dispute.id)}/resolve`, {
 method: "POST",
 body: { outcome, resolution: resolution.trim() },
 });
 toast.success("Dispute resolved");
 onDone();
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Resolve failed");
 } finally {
 setSubmitting(false);
 }
 }

 return (
 <Modal
 open={dispute != null}
 onClose={onClose}
 title={dispute ? `Resolve dispute ${dispute.id.slice(0, 8)}` : "Resolve dispute"}
 description="The outcome and note are stored on the dispute and visible to both parties."
 size="md"
 footer={
 <>
 <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
 Cancel
 </Button>
 <Button size="md" onClick={() => void submit()} loading={submitting}>
 Resolve dispute
 </Button>
 </>
 }
 >
 <div className="flex flex-col gap-4">
 <Field label="Outcome">
 <Select ariaLabel="Resolution outcome" value={outcome} onChange={setOutcome} options={OUTCOME_OPTIONS} />
 </Field>
 <Field label="Resolution note" required error={touched && !resolutionValid ? "Write the ruling before resolving." : undefined}>
 <Textarea
 id="dispute-resolution"
 rows={4}
 value={resolution}
 onChange={(e) => setResolution(e.target.value)}
 placeholder="What was decided and why, in terms both parties will understand."
 />
 </Field>
 </div>
 </Modal>
 );
}
