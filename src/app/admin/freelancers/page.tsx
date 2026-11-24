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
import { ManageUserModal } from "@/components/admin/manage-user-modal";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  Alert02Icon,
  Download01Icon,
  Icon,
  MoreVerticalIcon,
  Search01Icon,
  SearchRemoveIcon,
  ShieldCheckIcon,
  StarIcon,
  UserCircleIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface AdminFreelancerRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  status: string;
  email_verified: boolean | null;
  verified: boolean | null;
  verification_provider: string | null;
  created_at: string;
  headline: string | null;
  about: string | null;
  location: string | null;
  timezone: string | null;
  hourly_rate_minor: number | string | null;
  currency: string | null;
  availability: string | null;
  experience_level: string | null;
  response_time_hours: number | string | null;
  verified_identity: boolean | null;
  is_featured: boolean | null;
  featured_rank: number | string | null;
  rating_avg: string | number | null;
  rating_count: number | string | null;
  completed_count: number | string | null;
  earnings_minor: number | string | null;
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

export default function AdminFreelancersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminFreelancerRow[] | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ accountType: "freelancer" });
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (status !== "all") params.set("status", status);
    try {
      const data = await api<{ users: AdminFreelancerRow[] }>(`/api/v1/admin/users?${params.toString()}`);
      setRows(data.users);
      setError(null);
    } catch (err) {
      const classified = classifyAdminError(err);
      if (classified.kind === "login") router.replace("/login");
      else if (classified.kind === "forbidden") setForbidden(classified.message);
      else setError(classified.message);
    }
  }, [debouncedQuery, status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const rated = list.filter((r) => r.rating_avg != null);
    return {
      total: list.length,
      verified: list.filter((r) => r.verified_identity === true || r.verified === true).length,
      avg: rated.length ? rated.reduce((sum, r) => sum + n(r.rating_avg), 0) / rated.length : 0,
      flagged: list.filter((r) => r.status !== "active").length,
      featured: list.filter((r) => r.is_featured === true).length,
      earnings: list.reduce((sum, r) => sum + n(r.earnings_minor) / 100, 0),
    };
  }, [rows]);

  async function setUserStatus(user: AdminFreelancerRow, next: "active" | "restricted" | "suspended") {
    setActingId(user.id);
    const endpoint = next === "active" ? "activate" : next === "restricted" ? "restrict" : "suspend";
    try {
      await api(`/api/v1/admin/users/${encodeURIComponent(user.id)}/${endpoint}`, { method: "POST" });
      setRows((list) => list?.map((r) => (r.id === user.id ? { ...r, status: next } : r)) ?? list);
      toast.success(`${user.name} is now ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  async function toggleCuration(row: AdminFreelancerRow) {
    setActingId(row.id);
    try {
      await api(`/api/v1/admin/freelancers/${encodeURIComponent(row.id)}/curation`, {
        method: "PATCH",
        body: { is_featured: !row.is_featured },
      });
      setRows((list) => list?.map((r) => (r.id === row.id ? { ...r, is_featured: !row.is_featured } : r)) ?? list);
      toast.success(row.is_featured ? "Removed from curated talent" : "Added to curated talent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update curation");
    } finally {
      setActingId(null);
    }
  }

  function exportCsv() {
    const list = rows ?? [];
    const header = ["Name", "Email", "Status", "Headline", "Location", "Rate (USD)", "Rating", "Completed", "Earnings (USD)", "Featured", "Joined"];
    const lines = list.map((r) =>
      [
        r.name, r.email, r.status, r.headline ?? "", r.location ?? "",
        r.hourly_rate_minor == null ? "" : (n(r.hourly_rate_minor) / 100).toFixed(2),
        r.rating_avg == null ? "" : n(r.rating_avg).toFixed(2),
        n(r.completed_count),
        (n(r.earnings_minor) / 100).toFixed(2),
        r.is_featured ? "yes" : "no",
        r.created_at.slice(0, 10),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workora-freelancers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} rows to CSV`);
  }

  if (forbidden) return <AdminAccessCard message={forbidden} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Freelancers"
        description="Every freelancer account. Manage profile details, status, curation and their content from one place."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Freelancers" }]}
        actions={
          <Button variant="secondary" size="md" onClick={exportCsv} disabled={!rows || rows.length === 0}>
            <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Freelancers shown" value={formatNumber(stats.total)} hint="Matches the current filters" icon={<Icon icon={UserCircleIcon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Verified" value={formatNumber(stats.verified)} hint="Identity or KYC complete" icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Average rating" value={stats.avg ? stats.avg.toFixed(2) : "—"} hint={`${formatNumber(stats.featured)} curated`} icon={<Icon icon={StarIcon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Flagged accounts" value={formatNumber(stats.flagged)} hint={`${formatMoney(stats.earnings)} lifetime earnings in view`} />
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <Field label="Search">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
              </span>
              <Input id="freelancer-search" className="pl-9" placeholder="Name, email, headline or location" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="w-44">
          <Select ariaLabel="Filter by status" value={status} onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "restricted", label: "Restricted" },
              { value: "suspended", label: "Suspended" },
            ]} />
        </div>
      </div>

      {error ? (
        <EmptyState
          icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
          title="Could not load freelancers"
          description={error}
          action={<Button variant="secondary" size="md" onClick={() => void load()}>Try again</Button>}
        />
      ) : rows === null ? (
        <div className="card h-64 animate-pulse bg-neutral-50" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
          title="No freelancers match these filters"
          description="Try a different search or status."
        />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TH>Freelancer</TH>
              <TH>Headline</TH>
              <TH>Location</TH>
              <TH align="right">Rate</TH>
              <TH>Rating</TH>
              <TH>Status</TH>
              <TH>Curated</TH>
              <TH align="right">Actions</TH>
            </THead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const };
                const rate = r.hourly_rate_minor == null ? null : n(r.hourly_rate_minor) / 100;
                return (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar src={r.image ?? undefined} name={r.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{r.name}</p>
                          <p className="max-w-56 truncate text-xs text-neutral-500">{r.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD><span className="line-clamp-1 max-w-56 text-sm text-neutral-700">{r.headline ?? "—"}</span></TD>
                    <TD><span className="text-sm text-neutral-700">{r.location ?? "—"}</span></TD>
                    <TD align="right"><span className="text-sm font-medium text-neutral-900">{rate == null ? "—" : `${formatMoney(rate)}/hr`}</span></TD>
                    <TD>
                      <span className="text-sm text-neutral-700">
                        {r.rating_avg == null ? "—" : `${n(r.rating_avg).toFixed(2)} (${n(r.rating_count)})`}
                      </span>
                    </TD>
                    <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
                    <TD>
                      {r.is_featured ? (
                        <Badge tone="brand">#{n(r.featured_rank)}</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">—</span>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setManaging({ id: r.id, name: r.name })}>
                          Manage
                        </Button>
                        <Button variant="secondary" size="sm" disabled={actingId === r.id} onClick={() => void toggleCuration(r)}>
                          {r.is_featured ? "Uncurate" : "Curate"}
                        </Button>
                        <DropdownMenu
                          label="Account actions"
                          trigger={
                            <Button variant="secondary" size="sm" disabled={actingId === r.id} aria-label="More account actions">
                              <Icon icon={MoreVerticalIcon} size={15} strokeWidth={1.8} />
                            </Button>
                          }
                          items={[
                            { type: "item" as const, label: "Set active", disabled: r.status === "active", onClick: () => void setUserStatus(r, "active") },
                            { type: "item" as const, label: "Restrict", disabled: r.status === "restricted", onClick: () => void setUserStatus(r, "restricted") },
                            { type: "item" as const, label: "Suspend", disabled: r.status === "suspended", onClick: () => void setUserStatus(r, "suspended") },
                          ] satisfies ItemSpec[]}
                        />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableShell>
      )}

      <p className="text-center text-[11px] text-neutral-400">
        {rows ? `${rows.length} freelancer${rows.length === 1 ? "" : "s"} shown · accounts are never deletable from the console` : "Loading freelancers…"}
      </p>

      <ManageUserModal
        userId={managing?.id ?? null}
        userName={managing?.name ?? ""}
        onClose={() => setManaging(null)}
        onUpdated={() => void load()}
      />
    </div>
  );
}
