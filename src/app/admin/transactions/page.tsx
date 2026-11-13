"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { TD, TH, THead, Table, TableShell, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatDateShort, formatMoney, formatNumber, labelize } from "@/lib/format";
import {
 Alert02Icon,
 BankIcon,
 CreditCardIcon,
 Download01Icon,
 Icon,
 Search01Icon,
 SearchRemoveIcon,
 Wallet02Icon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface TransactionRow {
 id: string;
 user_id: string;
 user_name: string;
 type: string;
 amount_minor: string | number;
 currency: string;
 status: string;
 description: string;
 created_at: string;
 contract_id: string | null;
}

const n = (v: string | number | null | undefined): number => {
 const parsed = Number(v ?? 0);
 return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
 completed: { label: "Completed", tone: "success" },
 pending: { label: "Pending", tone: "warning" },
 failed: { label: "Failed", tone: "danger" },
};

const TYPE_OPTIONS = [
 { value: "all", label: "All types" },
 { value: "milestone", label: "Milestone" },
 { value: "commission", label: "Commission" },
 { value: "refund", label: "Refund" },
 { value: "withdrawal", label: "Withdrawal" },
 { value: "topup", label: "Top-up" },
 { value: "payout", label: "Payout" },
 { value: "payment", label: "Payment" },
];

const TYPE_BADGE_TONE: Record<string, "brand" | "neutral" | "warning" | "success"> = {
 commission: "brand",
 milestone: "success",
 refund: "warning",
};

export default function AdminTransactionsPage() {
 const router = useRouter();
 const [rows, setRows] = useState<TransactionRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [type, setType] = useState("all");
 const [status, setStatus] = useState("all");

 const load = useCallback(async () => {
 const params = new URLSearchParams({ limit: "200" });
 if (type !== "all") params.set("type", type);
 if (status !== "all") params.set("status", status);
 try {
 const data = await api<{ transactions: TransactionRow[] }>(`/api/v1/admin/transactions?${params.toString()}`);
 setRows(data.transactions);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [type, status, router]);

 useEffect(() => {
 void load();
 }, [load]);

 const filtered = useMemo(() => {
 const list = rows ?? [];
 const q = query.trim().toLowerCase();
 if (!q) return list;
 return list.filter((tx) =>
 tx.id.toLowerCase().includes(q) ||
 tx.description.toLowerCase().includes(q) ||
 tx.user_name.toLowerCase().includes(q),
 );
 }, [rows, query]);

 const stats = useMemo(() => {
 const list = rows ?? [];
 const signed = (tx: TransactionRow) => n(tx.amount_minor) / 100;
 const gross = list.reduce((sum, tx) => sum + Math.abs(signed(tx)), 0);
 const fees = list.filter((tx) => tx.type === "commission" && tx.status === "completed").reduce((sum, tx) => sum + Math.abs(signed(tx)), 0);
 const pending = list.filter((tx) => tx.status === "pending").length;
 const failed = list.filter((tx) => tx.status === "failed").length;
 return { gross, fees, pending, failed };
 }, [rows]);

 function exportCsv() {
 const header = ["Date", "Ref", "User", "Type", "Amount", "Currency", "Status", "Description"];
 const lines = filtered.map((tx) =>
 [
 tx.created_at.slice(0, 10),
 tx.id,
 tx.user_name,
 tx.type,
 (n(tx.amount_minor) / 100).toFixed(2),
 tx.currency,
 tx.status,
 tx.description,
 ]
 .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
 .join(","),
 );
 const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = "workora-transactions.csv";
 anchor.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${filtered.length} rows to CSV`);
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Transactions"
 description="The full platform ledger: escrow funding, payouts, fees and refunds, newest first."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Transactions" }]}
 actions={
 <Button variant="secondary" size="md" onClick={exportCsv} disabled={filtered.length === 0}>
 <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
 Export CSV
 </Button>
 }
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard
 label="Gross volume"
 value={formatMoney(stats.gross)}
 hint="Absolute value, completed and pending"
 icon={<Icon icon={Wallet02Icon} size={16} strokeWidth={1.8} />}
 />
 <StatCard
 label="Fees collected"
 value={formatMoney(stats.fees, { decimals: true })}
 hint="Commission rows, completed only"
 icon={<Icon icon={CreditCardIcon} size={16} strokeWidth={1.8} />}
 />
 <StatCard
 label="Pending"
 value={formatNumber(stats.pending)}
 hint="Awaiting settlement"
 icon={<Icon icon={BankIcon} size={16} strokeWidth={1.8} />}
 />
 <StatCard label="Failed" value={formatNumber(stats.failed)} hint="Mostly payout rail rejections" />
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
 id="tx-search"
 className="pl-9"
 placeholder="Ref, description or user"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 </Field>
 </div>
 <div className="w-44">
 <Select ariaLabel="Filter by type" value={type} onChange={setType} options={TYPE_OPTIONS} />
 </div>
 <div className="w-44">
 <Select
 ariaLabel="Filter by status"
 value={status}
 onChange={setStatus}
 options={[
 { value: "all", label: "All statuses" },
 { value: "completed", label: "Completed" },
 { value: "pending", label: "Pending" },
 { value: "failed", label: "Failed" },
 ]}
 />
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load the ledger"
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
 compact
 icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
 title="No ledger entries match these filters"
 description="Try a different type or clear the search box."
 />
 ) : (
 <>
 <TableShell>
 <Table>
 <THead>
 <TH>Date</TH>
 <TH>Ref</TH>
 <TH>User</TH>
 <TH>Type</TH>
 <TH align="right">Amount</TH>
 <TH>Currency</TH>
 <TH>Status</TH>
 <TH>Description</TH>
 </THead>
 <tbody>
 {filtered.map((tx) => {
 const meta = STATUS_META[tx.status] ?? { label: labelize(tx.status), tone: "neutral" as const };
 const amount = n(tx.amount_minor) / 100;
 const sign = amount < 0 ? "-" : "+";
 return (
 <TR key={tx.id} className={tx.status === "failed" ? "bg-rose-50/50" : undefined}>
 <TD><span className="whitespace-nowrap text-sm text-neutral-500">{formatDateShort(tx.created_at)}</span></TD>
 <TD><span className="font-mono text-[11px] text-neutral-900">{tx.id.slice(0, 8)}</span></TD>
 <TD><span className="text-sm text-neutral-700">{tx.user_name}</span></TD>
 <TD><Badge tone={TYPE_BADGE_TONE[tx.type] ?? "neutral"}>{labelize(tx.type)}</Badge></TD>
 <TD align="right">
 <span className="text-sm font-medium text-neutral-900">
 {sign}{formatMoney(Math.abs(amount), { decimals: true })}
 </span>
 </TD>
 <TD><span className="text-sm text-neutral-500">{tx.currency}</span></TD>
 <TD><Badge tone={meta.tone}>{meta.label}</Badge></TD>
 <TD><span className="block max-w-56 truncate text-sm text-neutral-700" title={tx.description}>{tx.description}</span></TD>
 </TR>
 );
 })}
 </tbody>
 </Table>
 </TableShell>
 <p className="text-sm text-neutral-500">{filtered.length} {filtered.length === 1 ? "entry" : "entries"} shown (limit 200)</p>
 </>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 Amounts are signed by direction and minor units ÷ 100 · commission rows are the platform fee.
 </p>
 </div>
 );
}
