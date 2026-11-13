"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EarningsAreaChart } from "@/components/ui/charts";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { MIN_WITHDRAWAL } from "@/lib/constants";
import { formatMoney, formatRelative } from "@/lib/format";
import { Icon, Wallet01Icon } from "@/lib/icons";

export interface WithdrawalRow {
  id: string;
  status: string;
  amount_minor: number;
  description: string;
  created_at: string;
}

export interface MonthNetPoint {
  month: string;
  label: string;
  earningsMinor: number;
}

const WITHDRAWAL_STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "brand" }> = {
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Processing", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

const PAYOUT_DESTINATIONS = [
  { value: "wise-2211", label: "Wise · EUR account ····2211" },
  { value: "payoneer", label: "Payoneer · USD balance" },
  { value: "gtbank", label: "GTBank · NGN ····7702" },
];

export function EarningsClient({
  lifetimeEarningsMinor,
  availableBalanceMinor,
  monthlyNet,
  withdrawals,
}: {
  lifetimeEarningsMinor: number;
  availableBalanceMinor: number;
  monthlyNet: MonthNetPoint[];
  withdrawals: WithdrawalRow[];
}) {
  const available = availableBalanceMinor / 100;

  const inFlightFromLedger = withdrawals.filter((w) => w.status === "pending").length;
  const [extraInFlight, setExtraInFlight] = useState(0);
  const inFlight = inFlightFromLedger + extraInFlight;

  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const lastPoint = monthlyNet[monthlyNet.length - 1];
  const monthLabel = lastPoint
    ? new Date(`${lastPoint.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        timeZone: "UTC",
      })
    : "This month";
  const breakdown = [...monthlyNet].slice(-8).reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Earnings"
        description="What you have earned, what is sitting in escrow and what you can withdraw now."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Earnings" }]}
        actions={
          <Button size="md" onClick={() => setWithdrawOpen(true)}>
            <Icon icon={Wallet01Icon} size={15} strokeWidth={1.8} />
            Withdraw
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`${monthLabel} earnings`}
          value={formatMoney((lastPoint?.earningsMinor ?? 0) / 100)}
          hint="Month to date, milestone earnings net of commission"
        />
        <StatCard
          label="Lifetime earnings"
          value={formatMoney(lifetimeEarningsMinor / 100)}
          hint="All-time milestone earnings after commission"
        />
        <StatCard
          label="Available to withdraw"
          value={formatMoney(available)}
          hint={inFlight > 0 ? `${inFlight} ${inFlight === 1 ? "withdrawal" : "withdrawals"} in flight` : "No withdrawals in flight"}
        />
      </div>

      {/* Chart */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Earnings over time</h2>
        </div>
        <div className="px-3 py-4 sm:px-5">
          <EarningsAreaChart data={monthlyNet.map((p) => ({ label: p.label, value: p.earningsMinor / 100 }))} />
          <p className="mt-2 text-center text-[11px] text-neutral-400">
            Milestone earnings, net of the platform commission · {monthLabel} is month to date
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Withdrawals */}
        <section className="card">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Withdrawals</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {withdrawals.length === 0 ? (
              <li className="px-5 py-6 text-sm text-neutral-500">No withdrawals yet.</li>
            ) : null}
            {withdrawals.map((w) => {
              const meta = WITHDRAWAL_STATUS_META[w.status] ?? { label: w.status, tone: "brand" as const };
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{formatMoney(Math.abs(w.amount_minor) / 100)}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{w.description}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">Requested {formatRelative(w.created_at)}</p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Monthly breakdown */}
        <section className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Monthly breakdown</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Milestone earnings received, net of platform commission.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="px-5 py-2 font-semibold">Month</th>
                  <th className="px-5 py-2 text-right font-semibold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {breakdown.map((row) => {
                  const label = new Date(`${row.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  });
                  return (
                    <tr key={row.month}>
                      <td className="px-5 py-2.5 font-medium text-neutral-800">
                        {label}
                        {lastPoint && row.month === lastPoint.month ? (
                          <span className="ml-1.5 text-[11px] font-normal text-neutral-400">(to date)</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-neutral-900">
                        {formatMoney(row.earningsMinor / 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        onConfirm={() => setExtraInFlight((n) => n + 1)}
      />
    </div>
  );
}

function WithdrawModal({
  open,
  onClose,
  available,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  onConfirm: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("wise-2211");

  const value = Number(amount);
  const tooSmall = amount !== "" && Number.isFinite(value) && value < MIN_WITHDRAWAL;
  const tooLarge = amount !== "" && Number.isFinite(value) && value > available;
  const valid = amount !== "" && Number.isFinite(value) && value >= MIN_WITHDRAWAL && value <= available;
  const error = tooSmall
    ? `Minimum withdrawal is ${formatMoney(MIN_WITHDRAWAL)}`
    : tooLarge
      ? `You can withdraw at most ${formatMoney(available)}`
      : undefined;

  function confirm() {
    if (!valid) return;
    toast.success(`Withdrawal scheduled for ${formatMoney(value)}`, {
      description: "Funds typically arrive within 1 to 3 business days.",
    });
    setAmount("");
    onConfirm();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw funds" description={`Available balance: ${formatMoney(available)}`} size="sm">
      <div className="flex flex-col gap-4">
        <Field label="Amount (USD)" required error={error} hint={error ? undefined : `Minimum ${formatMoney(MIN_WITHDRAWAL)}`}>
          <Input
            id="withdraw-amount"
            type="number"
            min={0}
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Destination">
          <Select
            ariaLabel="Withdrawal destination"
            value={destination}
            onChange={setDestination}
            options={PAYOUT_DESTINATIONS}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" disabled={!valid} onClick={confirm}>
            Confirm withdrawal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
