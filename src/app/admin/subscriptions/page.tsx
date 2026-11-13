import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { AdminAccessCard } from "@/components/admin/admin-access";
import { CrownIcon, Icon } from "@/lib/icons";
import { ApiServerError, apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import { formatDateShort, formatMoney, formatNumber, labelize } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SubscriptionRow {
 id: string;
 status: string;
 interval: string | null;
 amount_minor: string | number;
 currency: string;
 provider: string | null;
 started_at: string | null;
 current_period_end: string | null;
 canceled_at: string | null;
 plan_code: string;
 plan_name: string;
 audience: string | null;
 user_name: string;
 user_email: string;
 account_type: string | null;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

/** Approximate MRR: monthly counted as-is, annual normalized to /12, others as-is. */
const monthlyFactor = (interval: string | null): number => {
 const i = (interval ?? "").toLowerCase();
 if (i === "annual" || i === "yearly") return 1 / 12;
 return 1;
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
 active: { label: "Active", tone: "success" },
 past_due: { label: "Past due", tone: "warning" },
 canceled: { label: "Canceled", tone: "neutral" },
 cancelled: { label: "Canceled", tone: "neutral" },
};

export default async function AdminSubscriptionsPage() {
 const cookie = await sessionCookie();

 let rows: SubscriptionRow[];
 try {
 const res = await apiServer<{ subscriptions: SubscriptionRow[] }>("/api/v1/admin/subscriptions", undefined, cookie);
 rows = res.subscriptions;
 } catch (error) {
 if (isAuthError(error)) redirect("/login");
 if (error instanceof ApiServerError && error.status === 403) return <AdminAccessCard message={error.message} />;
 throw error;
 }

 const active = rows.filter((r) => r.status === "active");
 const pastDue = rows.filter((r) => r.status === "past_due");
 const canceled = rows.filter((r) => r.status === "canceled" || r.status === "cancelled");
 const mrr = active.reduce((sum, r) => sum + (n(r.amount_minor) / 100) * monthlyFactor(r.interval), 0);

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Subscriptions"
 description="Who pays what and what is about to lapse. Read-only: cancellation lives with the account owner."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Subscriptions" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard
 label="MRR (approx)"
 value={formatMoney(mrr, { decimals: true })}
 hint="Approximate: monthly items counted as-is; annual normalized to /12. No trials or proration."
 icon={<Icon icon={CrownIcon} size={16} strokeWidth={1.8} />}
 />
 <StatCard label="Active" value={formatNumber(active.length)} hint="Currently in good standing" />
 <StatCard label="Past due" value={formatNumber(pastDue.length)} hint="Charge failing or retrying" />
 <StatCard label="Canceled" value={formatNumber(canceled.length)} hint="Access ends at period end" />
 </div>

 {rows.length === 0 ? (
 <p className="rounded-xl border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-500">
 No subscriptions on the books yet.
 </p>
 ) : (
 <TableShell>
 <Table>
 <THead>
 <TH>User</TH>
 <TH>Plan</TH>
 <TH>Audience</TH>
 <TH>Amount</TH>
 <TH>Interval</TH>
 <TH>Status</TH>
 <TH>Started</TH>
 <TH>Period end</TH>
 </THead>
 <tbody>
 {rows.map((r) => {
 const meta = STATUS_META[r.status] ?? { label: labelize(r.status), tone: "neutral" as const };
 const amount = n(r.amount_minor) / 100;
 return (
 <TR key={r.id} className={cn(r.status === "past_due" && "bg-amber-50/50")}>
 <TD>
 <div className="min-w-0">
 <p className="truncate text-sm font-medium text-neutral-900">{r.user_name}</p>
 <p className="truncate text-xs text-neutral-500">{r.user_email}</p>
 </div>
 </TD>
 <TD><span className="text-sm text-neutral-700">{r.plan_name}</span></TD>
 <TD><span className="text-sm text-neutral-700">{r.audience ? labelize(r.audience) : "—"}</span></TD>
 <TD>
 <span className="text-sm font-medium text-neutral-900">
 {amount === 0 ? "Free" : `${formatMoney(amount, { decimals: true })}${r.currency !== "USD" ? ` ${r.currency}` : ""}`}
 </span>
 </TD>
 <TD><span className="text-sm text-neutral-700">{r.interval ? labelize(r.interval) : "—"}</span></TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD><span className="whitespace-nowrap text-sm text-neutral-500">{r.started_at ? formatDateShort(r.started_at) : "—"}</span></TD>
 <TD><span className="whitespace-nowrap text-sm text-neutral-500">{r.current_period_end ? formatDateShort(r.current_period_end) : r.canceled_at ? "Ended" : "—"}</span></TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 Amounts in minor units ÷ 100 · period end is the current billed period, not the cancellation date · demo billing, no real charges.
 </p>
 </div>
 );
}
