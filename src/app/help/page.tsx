import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-blocks";
import { Icon, ArrowRight02Icon, HelpCircleIcon, SchoolIcon, ShieldCheckIcon, Wallet02Icon, Message01Icon, StarIcon, Briefcase02Icon } from "@/lib/icons";

const description =
  "Workora help center: answers about accounts, profiles, projects, proposals, milestone payments, disputes and fees.";

export const metadata: Metadata = {
  title: "Help center",
  description,
  alternates: { canonical: "/help" },
  openGraph: {
    type: "website",
    url: "/help",
    title: "Help center · Workora",
    description,
    siteName: "Workora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Help center · Workora",
    description,
  },
};

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articles: { id: string; title: string; excerpt: string; href: string }[];
}

const CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Create your account, build your profile and take your first steps on Workora.",
    icon: <Icon icon={SchoolIcon} size={20} strokeWidth={1.8} className="text-brand-600" />,
    articles: [
      { id: "signup", title: "Creating your account", excerpt: "Sign up as a freelancer or client and verify your email to get started.", href: "/help/signup" },
      { id: "profile", title: "Building a strong profile", excerpt: "Add your skills, portfolio, hourly rate and availability to attract clients.", href: "/help/profile" },
      { id: "verify", title: "Identity verification", excerpt: "Complete identity verification to unlock higher budgets and faster payouts.", href: "/help/verify" },
    ],
  },
  {
    id: "for-clients",
    title: "For clients",
    description: "Post projects, review proposals, manage contracts and pay freelancers securely.",
    icon: <Icon icon={Briefcase02Icon} size={20} strokeWidth={1.8} className="text-emerald-600" />,
    articles: [
      { id: "post-project", title: "Posting a project", excerpt: "Write a clear brief, set your budget and receive proposals from vetted talent.", href: "/help/post-project" },
      { id: "evaluate", title: "Evaluating proposals", excerpt: "Compare freelancer bids, portfolios and ratings before making a hire.", href: "/help/evaluate" },
      { id: "escrow", title: "Milestone escrow", excerpt: "Fund milestones before work begins and release payments on approval.", href: "/help/escrow" },
    ],
  },
  {
    id: "for-freelancers",
    title: "For freelancers",
    description: "Find work, submit proposals, track milestones and get paid on time.",
    icon: <Icon icon={StarIcon} size={20} strokeWidth={1.8} className="text-amber-600" />,
    articles: [
      { id: "find-work", title: "Finding work", excerpt: "Browse open listings, filter by budget and skill, and apply to the right projects.", href: "/help/find-work" },
      { id: "proposals", title: "Writing winning proposals", excerpt: "Craft cover letters that highlight your relevant experience and portfolio.", href: "/help/proposals" },
      { id: "earnings", title: "Earnings and payouts", excerpt: "Track milestone payments, request withdrawals and view your transaction history.", href: "/help/earnings" },
    ],
  },
  {
    id: "trust-safety",
    title: "Trust & safety",
    description: "Disputes, refunds, platform fees and how Workora protects both sides.",
    icon: <Icon icon={ShieldCheckIcon} size={20} strokeWidth={1.8} className="text-rose-600" />,
    articles: [
      { id: "disputes", title: "Dispute resolution", excerpt: "How disagreements are reviewed and resolved by our trust team.", href: "/help/disputes" },
      { id: "fees", title: "Platform fees", excerpt: "The 8% freelancer fee on released milestones and what it covers.", href: "/help/fees" },
      { id: "refunds", title: "Refunds and cancellations", excerpt: "When funds are held, refunded or released through a dispute decision.", href: "/help/refunds" },
    ],
  },
];

