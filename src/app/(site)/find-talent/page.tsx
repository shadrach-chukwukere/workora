import Link from "next/link";
import { AVAILABILITY_OPTIONS, CATEGORY_BASE, RATE_RANGES, SORT_OPTIONS } from "@/lib/constants";
import { formatMoney, formatNumber } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Icon, Search01Icon, SearchRemoveIcon, StarIcon, Tick02Icon } from "@/lib/icons";
import type { PublicFreelancer } from "@/lib/api-data";

const PAGE_SIZE = 9;
const API = process.env.API_URL ?? "http://localhost:3010";

const SORTS = new Map<string, (typeof SORT_OPTIONS.talent)[number]>(SORT_OPTIONS.talent.map((s) => [s.value, s]));
const AVAILABILITY = new Map<string, (typeof AVAILABILITY_OPTIONS)[number]>(AVAILABILITY_OPTIONS.map((a) => [a.value, a]));
const CATEGORIES = new Map(CATEGORY_BASE.map((c) => [c.id, c]));

/** Best-effort public GET with 30s revalidation. Returns null when the API is down or the envelope is bad. */
async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 30 } });
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
        <NativeSelect name="category" defaultValue={category} label="Category" className="md:col-span-2">
          <option value="all">All categories</option>
          {CATEGORY_BASE.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="availability" defaultValue={availability} label="Availability" className="md:col-span-2">
          <option value="all">Any availability</option>
          {AVAILABILITY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="rate" defaultValue={rate} label="Rate" className="md:col-span-1">
          <option value="all">Any rate</option>
          {RATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={sort} label="Sort" className="md:col-span-2">
          {SORT_OPTIONS.talent.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </NativeSelect>
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
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((freelancer) => {
            const availabilityTone =
              freelancer.availability === "available" ? "available" : freelancer.availability === "limited" ? "limited" : "booked";
            const rating = freelancer.rating_avg != null ? Number(freelancer.rating_avg) : null;
            return (
              <li key={freelancer.id}>
                <Link
                  href={`/freelancers/${freelancer.id}`}
                  className="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={freelancer.image ?? `https://i.pravatar.cc/150?u=${freelancer.id}`} name={freelancer.name} size="lg" alt="" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-neutral-900 group-hover:text-brand-800">
                          {freelancer.name}
                          {freelancer.verified_identity ? (
                            <Icon icon={Tick02Icon} size={14} strokeWidth={2} className="shrink-0 text-brand-600" aria-label="Identity verified" />
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-neutral-500"
                    title={AVAILABILITY.get(freelancer.availability)?.label}
                  >
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${availabilityTone === "available" ? "bg-emerald-500" : availabilityTone === "limited" ? "bg-amber-400" : "bg-neutral-300"}`}
                    />
                    {freelancer.availability === "available" ? "Open" : freelancer.availability === "limited" ? "Limited" : "Booked"}
                  </span>
                  <p className="mt-3 line-clamp-2 text-sm leading-snug text-neutral-700">{freelancer.headline}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                    <span className="text-sm font-semibold text-neutral-900">
                      {freelancer.hourly_rate_minor != null ? `${formatMoney(freelancer.hourly_rate_minor / 100)}/hr` : "Unset"}
                    </span>
                    {rating != null && Number.isFinite(rating) ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-900">
                        <Icon icon={StarIcon} size={12} strokeWidth={2} className="text-amber-500" />
                        {rating.toFixed(2)}
                        <span className="font-normal text-neutral-400">({freelancer.rating_count})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-900">
                        <Icon icon={StarIcon} size={12} strokeWidth={2} className="text-neutral-300" />
                        New
                      </span>
                    )}
                    <span>{formatNumber(freelancer.completed_count)} jobs</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} className="mt-8" />
    </div>
  );
}

function NativeSelect({
  name,
  defaultValue,
  label,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`relative block ${className ?? ""}`}>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={label}
        className="h-10 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-900 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
      >
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
        <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
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
