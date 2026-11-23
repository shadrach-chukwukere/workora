"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Wallet02Icon, Alert02Icon, CheckmarkCircle02Icon } from "@/lib/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface PaystackPayoutStatus {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  recipientCode: string | null;
}

export function PaystackPayoutCard() {
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [status, setStatus] = useState<PaystackPayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const res = await fetch("/api/v1/payments/paystack/status", {
        credentials: "include",
        cache: "no-store",
      });
      setStatus(await res.json() as PaystackPayoutStatus);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load payout status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function createRecipient() {
    if (!bank.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError("Please fill in all bank details.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/payments/paystack/recipient", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bank,
          account_number: accountNumber,
          account_name: accountName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Could not create Paystack recipient.");
      }
      const data = await res.json() as { success?: boolean; data?: { recipient_code: string } };
      if (!data.success || !data.data?.recipient_code) {
        throw new Error("Paystack recipient creation returned no data.");
      }
      toast.success("Paystack payout account connected", {
        description: "Your milestone payouts will be sent to this bank account.",
      });
      setBank("");
      setAccountNumber("");
      setAccountName("");
      await loadStatus();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not connect Paystack account";
      setError(message);
      toast.error("Paystack setup failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 max-w-3xl rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-1">
        <HugeiconsIcon icon={Wallet02Icon} size={18} strokeWidth={1.8} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-neutral-900">Payout setup</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        Connect a Paystack account to receive approved milestone transfers.
        Paystack collects and verifies your payout details.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Checking Paystack status…</p>
      ) : null}

      {!loading && error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4" role="alert">
          <div className="flex items-start gap-2">
            <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} className="mt-0.5 text-rose-600" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </div>
      ) : null}

      {!loading && status && !status.payoutsEnabled ? (
        <div className="mt-4 space-y-3">
          <p className={`text-sm font-medium ${status.connected ? "text-amber-700" : "text-neutral-700"}`}>
            {status.connected && status.detailsSubmitted
              ? "Paystack is reviewing your payout details."
              : status.connected
              ? "Finish Paystack setup to receive payouts."
              : "Paystack payout account not connected."}
          </p>
          <form onSubmit={(e) => { e.preventDefault(); void createRecipient(); }} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <Field label="Bank" required hint="Select your bank">
              <Input
                id="paystack-bank"
                placeholder="e.g. GTBank, Access Bank, Chase"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
            </Field>
            <Field label="Account number" required hint="Your bank account number">
              <Input
                id="paystack-account-number"
                type="tel"
                maxLength={20}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Account name" required hint="Name on the bank account">
              <Input
                id="paystack-account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              size="md"
              disabled={busy || !bank.trim() || !accountNumber.trim() || !accountName.trim()}
              loading={busy}
            >
              {status.connected ? "Update recipient" : "Connect Paystack"}
            </Button>
          </form>
        </div>
      ) : null}

      {!loading && status && status.payoutsEnabled ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-600">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-emerald-800">Paystack payouts are ready.</p>
          </div>
          {status.recipientCode && (
            <p className="mt-1 text-xs text-emerald-600 truncate">
              Recipient: {status.recipientCode}
            </p>
          )}
        </div>
      ) : null}

      {!loading && status && !status.payoutsEnabled && !status.connected && !error ? (
        <p className="mt-4 text-sm text-neutral-500">
          Add your bank details below to start receiving milestone payouts via Paystack.
        </p>
      ) : null}
    </section>
  );
}
