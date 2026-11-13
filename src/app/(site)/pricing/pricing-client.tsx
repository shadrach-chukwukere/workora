"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Icon, Tick02Icon } from "@/lib/icons";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { PublicPlan } from "@/lib/api-data";

type Interval = "monthly" | "annual";

/** Interactive pricing sections. `plans` is null when the plans request failed. */
export default function PricingClient({ plans }: { plans: PublicPlan[] | null }) {
  const [interval, setInterval] = useState<Interval>("monthly");

  const visible = useMemo(
    () =>
      (plans ?? [])
        .filter((plan) => plan.is_active)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [plans],
  );
  const freelancerPlans = useMemo(() => visible.filter((p) => p.audience === "freelancer"), [visible]);
  const clientPlans = useMemo(() => visible.filter((p) => p.audience === "client"), [visible]);

  return (
    <>
      {/* Hero */}
      <section className="container-page pb-14 pt-14 sm:pt-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">Pricing</p>
          <h1 className="mt-3 max-w-[48ch] text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl text-wrap-balance">
            Pricing that stays out of the way
          </h1>
          <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-neutral-600">
            Start free on both sides of the marketplace. Paid plans only add leverage, never a paywall on the
            work itself.
          </p>
          {plans !== null ? (
            <div className="mt-6">
              <Segmented<Interval>
                ariaLabel="Billing interval"
                value={interval}
                onChange={setInterval}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "annual", label: "Annual, two months free" },
                ]}
              />
            </div>
          ) : null}
        </div>
      </section>

      {plans === null ? (
        <section className="container-page pb-16">
          <div className="rounded-xl border border-neutral-200 bg-white flex flex-col items-center gap-2 p-10 text-center">
            <h2 className="text-base font-semibold text-neutral-900">Plans could not be loaded</h2>
            <p className="max-w-md text-sm leading-relaxed text-neutral-600">
              Something went wrong while reaching the marketplace. Refresh the page to try again, or check back in
              a few minutes.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* For freelancers */}
          <section aria-labelledby="freelancer-plans" className="container-page pb-4">
            <PlanSectionHeading
              id="freelancer-plans"
              eyebrow="For freelancers"
              title="Sell the work, keep the margin"
              sub={`An ${PLATFORM_FEE_PERCENT}% fee is deducted only when a milestone is released to you. Clients never pay it, and withdrawals are always free.`}
            />
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {freelancerPlans.length === 0 ? (
                <p className="text-sm text-neutral-500">No freelancer plans available right now.</p>
              ) : (
                freelancerPlans.map((plan) => <PlanCard key={plan.id} plan={plan} interval={interval} />)
              )}
            </div>
          </section>

          {/* For clients */}
          <section aria-labelledby="client-plans" className="container-page pb-16 pt-12">
            <PlanSectionHeading
              id="client-plans"
              eyebrow="For clients"
              title="Hire without the procurement theatre"
              sub="Posting is free and milestones are held by our payment provider until you approve the work."
            />
            <div className="mt-8 grid gap-5 md:grid-cols-2 md:max-w-4xl">
              {clientPlans.length === 0 ? (
                <p className="text-sm text-neutral-500">No client plans available right now.</p>
              ) : (
                clientPlans.map((plan) => <PlanCard key={plan.id} plan={plan} interval={interval} />)
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function PlanSectionHeading({
  id,
  eyebrow,
  title,
  sub,
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
        {title}
      </h2>
      <p className="mt-2 leading-relaxed text-neutral-600">{sub}</p>
    </div>
  );
}

function PlanCard({ plan, interval }: { plan: PublicPlan; interval: Interval }) {
  const monthly = plan.price_minor / 100;
  const free = monthly === 0;
  const annualTotal = monthly * 10;
  const shown = interval === "annual" ? annualTotal : monthly;
  const intervalLabel = free ? "" : interval === "annual" ? "/year" : "/month";

  return (
    <div
      className={
        plan.is_highlighted
          ? "relative flex flex-col rounded-xl border-2 border-brand-600 p-6"
          : "relative flex flex-col rounded-xl border border-neutral-200 p-6"
      }
    >
      {plan.is_highlighted ? (
        <Badge tone="brand" className="absolute -top-3 right-5">
          Most popular
        </Badge>
      ) : null}

      <h3 className="text-base font-semibold text-neutral-900">{plan.name}</h3>

      <div className="mt-4 flex items-end gap-1.5">
        <span className="text-4xl font-semibold tracking-tight text-neutral-900">
          {free ? "Free" : formatMoney(shown)}
        </span>
        {intervalLabel ? <span className="pb-1 text-sm text-neutral-500">{intervalLabel}</span> : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {free
          ? "Free forever"
          : interval === "annual"
            ? "(billed annually), two months free"
            : "Billed monthly"}
      </p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm leading-snug text-neutral-700">
            <Icon icon={Tick02Icon as any} size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        {plan.is_highlighted ? (
          <Button href="/register" className="w-full" size="lg">
            Start free
          </Button>
        ) : (
          <Button href="/register" variant="secondary" className="w-full" size="lg">
            Choose {plan.name}
          </Button>
        )}
      </div>
    </div>
  );
}
