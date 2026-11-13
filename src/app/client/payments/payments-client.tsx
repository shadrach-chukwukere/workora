"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import {
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Download01Icon,
  Icon,
  PlusSignIcon,
  ShieldCheckIcon,
  TrashIcon,
  Wallet01Icon,
} from "@/lib/icons";
import { formatDate, formatMoney, labelize } from "@/lib/format";

export interface PaymentMethodRow {
  id: string;
  user_id: string;
  provider: string;
  provider_method_id: string | null;
  brand: string | null;
  last_four: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  created_at: string;
}

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
  methods,
  recentTransactions,
  lifetimeSpendMinor,
  escrowTotalMinor,
  fundedThisMonthMinor,
  monthLabel,
}: {
  methods: PaymentMethodRow[];
  recentTransactions: TransactionRow[];
  lifetimeSpendMinor: number;
  escrowTotalMinor: number;
  fundedThisMonthMinor: number;
  monthLabel: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodRow | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [numberError, setNumberError] = useState("");
  const [expiryError, setExpiryError] = useState("");
  const [cvcError, setCvcError] = useState("");

  function resetAddForm() {
    setNumber("");
    setExpiry("");
    setCvc("");
    setNameOnCard("");
    setNumberError("");
    setExpiryError("");
    setCvcError("");
  }

  function formatCardNumber(value: string) {
    return value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  async function addCard() {
    const cleanNumber = number.replace(/\s/g, "");
    let ok = true;
    if (cleanNumber.length < 12) {
      setNumberError("Enter the full card number");
      ok = false;
    } else setNumberError("");
    const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(expiry);
    if (!expiryMatch) {
      setExpiryError("Use MM/YY");
      ok = false;
    } else {
      const month = Number(expiryMatch[1]);
      if (month < 1 || month > 12) {
        setExpiryError("Month must be 01 to 12");
        ok = false;
      } else setExpiryError("");
    }
    if (cvc.trim().length < 3) {
      setCvcError("Enter the 3 or 4 digit code");
      ok = false;
    } else setCvcError("");
    if (!ok) return;

    const [, mm, yy] = expiryMatch!;
    const brand = cleanNumber.startsWith("5") ? "mastercard" : cleanNumber.startsWith("4") ? "visa" : "card";
    setActionPending(true);
    try {
      const res = await fetch(process.env.API_URL  + "/api/v1/payments/methods", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "stripe",
          brand,
          lastFour: cleanNumber.slice(-4),
          expMonth: Number(mm),
          expYear: 2000 + Number(yy),
        }),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Could not add the card", { description: body?.message ?? "The server rejected the card." });
        return;
      }
      setAddOpen(false);
      resetAddForm();
      toast.success("Card added to your payment methods.");
      router.refresh();
    } catch {
      toast.error("Could not add the card", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`${process.env.API_URL}/api/v1/payments/methods/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Could not remove the card", { description: body?.message ?? "The server rejected the removal." });
        return;
      }
      setDeleteTarget(null);
      toast.success("Card removed.");
      router.refresh();
    } catch {
      toast.error("Could not remove the card", { description: "Network error. Please try again." });
    } finally {
      setActionPending(false);
    }
  }

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
      "workora.com",
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
        description="Where client money sits and moves: escrow on active work, funding history and saved cards."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="In escrow now" value={formatMoney(escrowTotalMinor / 100)} hint="Funded milestones on your active contracts" icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Lifetime spend" value={formatMoney(lifetimeSpendMinor / 100)} hint="Across all your contracts" icon={<Icon icon={Wallet01Icon} size={16} strokeWidth={1.8} />} />
        <StatCard label="Funded this month" value={formatMoney(fundedThisMonthMinor / 100)} hint={`Card charges in ${monthLabel}`} icon={<Icon icon={CreditCardIcon} size={16} strokeWidth={1.8} />} />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Payment methods</h2>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Icon icon={PlusSignIcon} size={14} strokeWidth={2} />
            Add card
          </Button>
        </div>
        <ul className="divide-y divide-neutral-100">
          {methods.map((method) => {
            const brand = method.brand ?? method.provider;
            const expires =
              method.exp_month !== null && method.exp_year !== null
                ? `${String(method.exp_month).padStart(2, "0")}/${String(method.exp_year).slice(-2)}`
                : "-";
            return (
              <li key={method.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                    <Icon icon={CreditCardIcon} size={18} strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      <span className="capitalize">{brand}</span> ····{method.last_four ?? "····"}
                      {method.is_default ? <Badge tone="brand" className="ml-2 align-middle">Default</Badge> : null}
                    </p>
                    <p className="text-xs text-neutral-500">Expires {expires}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {method.is_default ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <Icon icon={CheckmarkCircle02Icon} size={15} strokeWidth={1.8} className="text-emerald-600" />
                      Charged first for funding
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove card ending in ${method.last_four ?? "unknown"}`}
                    onClick={() => setDeleteTarget(method)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon icon={TrashIcon} size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </li>
            );
          })}
          {methods.length === 0 ? (
            <li className="px-5 py-6 text-sm text-neutral-500">No cards saved yet. Add one to fund milestones.</li>
          ) : null}
        </ul>
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

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a card"
        description="Demo mode: cards are processed by the payment provider as demo tokens. Workora never stores your full card number."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button size="md" onClick={addCard} loading={actionPending}>
              Add card
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Card number" required error={numberError}>
            <Input inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={number} onChange={(event) => setNumber(formatCardNumber(event.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry" required error={expiryError}>
              <Input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} />
            </Field>
            <Field label="CVC" required error={cvcError}>
              <Input inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cvc} onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 4))} />
            </Field>
          </div>
          <Field label="Name on card" hint="As it appears on the card. Not sent to the server.">
            <Input autoComplete="cc-name" placeholder="Naomi Fields" value={nameOnCard} onChange={(event) => setNameOnCard(event.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => (actionPending ? undefined : setDeleteTarget(null))}
        title="Remove this card?"
        description={deleteTarget ? `The card ending in ${deleteTarget.last_four ?? "unknown"} will stop being available for funding milestones.` : "This card will stop being available for funding milestones."}
        confirmLabel="Remove card"
        tone="danger"
        loading={actionPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
