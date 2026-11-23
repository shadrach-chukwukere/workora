"use client";

import { Button } from "@/components/ui/button";
import { Alert02Icon, Wallet02Icon } from "@/lib/icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * Paystack is currently a UI-only preview. It intentionally makes no payout
 * API calls: bank details are collected by Paystack itself when payouts are
 * enabled, and this component must never accept or transmit them.
 */
export function PaystackPayoutCard() {
  return (
    <section className="mt-6 max-w-3xl rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-1">
        <HugeiconsIcon icon={Wallet02Icon} size={18} strokeWidth={1.8} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-neutral-900">Payout setup</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        Paystack powers payout setup in the live marketplace. Bank details are
        collected and verified by Paystack, never by Workora.
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} className="mt-0.5 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">Payout setup is not enabled in this preview.</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              Your payout details will be added securely through Paystack when live
              payouts are available. No bank information is requested here.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" size="md" disabled>
          Paystack setup coming soon
        </Button>
      </div>
    </section>
  );
}
