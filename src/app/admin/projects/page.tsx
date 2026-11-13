"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber, formatRelative, labelize } from "@/lib/format";
import {
 Alert02Icon,
 Briefcase02Icon,
 CheckmarkCircle02Icon,
 Icon,
 Search01Icon,
 SearchRemoveIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface ProjectRow {
 id: string;
 title: string;
 status: string;
 budget_type: string | null;
 budget_min_minor: string | number | null;
 budget_max_minor: string | number | null;
 currency: string;
 experience_level: string | null;
 proposals_count: number | string;
 published_at: string | null;
 created_at: string;
 category_name: string | null;
 client_name: string | null;
 client_company_name: string | null;
}

interface CategoryOption {
 id: string;
 name: string;
}

interface ProjectsResponse {
 projects: ProjectRow[];
 page: number;
 perPage: number;
 total: number;
 totalPages: number;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_META: Record<string, { label: string; tone: "success" | "brand" | "neutral" | "warning" | "danger" | "outline" }> = {
 open: { label: "Open", tone: "success" },
 in_progress: { label: "In progress", tone: "brand" },
 completed: { label: "Completed", tone: "neutral" },
 closed: { label: "Closed", tone: "neutral" },
 draft: { label: "Draft", tone: "outline" },
 cancelled: { label: "Cancelled", tone: "neutral" },
 canceled: { label: "Cancelled", tone: "neutral" },
};

const PER_PAGE = 25;

export default function AdminProjectsPage() {
 const router = useRouter();
 const [data, setData] = useState<ProjectsResponse | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [status, setStatus] = useState("all");
 const [categoryId, setCategoryId] = useState("all");
 const [page, setPage] = useState(1);
 const [categories, setCategories] = useState<CategoryOption[]>([]);
 const [counts, setCounts] = useState<{ open: number | null; inProgress: number | null; completed: number | null }>({
 open: null,
 inProgress: null,
 completed: null,
 });
 const debounceRef = useRef<number | undefined>(undefined);
 const [debouncedQuery, setDebouncedQuery] = useState("");

 // Debounce the search box before hitting the API.
 useEffect(() => {
 window.clearTimeout(debounceRef.current);
 debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 300);
 return () => window.clearTimeout(debounceRef.current);
 }, [query]);

 // Reset to page 1 whenever filters change.
 useEffect(() => {
 setPage(1);
 }, [debouncedQuery, status, categoryId]);

 // Category dropdown (public endpoint, not admin-gated).
 useEffect(() => {
 api<{ categories: CategoryOption[] }>("/api/v1/categories")
 .then((res) => setCategories(res.categories))
 .catch(() => setCategories([]));
 }, []);

 // Strided totals per status, one cheap perPage=1 call each.
 useEffect(() => {
 const statuses: { key: "open" | "inProgress" | "completed"; value: string }[] = [
 { key: "open", value: "open" },
 { key: "inProgress", value: "in_progress" },
 { key: "completed", value: "completed" },
 ];
 for (const s of statuses) {
 api<ProjectsResponse>(`/api/v1/admin/projects?status=${s.value}&perPage=1`)
 .then((res) => setCounts((prev) => ({ ...prev, [s.key]: res.total })))
 .catch(() => setCounts((prev) => ({ ...prev, [s.key]: null })));
 }
 }, []);

 // Main table query.
 const load = useCallback(async () => {
 const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
 if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
 if (status !== "all") params.set("status", status);
 if (categoryId !== "all") params.set("categoryId", categoryId);
 try {
 const res = await api<ProjectsResponse>(`/api/v1/admin/projects?${params.toString()}`);
 setData(res);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [page, debouncedQuery, status, categoryId, router]);

 useEffect(() => {
 void load();
 }, [load]);

 const categoryOptions = useMemo(
 () => [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
 [categories],
 );

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Listings"
 description="Every project on the marketplace: what is live, what is in flight and what just shipped."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Listings" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Open now" value={counts.open == null ? "—" : formatNumber(counts.open)} hint="Platform-wide, all listings" icon={<Icon icon={Briefcase02Icon} size={16} strokeWidth={1.8} />} />
 <StatCard label="In progress" value={counts.inProgress == null ? "—" : formatNumber(counts.inProgress)} hint="Hired and under way" />
 <StatCard label="Completed" value={counts.completed == null ? "—" : formatNumber(counts.completed)} hint="Delivered, all time" icon={<Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />} />
 <StatCard label="In this view" value={data ? formatNumber(data.total) : "—"} hint="Matches the current filters" />
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
 id="project-search"
 className="pl-9"
 placeholder="Title or summary"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 </Field>
 </div>
 <div className="w-52">
 <Select ariaLabel="Filter by category" value={categoryId} onChange={setCategoryId} options={categoryOptions} />
 </div>
 <div className="w-44">
 <Select
 ariaLabel="Filter by status"
 value={status}
 onChange={setStatus}
 options={[
 { value: "all", label: "All statuses" },
 { value: "open", label: "Open" },
 { value: "in_progress", label: "In progress" },
 { value: "completed", label: "Completed" },
 { value: "draft", label: "Draft" },
 { value: "closed", label: "Closed" },
 { value: "cancelled", label: "Cancelled" },
 ]}
 />
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load listings"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 ) : data === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : data.projects.length === 0 ? (
 <EmptyState
 compact
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No listings match these filters"
 description="Try a different category or clear the search box."
 />
 ) : (
 <>
 <TableShell>
 <Table>
 <THead>
 <TH>Listing</TH>
 <TH>Category</TH>
 <TH>Budget</TH>
 <TH>Client</TH>
 <TH>Status</TH>
 <TH align="right">Proposals</TH>
 <TH>Posted</TH>
 </THead>
 <tbody>
 {data.projects.map((p) => {
 const meta = STATUS_META[p.status] ?? { label: labelize(p.status), tone: "neutral" as const };
 const min = p.budget_min_minor == null ? null : n(p.budget_min_minor) / 100;
 const max = p.budget_max_minor == null ? null : n(p.budget_max_minor) / 100;
 const hourly = p.budget_type === "hourly" ? "/hr" : "";
 const budget =
 min == null && max == null
 ? "Not disclosed"
 : min == null || max == null || min === max
 ? `${formatMoney(min ?? max ?? 0)}${hourly}`
 : `${formatMoney(min)} – ${formatMoney(max)}${hourly}`;
 return (
 <TR key={p.id}>
 <TD>
 <div className="min-w-0">
 <p className="max-w-64 truncate text-sm font-medium text-neutral-900" title={p.title}>
 {p.title}
 </p>
 <p className="font-mono text-[11px] text-neutral-400">{p.id.slice(0, 8)}</p>
 </div>
 </TD>
 <TD><span className="text-sm text-neutral-700">{p.category_name ?? "—"}</span></TD>
 <TD><span className="whitespace-nowrap text-sm text-neutral-700">{budget}</span></TD>
 <TD>
 <span className="text-sm text-neutral-700">{p.client_company_name ?? p.client_name ?? "—"}</span>
 {p.client_company_name && p.client_name ? (
 <span className="block text-[11px] text-neutral-400">{p.client_name}</span>
 ) : null}
 </TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD align="right"><span className="text-sm text-neutral-700">{formatNumber(n(p.proposals_count))}</span></TD>
 <TD><span className="whitespace-nowrap text-sm text-neutral-500">{p.published_at ? formatRelative(p.published_at) : "Unpublished"}</span></TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>

 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-sm text-neutral-500">
 {formatNumber(data.total)} {data.total === 1 ? "listing" : "listings"} · page {data.page} of {Math.max(1, data.totalPages)}
 </p>
 <div className="flex items-center gap-2">
 <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
 Previous
 </Button>
 <Button variant="secondary" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
 Next
 </Button>
 </div>
 </div>
 </>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 Read-only oversight view · budgets in minor units ÷ 100 · close actions live with the owning client, not the console.
 </p>
 </div>
 );
}
