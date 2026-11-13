"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { Download01Icon, Icon, Search01Icon } from "@/lib/icons";
import { formatDate, formatMoney, labelize } from "@/lib/format";

export interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount_minor: string | number;
  currency: string;
  description: string;
  created_at: string;
  contract_id: string | null;
  counterparty_id: string | null;
}

export interface ContractRef {
  id: string;
  counterpartName: string | null;
}

type ViewFilter = "all" | "payment" | "milestone" | "refund" | "topup";

const TYPE_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  payment: "brand",
  milestone: "success",
  refund: "success",
  topup: "neutral",
  commission: "warning",
  payout: "neutral",
  withdrawal: "neutral",
  failed: "danger",
};

export function TransactionsClient({
  transactions,
  contractRefs,
  totalContracts,
}: {
  transactions: TransactionRow[];
  contractRefs: ContractRef[];
  totalContracts: number;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [status, setStatus] = useState<"all" | "completed" | "pending" | "failed">("all");

  const contractNameById = useMemo(() => new Map(contractRefs.map((c) => [c.id, c.counterpartName])), [contractRefs]);

  const all = useMemo(() => [...transactions].sort((a, b) => b.created_at.localeCompare(a.created_at)), [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((tx) => {
      if (view === "payment" && tx.type !== "payment") return false;
      if (view === "milestone" && !(tx.type === "milestone" && tx.status === "completed")) return false;
      if (view === "refund" && tx.type !== "refund") return false;
      if (view === "topup" && tx.type !== "topup") return false;
      if (status !== "all" && tx.status !== status) return false;
      if (!q) return true;
      const counterparty = tx.contract_id ? contractNameById.get(tx.contract_id) ?? "" : "";
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        counterparty.toLowerCase().includes(q)
      );
    });
  }, [all, query, view, status, contractNameById]);

  const now = new Date();
  const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

  const monthFunded = all
    .filter((t) => t.type === "payment" && t.status === "completed" && t.created_at.startsWith(monthPrefix))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount_minor)), 0);
  const failedCount = all.filter((t) => t.status === "failed").length;

  function exportCsv() {
    const header = ["ID", "Date", "Description", "Type", "Amount (USD)", "Status", "Contract"];
    const lines = filtered.map((tx) =>
      [tx.id, tx.created_at.slice(0, 10), tx.description, tx.type, (Number(tx.amount_minor) / 100).toFixed(2), tx.status, tx.contract_id ?? ""]
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Every charge, refund and escrow movement on your account, exportable for your books."
        actions={
          <Button variant="secondary" size="md" onClick={exportCsv}>
            <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Funded in ${monthLabel}`} value={formatMoney(monthFunded / 100)} hint="Card charges this month" />
        <StatCard label="Total contracts" value={String(totalContracts)} hint="Every contract on this account" />
        <StatCard label="Failed attempts" value={String(failedCount)} hint="Declined charges, nothing was taken" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search01Icon} size={16} strokeWidth={1.8} />
          </span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search descriptions, IDs, types or counterparties"
            aria-label="Search transactions"
            className="pl-9"
          />
        </div>
        <Select ariaLabel="Filter by view" value={view} onChange={(v) => setView(v as ViewFilter)} className="sm:w-44" options={[
          { value: "all", label: "All activity" },
          { value: "payment", label: "Payments" },
          { value: "milestone", label: "Milestones" },
          { value: "refund", label: "Refunds" },
          { value: "topup", label: "Top-ups" },
        ]} />
        <Select ariaLabel="Filter by status" value={status} onChange={(v) => setStatus(v as typeof status)} className="sm:w-44" options={[
          { value: "all", label: "All statuses" },
          { value: "completed", label: "Completed" },
          { value: "pending", label: "Pending" },
          { value: "failed", label: "Failed" },
        ]} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon icon={SearchRemoveIcon} size={20} strokeWidth={1.6} />}
          title="No transactions match"
          description={
            all.length === 0
              ? "Nothing has moved on your account yet. Funded milestones and card charges will appear here."
              : "Clear the search or pick a different view or status."
          }
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((tx) => {
                  const counterparty = tx.contract_id ? contractNameById.get(tx.contract_id) : null;
                  return (
                    <tr key={tx.id} className="align-top hover:bg-neutral-50/60">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{formatDate(tx.created_at)}</td>
                      <td className="max-w-md px-5 py-3.5">
                        <span className="leading-snug text-neutral-800">{tx.description}</span>
                        <span className="mt-0.5 block text-[11px] text-neutral-400">
                          {tx.id}
                          {counterparty ? ` · ${counterparty}` : tx.contract_id ? ` · contract ${tx.contract_id.slice(0, 8)}` : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={TYPE_TONE[tx.type] ?? "neutral"}>{labelize(tx.type)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-neutral-900">
                        {formatMoney(Number(tx.amount_minor) / 100)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={tx.status === "completed" ? "success" : tx.status === "failed" ? "danger" : "neutral"}>{labelize(tx.status)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-neutral-500">
        Milestone funding fees are handled on the freelancer side; you never pay commission. Amounts are signed: negative values are charges to your card, positive values are refunds or top-ups.
      </p>
    </div>
  );
}
