"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Download01Icon, Icon, Search01Icon, SearchRemoveIcon, Wallet01Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { formatDateShort, formatMoney, labelize } from "@/lib/format";

type TypeFilter = "all" | "milestone" | "commission" | "withdrawal" | "refund";

const TYPE_DOT: Record<string, string> = {
  milestone: "bg-emerald-500",
  payment: "bg-emerald-500",
  topup: "bg-emerald-500",
  payout: "bg-sky-500",
  commission: "bg-neutral-400",
  refund: "bg-sky-500",
  withdrawal: "bg-amber-500",
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

const TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "milestone", label: "Milestones" },
  { value: "commission", label: "Commission" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "refund", label: "Refunds" },
];

interface TransactionDto {
  id: string;
  type: string;
  amount_minor: number | string;
  currency: string;
  status: string;
  contract_id: string | null;
  description: string | null;
  created_at: string;
}

interface TransactionsResponse {
  transactions: TransactionDto[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  earnings: {
    pendingPayoutsMinor: number;
    availableBalanceMinor: number;
    lifetimeVolumeMinor: number;
  };
}

export default function FreelancerTransactionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (tab !== "all") params.set("type", tab);
      const res = await fetch(`/api/v1/payments/transactions?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      let envelope: { success?: boolean; message?: string; data?: TransactionsResponse } | null = null;
      try {
        envelope = (await res.json()) as { success?: boolean; message?: string; data?: TransactionsResponse };
      } catch {
        envelope = null;
      }
      if (!res.ok || !envelope?.success || envelope.data === undefined) {
        throw new Error(envelope?.message ?? `Transactions request failed with status ${res.status}`);
      }
      setData(envelope.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your transactions");
    } finally {
      setLoading(false);
    }
  }, [page, tab, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectTab(next: TypeFilter) {
    if (next === tab) return;
    setLoading(true);
    setTab(next);
    setPage(1);
  }

  const transactions = useMemo(() => data?.transactions ?? [], [data]);
  const earnings = data?.earnings;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.contract_id ?? "").toLowerCase().includes(q),
    );
  }, [transactions, query]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  function exportCsv() {
    const header = ["Date", "ID", "Description", "Type", "Amount", "Status"];
    const lines = filtered.map((t) => {
      const amount = Number(t.amount_minor) / 100;
      return [t.created_at.slice(0, 10), t.id, t.description ?? "", t.type, amount.toFixed(2), t.status]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workora-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows to CSV`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Every movement on your balance, searchable and exportable."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Transactions" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={exportCsv}>
              <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() =>
                toast.info("Withdrawals are processed by the payments provider", {
                  description: "Request a payout from the Earnings page; funds land in your default method on file.",
                })
              }
            >
              <Icon icon={Wallet01Icon} size={15} strokeWidth={1.8} />
              Withdraw
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Lifetime earnings" value={earnings ? formatMoney(earnings.lifetimeVolumeMinor / 100) : "—"} hint="Lifetime volume, net of platform commission" />
        <StatCard label="Available balance" value={earnings ? formatMoney(earnings.availableBalanceMinor / 100) : "—"} hint="Net of completed credits and debits" />
        <StatCard label="Pending payouts" value={earnings ? formatMoney(earnings.pendingPayoutsMinor / 100) : "—"} hint="Payout requests in flight" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Transaction type">
        {TABS.map((option) => {
          const active = tab === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(option.value)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <Field label="Search">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
              </span>
              <Input
                id="transaction-search"
                className="pl-9"
                placeholder="Description, type, contract or ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 flex flex-wrap items-center justify-between gap-3 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        error ? null : (
          <EmptyState
            icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
            title={total === 0 && tab === "all" && !query ? "No transactions yet" : "No transactions match these filters"}
            description={
              total === 0 && tab === "all" && !query
                ? "When milestones are paid or you withdraw, every movement shows up here."
                : "Try clearing the search box or switching the type filter."
            }
            action={
              query || tab !== "all" ? (
                <Button variant="secondary" size="md" onClick={() => { setQuery(""); setLoading(true); setTab("all"); setPage(1); }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-2 py-2.5 font-semibold">Description</th>
                  <th className="px-2 py-2.5 font-semibold">Type</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((t) => {
                  const statusMeta = STATUS_META[t.status] ?? { label: labelize(t.status), tone: "warning" as const };
                  const amount = Number(t.amount_minor) / 100;
                  const signed = amount >= 0 ? `+${formatMoney(amount)}` : formatMoney(amount);
                  return (
                    <tr key={t.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{formatDateShort(t.created_at)}</td>
                      <td className="max-w-80 px-2 py-3">
                        <p className="line-clamp-2 leading-snug text-neutral-800">{t.description ?? "Transaction"}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          {t.id.slice(0, 8)}{t.contract_id ? ` · contract ${t.contract_id.slice(0, 8)}` : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3">
                        <span className="inline-flex items-center gap-1.5 text-neutral-700">
                          <span aria-hidden className={cn("size-1.5 rounded-full", TYPE_DOT[t.type] ?? "bg-neutral-400")} />
                          {labelize(t.type)}
                        </span>
                      </td>
                      <td className={cn("whitespace-nowrap px-2 py-3 text-right tabular-nums font-medium", amount >= 0 ? "text-neutral-900" : "text-neutral-600")}>
                        {signed}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">Loading transactions</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-400">
            <p>
              Amounts are signed and net of platform commission where applicable · {filtered.length} {filtered.length === 1 ? "row" : "rows"}
              {query ? " (filtered on this page)" : ""} of {total} total
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }}>
                  Previous
                </Button>
                <span className="tabular-nums text-neutral-500">Page {data?.page ?? 1} of {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((p) => p + 1); }}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
