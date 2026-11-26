import type { Metadata } from "next";
import Link from "next/link";
import { AVAILABILITY_OPTIONS, CATEGORY_BASE, RATE_RANGES, SORT_OPTIONS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/select";
import { FreelancerCard } from "@/components/freelancer/freelancer-card";
import { Icon, Search01Icon, SearchRemoveIcon, StarIcon } from "@/lib/icons";
import { apiServerOr, type PublicFreelancer } from "@/lib/api-data";
import { serverApiBase } from "@/lib/api-base";
import { getSessionAccount } from "@/components/layout/session-guard";

const PAGE_SIZE = 9;

const description =
  "Search public freelancer profiles on Workora by skill, rate, availability and experience. Real rates, portfolios and client reviews.";

export const metadata: Metadata = {
  title: "Find talent",
  description,
  alternates: { canonical: "/find-talent" },
  openGraph: {
    type: "website",
    url: "/find-talent",
    title: "Find talent on Workora",
    description,
    siteName: "Workora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find talent on Workora",
    description,
  },
};

const SORTS = new Map<string, (typeof SORT_OPTIONS.talent)[number]>(SORT_OPTIONS.talent.map((s) => [s.value, s]));
const CATEGORIES = new Map(CATEGORY_BASE.map((c) => [c.id, c]));

/** Best-effort public GET with 30s revalidation. Returns null when the API is down or the envelope is bad. */
async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${serverApiBase}${path}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const envelope = (await res.json()) as { success: boolean; data?: T };
    if (!envelope.success || envelope.data === undefined) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

function param(value: string | string[] | undefined, fallback = ""): string {
  return Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);
}

interface FreelancersPage {
  freelancers: PublicFreelancer[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Map the UI sort values onto the values the API actually accepts (rate_asc / rate_desc). */
function apiSort(sort: string): string {
  switch (sort) {
    case "rate-asc":
      return "rate_asc";
    case "rate-desc":
      return "rate_desc";
    default:
      return sort;
  }
}

/** The running API parses rate bounds as min_rate / max_rate (whole dollars); the documented `rate` param is ignored. */
function rateParams(rate: string): string {
  const match = /^(\d+)-(\d+)$/.exec(rate);
  if (!match) return "";
  return `&min_rate=${match[1]}&max_rate=${match[2]}`;
}

export default async function FindTalentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getSessionAccount();
  // Shortlisting is a client-only feature; signed-out visitors never see the
  // save button, and we preload the saved ids so existing entries look saved.
  const canShortlist = viewer?.role === "client";
  const shortlistIds = canShortlist
    ? await apiServerOr<{ freelancerIds?: string[] }>("/api/v1/users/me/shortlist/ids", {}, false)
    : {};
  const savedTalentIds = new Set(shortlistIds.freelancerIds ?? []);
  const q = param(sp.q).trim().toLowerCase();
  const category = param(sp.category, "all");
  const availability = param(sp.availability, "all");
  const rate = param(sp.rate, "all");
  const sort = SORTS.has(param(sp.sort)) ? param(sp.sort) : "recommended";
  const requestedPage = Math.max(1, parseInt(param(sp.page, "1"), 10) || 1);

  const apiQuery = new URLSearchParams();
  if (q) apiQuery.set("q", q);
  if (category !== "all") apiQuery.set("category", category);
  if (availability !== "all") apiQuery.set("availability", availability);
  apiQuery.set("sort", apiSort(sort));
  apiQuery.set("page", String(requestedPage));
  apiQuery.set("perPage", String(PAGE_SIZE));
  if (viewer) apiQuery.set("excludeUserId", viewer.userId);
  const rawRate = rate !== "all" ? rateParams(rate) : "";

  // Gracefully renders nothing when the API is down.
  const data = await fetchPublic<FreelancersPage>(`/api/v1/freelancers?${apiQuery.toString()}${rawRate}`);
  const pageItems = data?.freelancers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const page = Math.min(requestedPage, totalPages);

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (category !== "all") qs.set("category", category);
  if (availability !== "all") qs.set("availability", availability);
  if (rate !== "all") qs.set("rate", rate);
  if (sort !== "recommended") qs.set("sort", sort);
  const chipHref = qs.toString() ? `/find-talent?${qs.toString()}` : "/find-talent";

  return (
    <div className="container-page py-10">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
            Specialists, ready to staff.
          </h1>
          <p className="mt-1.5 max-w-lg text-neutral-600">
            Every profile shows the real work, the real rates and the real reviews. No requests, no quoting theatre.
          </p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600">
          <Icon icon={StarIcon} size={13} strokeWidth={1.8} className="text-amber-500" />
          {formatNumber(total)} vetted profiles
        </p>
      </div>

      {/* Filters (native GET form) */}
      <form method="get" action="/find-talent" className="mt-6 grid gap-3 md:grid-cols-12">
        <label className="relative md:col-span-4">
          <span className="sr-only">Search freelancers</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, skill or headline"
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
          />
        </label>
        <FilterSelect
          name="category"
          defaultValue={category}
          label="Category"
          className="md:col-span-2"
          options={[{ value: "all", label: "All categories" }, ...CATEGORY_BASE.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect
          name="availability"
          defaultValue={availability}
          label="Availability"
          className="md:col-span-2"
          options={[{ value: "all", label: "Any availability" }, ...AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label }))]}
        />
        <FilterSelect
          name="rate"
          defaultValue={rate}
          label="Rate"
          className="md:col-span-1"
          options={[{ value: "all", label: "Any rate" }, ...RATE_RANGES.map((r) => ({ value: r.value, label: r.label }))]}
        />
        <FilterSelect
          name="sort"
          defaultValue={sort}
          label="Sort"
          className="md:col-span-2"
          options={SORT_OPTIONS.talent.map((s) => ({ value: s.value, label: s.label }))}
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 md:col-span-1"
        >
          Search
        </button>
      </form>
      {(q || category !== "all" || availability !== "all" || rate !== "all") && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {q ? <Chip href={chipHref} label={`Matches "${q}"`} clearKey="q" /> : null}
          {category !== "all" ? <Chip href={chipHref} label={CATEGORIES.get(category)?.name ?? category} clearKey="category" /> : null}
          {availability !== "all" ? <Chip href={chipHref} label={AVAILABILITY_OPTIONS.find((a) => a.value === availability)?.label ?? availability} clearKey="availability" /> : null}
          {rate !== "all" ? <Chip href={chipHref} label={RATE_RANGES.find((r) => r.value === rate)?.label ?? rate} clearKey="rate" /> : null}
        </div>
      )}

      {/* Results */}
      {pageItems.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
            title="No profiles match those filters"
            description="Try broadening the rate range or clearing the keyword."
            action={
              <Link href="/find-talent" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                Clear all filters
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((freelancer) => (
            <FreelancerCard
              key={freelancer.id}
              freelancer={freelancer}
              canShortlist={canShortlist}
              initiallyShortlisted={savedTalentIds.has(freelancer.id)}
            />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} className="mt-8" />
    </div>
  );
}

function Chip({ href, label, clearKey }: { href: string; label: string; clearKey: string }) {
  const [base, query] = href.split("?");
  const params = new URLSearchParams(query ?? "");
  params.delete(clearKey);
  params.delete("page");
  const suffix = params.toString();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-3 pr-1.5 text-xs text-neutral-600">
      {label}
      <Link
        aria-label={`Remove filter ${label}`}
        href={suffix ? `${base}?${suffix}` : base}
        className="inline-flex size-4 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        ×
      </Link>
    </span>
  );
}
