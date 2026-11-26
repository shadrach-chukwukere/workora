"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import {
  CreditCardIcon,
  Download01Icon,
  Icon,
  ShieldCheckIcon,
  Wallet01Icon,
} from "@/lib/icons";
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
}

const STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = {
  completed: "success",
  failed: "danger",
  pending: "neutral",
};

export function PaymentsClient({
  recentTransactions,
  lifetimeSpendMinor,
  escrowTotalMinor,
  fundedThisMonthMinor,
  monthLabel,
}: {
  recentTransactions: TransactionRow[];
  lifetimeSpendMinor: number;
  escrowTotalMinor: number;
  fundedThisMonthMinor: number;
  monthLabel: string;
}) {
  function downloadReceipt(tx: TransactionRow) {
    const amount = Number(tx.amount_minor) / 100;
    const lines = [
      "Workora receipt",
      "----------------",
      `ID: ${tx.id}`,
      `Date: ${formatDate(tx.created_at)}`,
      `Type: ${tx.type}`,
      `Description: ${tx.description}`,
      `Status: ${tx.status}`,
      `Amount: ${formatMoney(amount)}`,
      "workora-phi.vercel.app",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workora-receipt-${tx.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Milestone funding and payment history. Paystack handles secure checkout."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="In escrow now" value={formatMoney(escrowTotalMinor / 100)} hint="Funded milestones on your active contracts" icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Lifetime spend" value={formatMoney(lifetimeSpendMinor / 100)} hint="Across all your contracts" icon={<Icon icon={Wallet01Icon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Funded this month" value={formatMoney(fundedThisMonthMinor / 100)} hint={`Card charges in ${monthLabel}`} icon={<Icon icon={CreditCardIcon} size={16} strokeWidth={1.8} />} />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Payment methods</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Card details are entered securely on Paystack Checkout when you fund a milestone. Workora never stores card numbers.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Recent charges</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Your latest payment activity, including refunds.</p>
        </div>
        <ul className="divide-y divide-neutral-100">
          {recentTransactions.map((tx) => {
            const amount = Number(tx.amount_minor) / 100;
            const label = tx.status === "completed" ? (tx.type === "refund" ? "Refunded" : "Completed") : tx.status === "failed" ? "Failed" : "Pending";
            return (
              <li key={tx.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 max-w-md">
                    <p className="text-[13px] font-medium leading-snug text-neutral-900">{tx.description}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {tx.id} · {formatDate(tx.created_at)} · {labelize(tx.type)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">{formatMoney(amount)}</p>
                      <Badge tone={STATUS_TONE[tx.status] ?? "neutral"}>{label}</Badge>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Download receipt for ${tx.id}`} onClick={() => downloadReceipt(tx)}>
                      <Icon icon={Download01Icon} size={16} strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
          {recentTransactions.length === 0 ? (
            <li className="px-5 py-6 text-sm text-neutral-500">No transactions yet. Charges and refunds will show up here.</li>
          ) : null}
        </ul>
      </section>

    </div>
  );
}
