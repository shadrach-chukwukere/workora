import Link from "next/link";
import { Icon, CheckmarkCircle01Icon, ShieldCheckIcon, SparklesIcon, Wallet02Icon } from "@/lib/icons";
import { workspacePathForRole } from "@/lib/workspace";
import type { SessionAccount } from "@/components/layout/session-guard";
import { HeroSearch } from "@/components/layout/hero-search";

interface HeroProps {
  account?: SessionAccount | null;
}

const PROMISES = [
  {
    icon: ShieldCheckIcon,
    title: "Funded milestones",
    description: "Payment is secured before work starts",
  },
  {
    icon: Wallet02Icon,
    title: "Rates up front",
    description: "Compare budgets and hourly rates openly",
  },
  {
    icon: CheckmarkCircle01Icon,
    title: "Real reviews",
    description: "Feedback from completed projects only",
  },
];

export default function Hero({ account = null }: HeroProps) {
  const workspace = account ? workspacePathForRole(account.role) : "/register";

  return (
    <section className="border-b border-neutral-200 bg-[#faf9ff]">
      <div className="container-page py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-800">
            <Icon icon={SparklesIcon} size={14} strokeWidth={1.8} aria-hidden="true" />
            The independent work marketplace
          </span>

          <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950 sm:text-5xl lg:text-6xl">
            Good work starts with{" "}
            <span className="text-brand-700">the right people.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-neutral-600 sm:text-lg">
            Hire vetted freelancers or find your next project. Budgets are
            public, milestones are funded, and every step stays in one place.
          </p>

          <HeroSearch />

          <ul className="mx-auto mt-12 grid max-w-3xl gap-6 border-t border-neutral-200 pt-8 text-left sm:grid-cols-3 sm:gap-8">
            {PROMISES.map(({ icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-white text-brand-700">
                  <Icon icon={icon} size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-neutral-500">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-neutral-500">
            New to Workora?{" "}
            <Link
              href={workspace}
              className="font-semibold text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline"
            >
              {account ? "Go to your dashboard" : "Create a free account"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