type HelpSearchParams = {
  q?: string | string[];
};

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<HelpSearchParams>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const needle = query.toLowerCase();
  const results = needle
    ? CATEGORIES.flatMap((category) =>
        category.articles
          .filter((article) => `${article.title} ${article.excerpt}`.toLowerCase().includes(needle))
          .map((article) => ({ ...article, category: category.title })),
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Help center"
        description="Answers to the questions we actually get. Still stuck? Contact support and a human will reply within one business day."
        actions={
          <Button href="/contact" size="md">
            Contact support
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Button>
        }
      />

      {/* Quick search */}
      <section className="card">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-900">Search the help center</p>
        </div>
        <div className="px-5 py-4">
          <form action="/help" method="get" role="search" aria-label="Search the help center" aria-controls="help-results">
            <div className="relative max-w-lg">
              <label htmlFor="help-search" className="sr-only">
                Search help articles
              </label>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={HelpCircleIcon} size={16} strokeWidth={1.8} />
              </span>
              <input
                id="help-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Ask a question (e.g. how do escrow payments work?)"
                className="w-full h-10 rounded-lg border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              />
            </div>
            <button type="submit" className="sr-only">
              Search help articles
            </button>
          </form>
          <p className="mt-3 text-[12px] text-neutral-500">Try searching for "escrow", "dispute", "withdrawal" or "proposal".</p>
        </div>
      </section>

      {query && (
        <section id="help-results" aria-labelledby="help-results-title" aria-live="polite" className="card">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 id="help-results-title" className="text-sm font-semibold text-neutral-900">
              Results for &ldquo;{query}&rdquo;
            </h2>
            <p className="mt-1 text-xs text-neutral-500" role="status">
              {results.length === 0
                ? "No matching articles found."
                : `${results.length} matching article${results.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          {results.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {results.map((article) => (
                <li key={`${article.category}-${article.id}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-900">{article.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{article.excerpt}</p>
                    <p className="mt-1 text-[11px] font-medium text-neutral-400">{article.category}</p>
                  </div>
                  <Link href={article.href} className="ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800">
                    Read
                    <Icon icon={ArrowRight02Icon} size={12} strokeWidth={1.8} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-neutral-800">Try a different term</p>
              <p className="mt-1 text-xs text-neutral-500">
                Search for &ldquo;escrow&rdquo;, &ldquo;dispute&rdquo;, &ldquo;withdrawal&rdquo; or &ldquo;proposal&rdquo;, or contact support.
              </p>
              <Link href="/contact" className="mt-3 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800">
                Contact support
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Categories */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <Link key={cat.id} href={`/help/${cat.id}`} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              {cat.icon}
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">{cat.title}</h3>
            <p className="mt-1 text-xs text-neutral-500">{cat.description}</p>
            <div className="mt-auto flex items-center gap-2 text-[11px] font-medium text-brand-700">
              {cat.articles.length} articles
              <Icon icon={ArrowRight02Icon} size={12} strokeWidth={1.8} />
            </div>
          </Link>
        ))}
      </section>

      {/* Popular articles */}
      <section className="border-t border-neutral-100 pt-8">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 pb-4">
          <h2 className="text-sm font-semibold text-neutral-900">Popular articles</h2>
        </div>
        <ul className="divide-y divide-neutral-100">
          {CATEGORIES.flatMap((cat) => cat.articles.slice(0, 2)).map((article) => (
            <li key={article.id} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50">
              <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full bg-neutral-300" />
              <div className="min-w-0 flex-1">
                <p className="block text-[13px] font-medium text-neutral-900">{article.title}</p>
                <p className="mt-0.5 block text-xs text-neutral-500">{article.excerpt}</p>
              </div>
              <Link href={article.href} className="ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800">
                Read
                <Icon icon={ArrowRight02Icon} size={12} strokeWidth={1.8} />
              </Link>
            </li>
          ))}
          <li className="px-5 py-6 text-center text-sm text-neutral-500">
            Can&rsquo;t find what you&rsquo;re looking for?{" "}
            <Link href="/contact" className="font-medium text-brand-700 hover:text-brand-800">Contact support</Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
