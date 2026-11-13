"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber } from "@/lib/format";
import {
 Alert02Icon,
 Download01Icon,
 Icon,
 Search01Icon,
 SearchRemoveIcon,
 UserAccountIcon,
 Wallet02Icon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface UserRow {
 id: string;
 name: string;
 email: string;
 image: string | null;
 status: string;
 created_at: string;
 company_name: string | null;
 industry: string | null;
 spent_minor: string | number | null;
 projects_count: number | string | null;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
 active: { label: "Active", tone: "success" },
 restricted: { label: "Restricted", tone: "warning" },
 suspended: { label: "Suspended", tone: "danger" },
};

export default function AdminClientsPage() {
 const router = useRouter();
 const [rows, setRows] = useState<UserRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [status, setStatus] = useState("all");
 const [actingId, setActingId] = useState<string | null>(null);
 const debounceRef = useRef<number | undefined>(undefined);

 const load = useCallback(
 async (q: string, statusFilter: string) => {
 const params = new URLSearchParams({ accountType: "client" });
 if (q.trim()) params.set("q", q.trim());
 if (statusFilter !== "all") params.set("status", statusFilter);
 try {
 const data = await api<{ users: UserRow[] }>(`/api/v1/admin/users?${params.toString()}`);
 setRows(data.users);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 },
 [router],
 );

 useEffect(() => {
 window.clearTimeout(debounceRef.current);
 debounceRef.current = window.setTimeout(() => {
 void load(query, status);
 }, 300);
 return () => window.clearTimeout(debounceRef.current);
 }, [query, status, load]);

 const counts = useMemo(() => {
 const list = rows ?? [];
 return {
 total: list.length,
 active: list.filter((r) => r.status === "active").length,
 flagged: list.filter((r) => r.status !== "active").length,
 spend: list.reduce((sum, r) => sum + n(r.spent_minor) / 100, 0),
 };
 }, [rows]);

 async function setUserStatus(user: UserRow, next: "suspended" | "active") {
 setActingId(user.id);
 try {
 await api(`/api/v1/admin/users/${encodeURIComponent(user.id)}/${next === "active" ? "activate" : "suspend"}`, { method: "POST" });
 setRows((list) => list?.map((r) => (r.id === user.id ? { ...r, status: next } : r)) ?? list);
 toast.success(next === "active" ? `${user.name} is active again` : `${user.name} suspended`);
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Action failed");
 } finally {
 setActingId(null);
 }
 }

 function exportCsv() {
 const list = rows ?? [];
 const header = ["Name", "Email", "Company", "Industry", "Spent", "Projects", "Status"];
 const lines = list.map((r) =>
 [
 r.name,
 r.email,
 r.company_name ?? "",
 r.industry ?? "",
 (n(r.spent_minor) / 100).toFixed(2),
 n(r.projects_count),
 r.status,
 ]
 .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
 .join(","),
 );
 const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = "workora-clients.csv";
 anchor.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${list.length} rows to CSV`);
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Clients"
 description="Demand side of the marketplace: spend, posting volume and account state for every client."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Clients" }]}
 actions={
 <Button variant="secondary" size="md" onClick={exportCsv} disabled={!rows || rows.length === 0}>
 <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
 Export CSV
 </Button>
 }
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Clients shown" value={formatNumber(counts.total)} hint="Matches the current filters" icon={<Icon icon={UserAccountIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Active" value={formatNumber(counts.active)} hint="In good standing" />
 <StatCard label="Restricted or suspended" value={formatNumber(counts.flagged)} hint="Under manual review" />
 <StatCard label="Lifetime spend" value={formatMoney(counts.spend)} hint="Across the filtered clients" icon={<Icon icon={Wallet02Icon} size={16} strokeWidth={1.8} />} />
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
 id="client-search"
 className="pl-9"
 placeholder="Name or email"
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
 { value: "restricted", label: "Restricted" },
 { value: "suspended", label: "Suspended" },
 ]}
 />
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load clients"
 description={error}
 />
 ) : rows === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : rows.length === 0 ? (
 <EmptyState
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No clients match these filters"
 description="Try a different status or clear the search box."
 />
 ) : (
 <TableShell>
 <Table>
 <THead>
 <TH>Client</TH>
 <TH>Company</TH>
 <TH align="right">Spent</TH>
 <TH align="right">Projects</TH>
 <TH>Status</TH>
 <TH align="right">Actions</TH>
 </THead>
 <tbody>
 {rows.map((r) => {
 const meta = STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const };
 const suspended = r.status === "suspended";
 return (
 <TR key={r.id}>
 <TD>
 <div className="flex items-center gap-3">
 <Avatar src={r.image ?? undefined} name={r.name} size="sm" />
 <div className="min-w-0">
 <p className="truncate text-sm font-medium text-neutral-900">{r.name}</p>
 <p className="truncate text-xs text-neutral-500">{r.email}</p>
 </div>
 </div>
 </TD>
 <TD>
 <span className="text-sm text-neutral-700">{r.company_name ?? "—"}</span>
 {r.industry ? <span className="block text-[11px] text-neutral-400">{r.industry}</span> : null}
 </TD>
 <TD align="right">
 <span className="text-sm font-medium text-neutral-900">{r.spent_minor == null ? "—" : formatMoney(n(r.spent_minor) / 100)}</span>
 </TD>
 <TD align="right">
 <span className="text-sm text-neutral-700">{r.projects_count == null ? "—" : formatNumber(n(r.projects_count))}</span>
 </TD>
 <TD>
 <Badge tone={meta.tone}>{meta.label}</Badge>
 </TD>
 <TD align="right">
 <Button
 variant="secondary"
 size="sm"
 disabled={actingId === r.id}
 onClick={() => void setUserStatus(r, suspended ? "active" : "suspended")}
 >
 {suspended ? "Activate" : "Suspend"}
 </Button>
 </TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 {rows ? `${rows.length} ${rows.length === 1 ? "client" : "clients"} shown · admin endpoint caps at 100 rows` : "Loading clients…"}
 </p>
 </div>
 );
}
