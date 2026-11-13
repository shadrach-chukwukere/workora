"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatMoney, formatNumber } from "@/lib/format";
import {
 Alert02Icon,
 Download01Icon,
 File02Icon,
 Icon,
 InformationCircleIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface Overview {
 users: { freelancers: string | number; clients: string | number; admins: string | number; new_this_month: string | number; total: string | number };
 projects: { open: string | number; in_progress: string | number; completed: string | number };
 contracts: { active: string | number; completed: string | number };
 disputes: { open: string | number; under_review: string | number };
 verification: { pending: string | number; info_requested: string | number };
 revenueMinor: number;
 commissionMinor: number;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const DOWNLOADS: { file: string; name: string; description: string; columns: string }[] = [
 {
 file: "/api/v1/reports/users.csv",
 name: "Users CSV",
 description: "Every account on the platform as a flat CSV.",
 columns: "id · name · email · account_type · status · created_at",
 },
 {
 file: "/api/v1/reports/transactions.csv",
 name: "Transactions CSV",
 description: "The full ledger, one row per entry.",
 columns: "id · user_id · type · amount_minor (minor units) · currency · status · description · created_at",
 },
 {
 file: "/api/v1/reports/contracts.csv",
 name: "Contracts CSV",
 description: "Every contract with both party names.",
 columns: "id · title · status · total_minor (minor units) · currency · started_at · created_at · client_name · freelancer_name",
 },
];

export default function AdminReportsPage() {
 const router = useRouter();
 const [overview, setOverview] = useState<Overview | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 api<Overview>("/api/v1/admin/overview")
 .then(setOverview)
 .catch((err) => {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 });
 }, [router]);

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Reports"
 description="Server-generated CSV exports of the live tables, plus a printable platform snapshot."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Reports" }]}
 />

 <div className="grid gap-4 md:grid-cols-3">
 {DOWNLOADS.map((report) => (
 <section key={report.file} className="card flex flex-col gap-3 p-5">
 <div className="flex items-start gap-3">
 <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
 <Icon icon={File02Icon} size={17} strokeWidth={1.8} />
 </span>
 <div className="min-w-0">
 <h2 className="text-sm font-semibold text-neutral-900">{report.name}</h2>
 <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600">{report.description}</p>
 </div>
 </div>
 <p className="text-[11px] leading-relaxed text-neutral-500">{report.columns}</p>
 <div className="mt-auto border-t border-neutral-100 pt-3">
 <a
 href={report.file}
 download
 className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
 >
 <Icon icon={Download01Icon} size={14} strokeWidth={1.8} />
 Download CSV
 </a>
 </div>
 </section>
 ))}
 </div>

 {/* Platform snapshot */}
 <section className="card">
 <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
 <div>
 <h2 className="text-sm font-semibold text-neutral-900">Platform snapshot</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Generated in your browser from GET /api/v1/admin/overview. Print it for the ops record.</p>
 </div>
 <Button variant="secondary" size="md" onClick={() => window.print()} disabled={!overview}>
 Print snapshot
 </Button>
 </div>
 <div className="px-5 py-4">
 {error ? (
 <EmptyState
 compact
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load the snapshot"
 description={error}
 />
 ) : !overview ? (
 <p className="text-sm text-neutral-500">Loading snapshot…</p>
 ) : (
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <SnapshotStat label="Total accounts" value={formatNumber(n(overview.users.total))} hint={`${formatNumber(n(overview.users.freelancers))} freelancers · ${formatNumber(n(overview.users.clients))} clients · ${formatNumber(n(overview.users.admins))} admins`} />
 <SnapshotStat label="New this month" value={formatNumber(n(overview.users.new_this_month))} hint="Accounts created in the trailing 30 days" />
 <SnapshotStat label="Open listings" value={formatNumber(n(overview.projects.open))} hint={`${formatNumber(n(overview.projects.in_progress))} in progress · ${formatNumber(n(overview.projects.completed))} completed`} />
 <SnapshotStat label="Active contracts" value={formatNumber(n(overview.contracts.active))} hint={`${formatNumber(n(overview.contracts.completed))} completed, all time`} />
 <SnapshotStat label="Open disputes" value={formatNumber(n(overview.disputes.open))} hint={`${formatNumber(n(overview.disputes.under_review))} under review`} />
 <SnapshotStat label="Pending verifications" value={formatNumber(n(overview.verification.pending))} hint={`${formatNumber(n(overview.verification.info_requested))} info requested`} />
 <SnapshotStat label="Revenue volume" value={formatMoney(n(overview.revenueMinor) / 100)} hint="Completed transactions, all time" />
 <SnapshotStat label="Commission earned" value={formatMoney(n(overview.commissionMinor) / 100)} hint="Commission rows, all time" />
 </div>
 )}
 </div>
 </section>

 <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
 <Icon icon={InformationCircleIcon} size={14} strokeWidth={1.8} />
 CSV amounts are minor units except where the column name says otherwise; all rows reflect the live tables at download time.
 </p>
 </div>
 );
}

function SnapshotStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
 return (
 <div className="rounded-xl border border-neutral-200 p-4">
 <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{label}</p>
 <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">{value}</p>
 {hint ? <p className="mt-1 text-[11px] text-neutral-500">{hint}</p> : null}
 </div>
 );
}
