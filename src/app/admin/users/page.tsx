"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber, labelize } from "@/lib/format";
import {
 Alert02Icon,
 Download01Icon,
 Icon,
 MoreVerticalIcon,
 Search01Icon,
 SearchRemoveIcon,
 ShieldCheckIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface AdminUserRow {
 id: string;
 name: string;
 email: string;
 image: string | null;
 account_type: "freelancer" | "client" | "admin" | string;
 status: string;
 email_verified: boolean | null;
 created_at: string;
 headline: string | null;
 location: string | null;
 hourly_rate_minor: string | number | null;
 verified_identity: boolean | null;
 rating_avg: string | number | null;
 rating_count: number | string | null;
 completed_count: number | string | null;
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

type ItemSpec = NonNullable<Parameters<typeof DropdownMenu>[0]["items"]>[number];

export default function AdminUsersPage() {
 const router = useRouter();
 const [rows, setRows] = useState<AdminUserRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [kind, setKind] = useState("all");
 const [status, setStatus] = useState("all");
 const [actingId, setActingId] = useState<string | null>(null);
 const [meId, setMeId] = useState<string | null>(null);
 const debounceRef = useRef<number | undefined>(undefined);
 const [debouncedQuery, setDebouncedQuery] = useState("");

 useEffect(() => {
 window.clearTimeout(debounceRef.current);
 debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 300);
 return () => window.clearTimeout(debounceRef.current);
 }, [query]);

 const load = useCallback(async () => {
 const params = new URLSearchParams();
 if (kind !== "all") params.set("accountType", kind);
 if (status !== "all") params.set("status", status);
 if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
 try {
 const [usersRes, meRes] = await Promise.all([
 api<{ users: AdminUserRow[] }>(`/api/v1/admin/users${params.toString() ? `?${params}` : ""}`),
 api<{ user: { id: string } }>("/api/v1/users/me").catch(() => null),
 ]);
 setRows(usersRes.users);
 setMeId(meRes?.user.id ?? null);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [kind, status, debouncedQuery, router]);

 useEffect(() => {
 void load();
 }, [load]);

 const counts = useMemo(() => {
 const list = rows ?? [];
 return {
 total: list.length,
 active: list.filter((r) => r.status === "active").length,
 flagged: list.filter((r) => r.status !== "active").length,
 };
 }, [rows]);

 async function setUserStatus(user: AdminUserRow, next: "suspended" | "active" | "restricted") {
 setActingId(user.id);
 const endpoint = next === "active" ? "activate" : next === "restricted" ? "restrict" : "suspend";
 try {
 await api(`/api/v1/admin/users/${encodeURIComponent(user.id)}/${endpoint}`, { method: "POST" });
 setRows((list) => list?.map((r) => (r.id === user.id ? { ...r, status: next } : r)) ?? list);
 toast.success(
 next === "active"
 ? `${user.name} is active again`
 : next === "restricted"
 ? `${user.name} restricted; posting and proposals are blocked until review`
 : `${user.name} suspended`,
 );
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Action failed");
 } finally {
 setActingId(null);
 }
 }

 function exportCsv() {
 const list = rows ?? [];
 const header = ["Name", "Email", "Type", "Status", "Headline", "Company", "Rating", "Completed", "Projects", "Spent (USD)", "Joined"];
 const lines = list.map((r) =>
 [
 r.name,
 r.email,
 r.account_type,
 r.status,
 r.headline ?? "",
 r.company_name ?? "",
 r.rating_avg == null ? "" : n(r.rating_avg).toFixed(2),
 n(r.completed_count),
 n(r.projects_count),
 r.spent_minor == null ? "" : (n(r.spent_minor) / 100).toFixed(2),
 r.created_at.slice(0, 10),
 ]
 .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
 .join(","),
 );
 const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = "workora-users.csv";
 anchor.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${list.length} rows to CSV`);
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Users"
 description="Every account on the marketplace: freelancers, clients and staff. Suspend and restrict take effect immediately."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Users" }]}
 actions={
 <Button variant="secondary" size="md" onClick={exportCsv} disabled={!rows || rows.length === 0}>
 <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
 Export CSV
 </Button>
 }
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard label="Accounts shown" value={formatNumber(counts.total)} hint="Matches the current filters" />
 <StatCard label="Active" value={formatNumber(counts.active)} hint="In good standing" icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />} />
 <StatCard label="Restricted or suspended" value={formatNumber(counts.flagged)} hint="Under manual review" />
 <StatCard label="Admins shown" value={formatNumber((rows ?? []).filter((r) => r.account_type === "admin").length)} hint="Console staff in this view" />
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
 id="user-search"
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
 ariaLabel="Filter by account type"
 value={kind}
 onChange={setKind}
 options={[
 { value: "all", label: "All types" },
 { value: "freelancer", label: "Freelancers" },
 { value: "client", label: "Clients" },
 { value: "admin", label: "Admins" },
 ]}
 />
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
 title="Could not load users"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 ) : rows === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : rows.length === 0 ? (
 <EmptyState
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No users match these filters"
 description="Try a different role, status or search term."
 />
 ) : (
 <TableShell>
 <Table>
 <THead>
 <TH>User</TH>
 <TH>Type</TH>
 <TH>Detail</TH>
 <TH>Rating</TH>
 <TH>Work</TH>
 <TH align="right">Spent</TH>
 <TH>Status</TH>
 <TH align="right">Actions</TH>
 </THead>
 <tbody>
 {rows.map((r) => {
 const meta = STATUS_META[r.status] ?? { label: labelize(r.status), tone: "neutral" as const };
 const isSelf = r.id === meId;
 const isFreelancer = r.account_type === "freelancer";
 const isClient = r.account_type === "client";
 const detail = isFreelancer ? r.headline : isClient ? r.company_name : "Staff";
 const detailSub = isFreelancer ? r.location : isClient ? r.industry : null;
 return (
 <TR key={r.id}>
 <TD>
 <div className="flex items-center gap-3">
 <Avatar src={r.image ?? undefined} name={r.name} size="sm" />
 <div className="min-w-0">
 <p className="truncate text-sm font-medium text-neutral-900">
 {r.name}
 {isSelf ? <span className="ml-1.5 text-[11px] font-normal text-neutral-400">you</span> : null}
 </p>
 <p className="truncate text-xs text-neutral-500">{r.email}</p>
 </div>
 </div>
 </TD>
 <TD>
 <Badge tone={r.account_type === "admin" ? "brand" : r.account_type === "client" ? "outline" : "neutral"}>
 {labelize(r.account_type)}
 </Badge>
 </TD>
 <TD>
 <span className="block max-w-56 truncate text-sm text-neutral-700">{detail ?? "—"}</span>
 {detailSub ? <span className="block truncate text-[11px] text-neutral-400">{detailSub}</span> : null}
 </TD>
 <TD>
 {isFreelancer && r.rating_avg != null ? (
 <span className="text-sm text-neutral-700">
 {n(r.rating_avg).toFixed(2)} <span className="text-[11px] text-neutral-400">({n(r.rating_count)})</span>
 </span>
 ) : (
 <span className="text-sm text-neutral-400">—</span>
 )}
 </TD>
 <TD>
 {isClient ? (
 <span className="text-sm text-neutral-700">{formatNumber(n(r.projects_count))} projects</span>
 ) : isFreelancer ? (
 <span className="text-sm text-neutral-700">{formatNumber(n(r.completed_count))} completed</span>
 ) : (
 <span className="text-sm text-neutral-400">—</span>
 )}
 </TD>
 <TD align="right">
 <span className="text-sm text-neutral-700">{isClient && r.spent_minor != null ? formatMoney(n(r.spent_minor) / 100) : "—"}</span>
 </TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD align="right">
 <UserActions
 user={r}
 disabled={isSelf || actingId === r.id}
 onStatus={setUserStatus}
 />
 </TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 {rows ? `${rows.length} ${rows.length === 1 ? "account" : "accounts"} shown · admin endpoint caps at 100 rows · actions on your own account are disabled` : "Loading accounts…"}
 </p>
 </div>
 );
}

function UserActions({
 user,
 disabled,
 onStatus,
}: {
 user: AdminUserRow;
 disabled: boolean;
 onStatus: (user: AdminUserRow, next: "suspended" | "active" | "restricted") => void;
}) {
 const restricted = user.status === "restricted";
 const suspended = user.status === "suspended";
 const flagged = restricted || suspended;

 const items: ItemSpec[] = flagged
 ? [{ type: "item", label: "Restore to active", onClick: () => onStatus(user, "active") }]
 : [
 { type: "item", label: "Restrict account", onClick: () => onStatus(user, "restricted") },
 { type: "item", label: "Suspend account", danger: true, onClick: () => onStatus(user, "suspended") },
 ];

 return (
 <DropdownMenu
 label={`Actions for ${user.name}`}
 trigger={
 <button
 type="button"
 aria-label={`Actions for ${user.name}`}
 disabled={disabled}
 className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
 >
 <Icon icon={MoreVerticalIcon} size={16} strokeWidth={1.8} />
 </button>
 }
 items={items}
 />
 );
}
