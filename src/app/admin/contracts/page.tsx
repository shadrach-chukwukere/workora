"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatDateShort, formatMoney, formatNumber, labelize } from "@/lib/format";
import {
 Alert02Icon,
 CheckmarkCircle02Icon,
 HandshakeIcon,
 Icon,
 Search01Icon,
 SearchRemoveIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface ContractRow {
 id: string;
 title_snapshot: string | null;
 project_title: string | null;
 status: string;
 total_minor: string | number;
 currency: string;
 started_at: string | null;
 created_at: string;
 client_name: string;
 freelancer_name: string;
 milestones_total: string | number;
 milestones_paid: string | number;
 milestone_total_minor: string | number;
 milestone_paid_minor: string | number;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_META: Record<string, { label: string; tone: "brand" | "success" | "neutral" | "warning" | "danger" }> = {
 active: { label: "Active", tone: "brand" },
 completed: { label: "Completed", tone: "success" },
 cancelled: { label: "Cancelled", tone: "neutral" },
 canceled: { label: "Cancelled", tone: "neutral" },
 paused: { label: "Paused", tone: "warning" },
 disputed: { label: "Disputed", tone: "danger" },
};

const PAGE_SIZE = 10;

export default function AdminContractsPage() {
 const router = useRouter();
 const [rows, setRows] = useState<ContractRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [status, setStatus] = useState("all");
 const [pageIndex, setPageIndex] = useState(0);
 const [selected, setSelected] = useState<ContractRow | null>(null);
 const [openDisputes, setOpenDisputes] = useState<number | null>(null);

 const load = useCallback(async () => {
 try {
 const [contractsRes, overviewRes] = await Promise.all([
 api<{ contracts: ContractRow[] }>("/api/v1/admin/contracts"),
 api<{ disputes: { open: string | number } }>("/api/v1/admin/overview").catch(() => null),
 ]);
 setRows(contractsRes.contracts);
 setOpenDisputes(overviewRes ? n(overviewRes.disputes.open) : null);
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

 const filtered = useMemo(() => {
 const list = rows ?? [];
 const q = query.trim().toLowerCase();
 return list.filter((r) => {
 if (status !== "all" && r.status !== status) return false;
 if (!q) return true;
 return (
 r.id.toLowerCase().includes(q) ||
 (r.project_title ?? "").toLowerCase().includes(q) ||
 (r.title_snapshot ?? "").toLowerCase().includes(q) ||
 r.client_name.toLowerCase().includes(q) ||
 r.freelancer_name.toLowerCase().includes(q)
 );
 });
 }, [rows, query, status]);

 const stats = useMemo(() => {
 const list = rows ?? [];
 return {
 active: list.filter((r) => r.status === "active").length,
 completed: list.filter((r) => r.status === "completed").length,
 value: list.reduce((sum, r) => sum + n(r.total_minor) / 100, 0),
 };
 }, [rows]);

 const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
 const page = Math.min(pageIndex, pageCount - 1);
 const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

 useEffect(() => {
 setPageIndex(0);
 }, [query, status]);

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Contracts"
 description="Every contract on the books: value, milestone progress and who is on each side."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Contracts" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Active contracts" value={formatNumber(stats.active)} hint="Loaded page, all statuses" icon={<Icon icon={HandshakeIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Completed" value={formatNumber(stats.completed)} hint="Delivered and closed out" icon={<Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Contract value" value={formatMoney(stats.value)} hint="Loaded page, minor units ÷ 100" />
 <StatCard label="Open disputes" value={openDisputes == null ? "—" : formatNumber(openDisputes)} hint="From the admin overview" icon={<Icon icon={Alert02Icon} size={16} strokeWidth={1.8} />} />
 </div>

 {/* Filters */}
 <div className="card flex flex-wrap items-end gap-3 p-4">
 <div className="min-w-56 flex-1">
 <Field label="Search">
 <div className="relative">
 <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
 <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
 </span>
 <Input
 id="contract-search"
 className="pl-9"
 placeholder="Contract id, project or party"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 </Field>
 </div>
 <div className="w-44">
 <Select
 ariaLabel="Filter by status"
 value={status}
 onChange={setStatus}
 options={[
 { value: "all", label: "All statuses" },
 { value: "active", label: "Active" },
 { value: "completed", label: "Completed" },
 { value: "paused", label: "Paused" },
 { value: "cancelled", label: "Cancelled" },
 { value: "canceled", label: "Canceled" },
 { value: "disputed", label: "Disputed" },
 ]}
 />
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load contracts"
 description={error}
 />
 ) : rows === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : pageRows.length === 0 ? (
 <EmptyState
 compact
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No contracts match these filters"
 description="Try a different status or clear the search box."
 />
 ) : (
 <>
 <TableShell>
 <Table>
 <THead>
 <TH>Contract</TH>
 <TH>Client</TH>
 <TH>Freelancer</TH>
 <TH>Value</TH>
 <TH>Milestones</TH>
 <TH>Status</TH>
 <TH>Started</TH>
 <TH align="right">Details</TH>
 </THead>
 <tbody>
 {pageRows.map((r) => {
 const meta = STATUS_META[r.status] ?? { label: labelize(r.status), tone: "neutral" as const };
 const total = n(r.milestones_total);
 const paid = n(r.milestones_paid);
 return (
 <TR key={r.id}>
 <TD>
 <div className="min-w-0">
 <p className="font-mono text-[11px] text-neutral-900">{r.id.slice(0, 8)}</p>
 <p className="mt-0.5 max-w-48 truncate text-xs text-neutral-500" title={r.project_title ?? r.title_snapshot ?? ""}>
 {r.project_title ?? r.title_snapshot ?? "Untitled"}
 </p>
 </div>
 </TD>
 <TD><span className="text-sm text-neutral-700">{r.client_name}</span></TD>
 <TD><span className="text-sm text-neutral-700">{r.freelancer_name}</span></TD>
 <TD><span className="text-sm font-medium text-neutral-900">{formatMoney(n(r.total_minor) / 100)}</span></TD>
 <TD><span className="text-sm text-neutral-700">{paid} of {total} paid</span></TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD><span className="whitespace-nowrap text-sm text-neutral-500">{r.started_at ? formatDateShort(r.started_at) : "Not started"}</span></TD>
 <TD align="right">
 <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
 View
 </Button>
 </TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>

 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-sm text-neutral-500">
 {filtered.length} {filtered.length === 1 ? "contract" : "contracts"}
 </p>
 <div className="flex items-center gap-2">
 <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
 Previous
 </Button>
 <span className="text-sm text-neutral-500">
 Page {page + 1} of {pageCount}
 </span>
 <Button variant="secondary" size="sm" disabled={page >= pageCount - 1} onClick={() => setPageIndex((p) => p + 1)}>
 Next
 </Button>
 </div>
 </div>
 </>
 )}

 <ContractDetailModal row={selected} onClose={() => setSelected(null)} />
 <p className="text-center text-[11px] text-neutral-400">Loaded page capped at 100 rows · amounts in minor units ÷ 100 · no dispute actions here, see Disputes.</p>
 </div>
 );
}

function ContractDetailModal({ row, onClose }: { row: ContractRow | null; onClose: () => void }) {
 const paidAmount = row ? n(row.milestone_paid_minor) / 100 : 0;
 const totalAmount = row ? n(row.milestone_total_minor) / 100 : 0;

 return (
 <Modal
 open={row != null}
 onClose={onClose}
 title={row ? `Contract ${row.id.slice(0, 8)}` : "Contract"}
 description={row?.project_title ?? row?.title_snapshot ?? undefined}
 size="md"
 footer={
 <Button variant="secondary" size="md" onClick={onClose}>
 Close
 </Button>
 }
 >
 {row ? (
 <div className="flex flex-col gap-5">
 <div className="grid grid-cols-2 gap-3">
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Client</p>
 <p className="mt-1.5 text-sm font-medium text-neutral-900">{row.client_name}</p>
 </div>
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Freelancer</p>
 <p className="mt-1.5 text-sm font-medium text-neutral-900">{row.freelancer_name}</p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 text-center">
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Contract value</p>
 <p className="mt-1 text-lg font-semibold text-neutral-900">{formatMoney(n(row.total_minor) / 100)}</p>
 </div>
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Milestones paid</p>
 <p className="mt-1 text-lg font-semibold text-neutral-900">
 {n(row.milestones_paid)} <span className="text-sm font-normal text-neutral-500">of {n(row.milestones_total)}</span>
 </p>
 </div>
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Milestone value</p>
 <p className="mt-1 text-sm font-semibold text-neutral-900">{formatMoney(totalAmount)}</p>
 </div>
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Paid to date</p>
 <p className="mt-1 text-sm font-semibold text-neutral-900">{formatMoney(paidAmount)}</p>
 </div>
 </div>

 <p className="text-xs text-neutral-500">
 Status: {labelize(row.status)} · {row.started_at ? `Started ${formatDateShort(row.started_at)}` : "Not started yet"} · Contract id {row.id}
 </p>
 </div>
 ) : null}
 </Modal>
 );
}
