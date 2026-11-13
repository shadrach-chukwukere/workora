"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber, labelize } from "@/lib/format";
import {
 Alert02Icon,
 Icon,
 Search01Icon,
 SearchRemoveIcon,
 ShieldCheckIcon,
 StarIcon,
 UserCircleIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PublicFreelancer {
 id: string;
 name: string;
 image: string | null;
 headline: string | null;
 hourly_rate_minor: number | string | null;
 availability: string | null;
 verified_identity: boolean | null;
 rating_avg: string | number | null;
 rating_count: number | string | null;
 completed_count: number | string | null;
 location: string | null;
}

interface AdminUserRow {
 id: string;
 status: string;
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

export default function AdminFreelancersPage() {
 const router = useRouter();
 const [rows, setRows] = useState<PublicFreelancer[] | null>(null);
 const [statusById, setStatusById] = useState<Map<string, string>>(new Map());
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [actingId, setActingId] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const [publicRes, adminRes] = await Promise.all([
 api<{ freelancers: PublicFreelancer[] }>("/api/v1/freelancers?perPage=50&sort=rating"),
 api<{ users: AdminUserRow[] }>("/api/v1/admin/users?accountType=freelancer").catch(() => ({ users: [] as AdminUserRow[] })),
 ]);
 setRows(publicRes.freelancers);
 setStatusById(new Map(adminRes.users.map((u) => [u.id, u.status])));
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
 if (!q) return list;
 return list.filter((r) =>
 [r.name, r.headline ?? "", r.location ?? ""].some((field) => field.toLowerCase().includes(q)),
 );
 }, [rows, query]);

 const stats = useMemo(() => {
 const list = rows ?? [];
 const rated = list.filter((r) => r.rating_avg != null);
 const avg = rated.length ? rated.reduce((sum, r) => sum + n(r.rating_avg), 0) / rated.length : 0;
 const verified = list.filter((r) => r.verified_identity === true).length;
 const flagged = list.filter((r) => {
 const status = statusById.get(r.id);
 return status === "suspended" || status === "restricted";
 }).length;
 return { total: list.length, verified, avg, flagged };
 }, [rows, statusById]);

 async function setUserStatus(userId: string, name: string, next: "suspended" | "active") {
 setActingId(userId);
 try {
 await api(`/api/v1/admin/users/${encodeURIComponent(userId)}/${next === "active" ? "activate" : "suspend"}`, { method: "POST" });
 setStatusById((prev) => new Map(prev).set(userId, next));
 toast.success(next === "active" ? `${name} is active again` : `${name} suspended`);
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Action failed");
 } finally {
 setActingId(null);
 }
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Freelancers"
 description="Supply side of the marketplace: rates, output and verification state, top 50 by rating."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Freelancers" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Freelancers shown" value={formatNumber(stats.total)} hint="Public list, top 50 by rating" icon={<Icon icon={UserCircleIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="ID verified" value={formatNumber(stats.verified)} hint="Of the loaded rows" icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Average rating" value={stats.avg ? stats.avg.toFixed(2) : "—"} hint="Rated freelancers only" icon={<Icon icon={StarIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Restricted or suspended" value={formatNumber(stats.flagged)} hint="From the admin user list" />
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
 id="freelancer-search"
 className="pl-9"
 placeholder="Name, headline or location"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 </Field>
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load freelancers"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 ) : rows === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : filtered.length === 0 ? (
 <EmptyState
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No freelancers match this search"
 description="Try a different name, headline or location."
 />
 ) : (
 <TableShell>
 <Table>
 <THead>
 <TH>Freelancer</TH>
 <TH>Location</TH>
 <TH>Rate</TH>
 <TH>Rating</TH>
 <TH align="right">Completed</TH>
 <TH>Verified</TH>
 <TH>Availability</TH>
 <TH>Account</TH>
 <TH align="right">Actions</TH>
 </THead>
 <tbody>
 {filtered.map((r) => {
 const status = statusById.get(r.id);
 const meta = STATUS_META[status ?? "active"] ?? { label: "Unknown", tone: "neutral" as const };
 const suspendedOrRestricted = status === "suspended" || status === "restricted";
 const rate = r.hourly_rate_minor == null ? null : n(r.hourly_rate_minor) / 100;
 const rating = r.rating_avg == null ? null : n(r.rating_avg);
 return (
 <TR key={r.id}>
 <TD>
 <div className="flex items-center gap-3">
 <Avatar src={r.image ?? undefined} name={r.name} size="sm" />
 <div className="min-w-0">
 <p className="truncate text-sm font-medium text-neutral-900">{r.name}</p>
 <p className="max-w-56 truncate text-xs text-neutral-500">{r.headline ?? "No headline yet"}</p>
 </div>
 </div>
 </TD>
 <TD><span className="text-sm text-neutral-700">{r.location ?? "—"}</span></TD>
 <TD>
 <span className="text-sm font-medium text-neutral-900">{rate == null ? "—" : `${formatMoney(rate)}/hr`}</span>
 </TD>
 <TD>
 {rating == null ? (
 <span className="text-sm text-neutral-400">—</span>
 ) : (
 <span className="text-sm text-neutral-700">
 {rating.toFixed(2)} <span className="text-[11px] text-neutral-400">({n(r.rating_count)})</span>
 </span>
 )}
 </TD>
 <TD align="right"><span className="text-sm text-neutral-700">{formatNumber(n(r.completed_count))}</span></TD>
 <TD>{r.verified_identity ? <Badge tone="success">ID verified</Badge> : <Badge tone="warning">Unverified</Badge>}</TD>
 <TD>
 {r.availability ? (
 <span className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
 <span
 aria-hidden
 className={cn(
 "size-1.5 rounded-full",
 r.availability === "available" ? "bg-emerald-500" : "bg-neutral-300",
 )}
 />
 {labelize(r.availability)}
 </span>
 ) : (
 <span className="text-sm text-neutral-400">—</span>
 )}
 </TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD align="right">
 <Button
 variant="secondary"
 size="sm"
 disabled={actingId === r.id}
 onClick={() => void setUserStatus(r.id, r.name, suspendedOrRestricted ? "active" : "suspended")}
 >
 {suspendedOrRestricted ? "Activate" : "Suspend"}
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
 Account state merged from the admin user list by id · suspend and activate act immediately · public list capped at 50 rows.
 </p>
 </div>
 );
}
