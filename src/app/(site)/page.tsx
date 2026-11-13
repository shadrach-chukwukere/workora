import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/ui/logo";
import {
  ArrowRight02Icon,
  ChartLineIcon,
  CheckmarkCircle02Icon,
  GridViewIcon,
  HandshakeIcon,
  Icon,
  MarketingIcon,
  PaletteIcon,
  SchoolIcon,
  ShieldCheckIcon,
  SourceCodeIcon,
  StarIcon,
  TerminalIcon,
  TextIcon,
  Video01Icon,
  SmartPhone01Icon,
  type IconName,
} from "@/lib/icons";
import { apiServerOr } from "@/lib/api-data";
import { getSessionAccount } from "@/components/layout/session-guard";
import { workspacePathForRole } from "@/lib/workspace";
import { formatMoney, formatRelative } from "@/lib/format";
import Hero from "@/components/layout/Hero";
import { BriefcaseBusinessIcon, ArrowUpRightIcon, UserRoundIcon, BookmarkIcon, CodeIcon, SendIcon, LaptopIcon, CheckCircle, LockKeyIcon, ScaleIcon, Wallet02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import HowItWorks from "@/components/layout/HowItWorks";

const WORDMARKS = [
  "Loopwork",
  "Fernwell Health",
  "Harborlane",
  "Ostro Coffee",
  "Cairnwell Capital",
  "Solmate Energy",
];

interface ProjectSummary {
  id: string;
  title: string;
  categoryName: string | null;
  budgetType: "fixed" | "hourly";
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  clientCompanyName: string | null;
  publishedAt: string | null;
}

interface FreelancerSummary {
  id: string;
  name: string;
  image: string | null;
  headline: string;
  hourly_rate_minor: number | null;
  rating_avg: string | null;
  rating_count: number;
  completed_count: number;
}

interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

function budgetLabel(project: ProjectSummary): string {
  const min =
    project.budgetMinMinor != null ? project.budgetMinMinor / 100 : null;
  const max =
    project.budgetMaxMinor != null ? project.budgetMaxMinor / 100 : null;
  if (min != null && max != null && min !== max)
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  const single = max ?? min;
  return single != null ? formatMoney(single) : "Budget on request";
}

export default async function Home() {
  const [account, [{ projects }, { freelancers }, { categories }]] =
    await Promise.all([
      getSessionAccount(),
      Promise.all([
        apiServerOr<{ projects: ProjectSummary[] }>(
          "/api/v1/projects?status=open",
          { projects: [] },
          true,
        ),
        apiServerOr<{ freelancers: FreelancerSummary[] }>(
          "/api/v1/freelancers",
          { freelancers: [] },
          true,
        ),
        apiServerOr<{ categories: CategorySummary[] }>(
          "/api/v1/categories",
          { categories: [] },
          true,
        ),
      ]),
    ]);
  const workspace = workspacePathForRole(account?.role);
  const openList = projects;
  const roles = openList.slice(0, 3);
  const talent = freelancers.slice(0, 3);
  const shownCategories = categories.slice(0, 6);

  return (
    <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link" />

      {/* Hero */}
      <Hero />

      {/* Trusted by teams and companies */}
      <section className="border-y border-neutral-100 bg-[#FAFAFA]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-7 px-6 py-10 sm:px-10 lg:py-12">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Trusted by ambitious teams worldwide
          </p>

          <ul className="flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14 lg:justify-between lg:gap-x-8">
            {WORDMARKS.map((name) => (
              <li
                key={name}
                className="text-[17px] font-semibold tracking-[-0.045em] text-neutral-400 transition-colors duration-200 hover:text-neutral-800 sm:text-[19px]"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Categories - asymmetric: one featured + grid */}
      <section id="categories" className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
              {shownCategories.length > 0
                ? `${shownCategories.length} crafts you can hire from.`
                : "Categories"}
            </h2>
            <p className="mt-2 max-w-lg text-neutral-600">
              Every discipline we support, with the specialists to staff it.
            </p>
          </div>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            All categories
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Link>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shownCategories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/find-talent?category=${encodeURIComponent(category.slug)}`}
                className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                  <Icon
                    icon={categoryIcon(category.slug) as IconName}
                    size={19}
                    strokeWidth={1.8}
                  />
                </span>
                <span className="mt-3 block text-sm font-semibold text-neutral-900">
                  {category.name}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs text-neutral-500">
                  {category.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured talent - cleaner cards */}
      <section className="border-t border-neutral-100 bg-neutral-50/60">
        <div className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
                The people, before the pitch.
              </h2>
              <p className="mt-2 max-w-lg text-neutral-600">
                Portfolios you can audit, rates published up front, reviews from
                real clients.
              </p>
            </div>
            <Link
              href="/find-talent"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              See all talent
              <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
            </Link>
          </div>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {talent.map((person) => {
              const rating =
                person.rating_avg != null ? Number(person.rating_avg) : null;
              const hourly =
                person.hourly_rate_minor != null
                  ? person.hourly_rate_minor / 100
                  : null;
              return (
                <li key={person.id}>
                  <Link
                    href="/find-talent"
                    className="group block h-full rounded-2xl border border-neutral-200 bg-white p-6 transition-colors hover:border-brand-200"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={person.image ?? undefined}
                        name={person.name}
                        size="xl"
                        alt=""
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-neutral-900 group-hover:text-brand-800">
                          {person.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-500">
                          {person.headline}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-3 divide-x divide-neutral-100 border-t border-neutral-100 pt-4 text-center">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                          Rating
                        </dt>
                        <dd className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-neutral-900">
                          <Icon
                            icon={StarIcon}
                            size={13}
                            strokeWidth={1.8}
                            className="text-amber-500"
                          />
                          {rating != null ? rating.toFixed(2) : "New"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                          Projects
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-neutral-900">
                          {person.completed_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                          Rate
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-neutral-900">
                          {hourly != null
                            ? `$${Math.round(hourly)}/hr`
                            : "Open"}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Open roles - list layout instead of 3 equal cards */}
      <section className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
              Open briefs, public budgets.
            </h2>
            <p className="mt-2 max-w-lg text-neutral-600">
              {roles.length > 0
                ? `Currently screening ${openList.length} open listings`
                : "Currently screening open listings"}
              . Public budgets, honest timelines.
            </p>
          </div>
          <Link
            href="/find-work"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            All open roles
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Link>
        </div>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {roles.map((project) => (
            <li key={project.id}>
              <Link
                href={`/project/${project.id}`}
                className="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <Monogram
                    name={project.clientCompanyName ?? "Client"}
                    size={30}
                  />
                  <Badge tone="neutral">Open</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900 group-hover:text-brand-800">
                  {project.title}
                </p>
                <p className="mt-1.5 line-clamp-1 text-xs text-neutral-500">
                  {project.categoryName ?? "General"}
                </p>
                <div className="mt-auto flex items-baseline justify-between gap-3 pt-5">
                  <span className="text-sm font-semibold text-neutral-900">
                    {budgetLabel(project)}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {project.publishedAt
                      ? formatRelative(project.publishedAt)
                      : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

  
{/* How Workora works */}

<HowItWorks/>

      {/* Trust band */}

{/* Workora Protection */}

{/* Trust & Security */}
<section className="container-page pb-20">
  <div className="border-t border-neutral-200 pt-12 sm:pt-16">
    <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-20">

      <div>

        <h2 className="mt-5 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.045em] text-neutral-950 sm:text-4xl">
          Work with confidence. Every step.
        </h2>

        <p className="mt-4 max-w-sm text-sm leading-6 text-neutral-500">
          Your projects, payments and partnerships deserve a platform built on trust.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">
        {[
          {
            icon: ShieldCheckIcon,
            title: "Milestone protection",
            description: "Payments are funded before work begins and released upon client approval.",
          },
          {
            icon: LockKeyIcon,
            title: "Secure payments",
            description: "Transactions are handled through our payment provider.",
          },
          {
            icon: ScaleIcon,
            title: "Fair dispute resolution",
            description: "Disagreements receive a human review from our trust team.",
          },
          {
            icon: Wallet02Icon,
            title: "Transparent pricing",
            description: "8% freelancer fee on released milestones. No additional client platform fee.",
          },
        ].map(({ icon, title, description }) => (
          <div key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
            <Icon
              icon={icon}
              size={21}
              strokeWidth={1.6}
              className="mt-0.5 shrink-0 text-neutral-500"
            />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                {title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  </div>
</section>




      {/* Final CTA */}
      <section className="container-page pb-16">
        <div className="rounded-4xl bg-neutral-900 px-8 py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            Start the work. Leave the friction to us.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-400">
            One account, either chair. Sign up in minutes and see the
            marketplace from whichever side you pay.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              href={account ? workspace : "/register"}
              size="md"
              className="border-0 bg-white text-neutral-900 hover:bg-neutral-100"
            >
              {account ? "Go to your dashboard" : "Create your account"}
            </Button>
            <Button
              href="/pricing"
              variant="ghost"
              size="md"
              className="text-white hover:bg-neutral-800 hover:text-white"
            >
              See pricing
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function categoryIcon(slug: string): IconName {
  const map: Record<string, IconName> = {
    "web-development": SourceCodeIcon,
    "product-design": PaletteIcon,
    marketing: MarketingIcon,
    "writing-editing": TextIcon,
    "data-ai": ChartLineIcon,
    "video-audio": Video01Icon,
    "mobile-development": SmartPhone01Icon,
    "business-admin": TerminalIcon,
    "education-coaching": SchoolIcon,
  };
  return map[slug] ?? GridViewIcon;
}
