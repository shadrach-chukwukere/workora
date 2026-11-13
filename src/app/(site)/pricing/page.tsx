import { Button } from "@/components/ui/button";
import { Icon, ArrowRight02Icon, CheckmarkCircle02Icon } from "@/lib/icons";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { apiServer } from "@/lib/api-data";
import type { PublicPlan } from "@/lib/api-data";
import PricingClient from "./pricing-client";

export default async function PricingPage() {
  let plans: PublicPlan[] | null = null;
  try {
    const data = await apiServer<{ plans: PublicPlan[] }>("/api/v1/subscription-plans", { public: true });
    plans = data.plans;
  } catch {
    plans = null;
  }

  return (
    <div className="bg-white">
      <PricingClient plans={plans} />

      {/* Enterprise band */}
      <section className="container-page pb-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Enterprise</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 text-wrap-balance">
              Custom contracts, security review and an SLA
            </h2>
            <p className="mt-2 leading-relaxed text-neutral-600">
              For teams running six-figure annual volume: custom terms, a security and procurement review,
              dedicated onboarding and a named contact. Built for finance, legal and IT to sign off without
              rewriting your process.
            </p>
          </div>
          <Button href="/contact" size="lg" className="shrink-0">
            Talk to sales
            <Icon icon={ArrowRight02Icon as any} size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="border-t border-neutral-200 bg-neutral-50/60 py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">FAQ</p>
            <h2 id="faq" className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
              The questions we actually get
            </h2>
            <p className="mt-3 leading-relaxed text-neutral-600">
              Still unsure? Write to us and a human will answer. We usually reply within one business day.
            </p>
            <Button href="/contact" variant="secondary" className="mt-5">
              Contact support
              <Icon icon={ArrowRight02Icon as any} size={15} strokeWidth={1.8} />
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-neutral-900 [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-transform duration-200 group-open:rotate-45"
                  >
                    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <path d="M6 1v10M1 6h10" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-page py-16">
        <div className="rounded-3xl bg-neutral-900 px-8 py-14 text-center">
          <Icon icon={CheckmarkCircle02Icon as any} size={28} strokeWidth={1.6} className="mx-auto text-brand-600" />
          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl text-wrap-balance">
            Start with the free plan. Upgrade when the work arrives.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-400">
            No credit card to join. Profiles, proposals and milestone payments work from day one.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button href="/register" size="lg">
              Create your account
              <Icon icon={ArrowRight02Icon as any} size={16} strokeWidth={1.8} />
            </Button>
            <Button href="/about" variant="ghost" size="lg">
              How Workora works
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Is the freelancer plan free?",
    answer:
      "Yes. Starter costs $0 and includes a full profile, portfolio, and a weekly proposal allowance. The 8% platform fee applies only when a milestone is released to you. Paid plans add leverage and visibility, never access to the work itself.",
  },
  {
    question: "When do I pay a fee?",
    answer: `An ${PLATFORM_FEE_PERCENT}% fee is deducted from the milestone release when a client approves your work. It is never charged to the client side, and withdrawals to your bank are free. If a milestone is never approved and is refunded, no fee is taken.`,
  },
  {
    question: "Can I cancel a paid plan?",
    answer:
      "Anytime, from Settings. Monthly plans run to the end of the current billing period and do not renew. Annual plans are pro-rated for the unused portion when cancelled.",
  },
  {
    question: "What about refunds?",
    answer:
      "Milestone funds are held by our payment provider and released only when the client approves the work, or through a dispute decision. If you believe a client is withholding approval unfairly, our trust team reviews the contract history and makes a binding call.",
  },
  {
    question: "Do annual plans come with refunds?",
    answer:
      "Within the first 30 days of an annual plan, we refund the unused portion pro-rated by month. After 30 days, the plan simply runs to the end of the term and does not renew unless you choose to.",
  },
  {
    question: "What about team pricing?",
    answer:
      "Client Business includes up to 5 team seats with shared talent lists. If you need more seats, SSO, custom contracts or a security review, talk to sales and we will put a written proposal together.",
  },
];
