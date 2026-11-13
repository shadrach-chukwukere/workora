import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Icon, ArrowRight02Icon, EyeIcon, Globe02Icon, ShieldCheckIcon, Wallet01Icon } from "@/lib/icons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Workora is the marketplace we wanted to work in: verified signal, milestone payments that clear, and no theatre. Remote-first, built in San Francisco and London.",
};

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Mission */}
      <section className="container-page pb-16 pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">About Workora</p>
          <h1 className="mt-3 max-w-[48ch] text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl text-wrap-balance">
            We build the marketplace we wanted to work in
          </h1>
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-neutral-600">
            Freelance work runs on trust, and trust runs on evidence. Workora exists to make the evidence legible:
            real rates, verified histories, milestone payments that clear, and conversations that start with the work
            instead of the pitch.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles" className="border-t border-neutral-200 py-14">
        <div className="container-page">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Principles</p>
          <h2 id="principles" className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
            Three things we refuse to compromise
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <div key={principle.number} className="rounded-xl border border-neutral-200 p-6 sm:p-7">
                <span className="font-mono text-sm font-medium text-brand-700">{principle.number}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-neutral-900">{principle.title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{principle.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where we are */}
      <section aria-labelledby="where" className="border-t border-neutral-200 bg-neutral-50/60 py-14">
        <div className="container-page">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Where we are</p>
          <h2 id="where" className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
            Small team, in active development
          </h2>
          <ul className="mt-5 max-w-2xl space-y-2 text-[15px] leading-relaxed text-neutral-600">
            <li>A small, scrappy team builds Workora; nothing about it is staffed like a big-company marketplace.</li>
            <li>The product is in active development, and pages on this site render live from the API.</li>
            <li>Rough edges get fixed as they surface, and we would rather show you the real thing than a polished stand-in.</li>
          </ul>
        </div>
      </section>

      {/* How it works loop */}
      <section aria-labelledby="how" className="border-t border-neutral-200 py-14">
        <div className="container-page">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">How it works</p>
          <h2 id="how" className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
            The loop, from first post to final payment
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-neutral-200 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon icon={step.icon} size={18} strokeWidth={1.8} />
                  </span>
                  <span className="font-mono text-xs text-neutral-400">step {index + 1} of 3</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-neutral-500">
            Then it repeats. Most contracts on Workora begin with a single milestone and grow from there.
          </p>
        </div>
      </section>

      {/* Remote-first */}
      <section aria-labelledby="remote" className="border-t border-neutral-200 py-14">
        <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">How we work</p>
            <h2 id="remote" className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-neutral-900 text-wrap-balance">
              <Icon icon={Globe02Icon} size={22} strokeWidth={1.8} className="text-brand-600" />
              Remote-first, on purpose
            </h2>
          </div>
          <div className="max-w-2xl leading-relaxed text-neutral-600">
            <p>
              Workora is a distributed company. Our small team works across time zones from San Francisco and
              London, with no head office and no badge culture. We built a marketplace for people who do their
              best work without a commute, so we hold ourselves to the same standard.
            </p>
            <p className="mt-4">
              That is also why the product favors written briefs over calls, async review over status meetings,
              and milestone approvals over micromanagement. The workflow is the culture.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-page pb-16">
        <div className="rounded-3xl bg-neutral-900 px-8 py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl text-wrap-balance">
            Bring the brief. Leave with the work done.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-400">
            Whether you are hiring or getting hired, it starts with a free account.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button href="/register" size="lg">
              Create your account
              <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} />
            </Button>
            <Button href="/categories" variant="secondary" size="lg">
              Browse categories
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const PRINCIPLES = [
  {
    number: "01",
    title: "Serious about signal",
    body: "Verified work samples, real rates and completed-project history carry the weight, not charisma. Profiles show what you have shipped and what clients actually paid.",
  },
  {
    number: "02",
    title: "Payment that clears",
    body: "Every contract starts with a funded milestone held by our payment provider. You release it when the work is approved. No net-60, no invoicing roulette.",
  },
  {
    number: "03",
    title: "No theatre",
    body: "You see portfolios, reviews and response times, not polished promises. If a claim cannot be backed by a delivered contract, it does not make the profile.",
  },
];

const STEPS = [
  {
    icon: EyeIcon,
    title: "Post or pitch",
    body: "Clients post a brief with budget and timeline. Freelancers pitch with a scoped proposal and a milestone plan.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Fund the milestone",
    body: "The client funds the first milestone before work begins. Funds are held by our payment provider, not touched until approval.",
  },
  {
    icon: Wallet01Icon,
    title: "Approve and release",
    body: "Work is reviewed against the agreed scope. On approval, the milestone releases and the next one can begin.",
  },
];
