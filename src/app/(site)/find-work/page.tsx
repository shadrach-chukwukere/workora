import Link from "next/link";
import { BUDGET_RANGES, EXPERIENCE_LEVELS, SORT_OPTIONS } from "@/lib/constants";
import { formatMoney, formatNumber, formatRelative, labelize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Monogram } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ArrowUpRight02Icon, Briefcase02Icon, Icon, Search01Icon, SearchRemoveIcon } from "@/lib/icons";

const PAGE_SIZE = 9;
const API = (process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com") ?? "http://localhost:3010";

const SORTS = new Map<string, (typeof SORT_OPTIONS.projects)[number]>(SORT_OPTIONS.projects.map((s) => [s.value, s]));
const EXPERIENCE = new Map<string, (typeof EXPERIENCE_LEVELS)[number]>(EXPERIENCE_LEVELS.map((s) => [s.value, s]));

/** Shape of the public list payload (camelCase, straight from the API). */
interface ApiProject {
  id: string;
  clientId: string;
  title: string;
  summary: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  budgetType: "fixed" | "hourly";
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  currency: string;
  experienceLevel: "entry" | "intermediate" | "expert" | null;
  proposalsCount: number;
  publishedAt: string | null;
  clientCompanyName: string | null;
  createdAt: string;
}

interface ApiProjectDetail extends ApiProject {
  skills?: { id: string; slug: string; name: string; position: number }[];
}

interface ApiCategory {
  id: string;
  slug: string;
  name: string;
}

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

/** The API stores budgets in minor units; filter ranges are in whole dollars. */
function budgetValue(project: ApiProject): number {
  return (project.budgetMaxMinor ?? project.budgetMinMinor ?? 0) / 100;
}

function inBudget(project: ApiProject, range: string): boolean {
  const [min, max] = range.split("-").map(Number);
  const value = budgetValue(project);
  return value >= min && value <= max;
}

function budgetLabel(project: ApiProject): string {
  const min = project.budgetMinMinor != null ? project.budgetMinMinor / 100 : null;
  const max = project.budgetMaxMinor != null ? project.budgetMaxMinor / 100 : null;
  const suffix = project.budgetType === "hourly" ? "/hr" : "";
  if (min != null && max != null && min !== max) return `${formatMoney(min)} – ${formatMoney(max)}${suffix}`;
  return `${formatMoney(min ?? max ?? 0)}${suffix}`;
}

export default async function FindWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp.q).trim().toLowerCase();
  const category = param(sp.category, "all");
  const budget = param(sp.budget, "all");
  const exp = param(sp.exp, "all");
  const sort = SORTS.has(param(sp.sort)) ? param(sp.sort) : "newest";
  const requestedPage = Math.max(1, parseInt(param(sp.page, "1"), 10) || 1);

  // The public list endpoint caps perPage at 50 and filters category/budget only by raw UUID
  // or dollar bounds, so fetch the open marketplace once and filter on the page.
  const [listData, categoriesData] = await Promise.all([
    fetchPublic<{ projects: ApiProject[]; total: number }>("/api/v1/projects?status=open&perPage=50"),
    fetchPublic<{ categories: ApiCategory[] }>("/api/v1/categories"),
  ]);
  const openProjects = listData?.projects ?? [];
  const categories = categoriesData?.categories ?? [];
  const CATEGORIES = new Map(categories.map((c) => [c.id, c]));

  const filtered = openProjects
    .filter((project) => {
      if (category !== "all" && project.categoryId !== category) return false;
      if (exp !== "all" && project.experienceLevel !== exp) return false;
      if (budget !== "all" && !inBudget(project, budget)) return false;
      if (!q) return true;
      const haystack = [project.title, project.summary, project.description, project.categoryName ?? "", project.clientCompanyName ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      switch (sort) {
        case "budget-desc":
          return budgetValue(b) - budgetValue(a);
        case "budget-asc":
          return budgetValue(a) - budgetValue(b);
        case "proposals":
          return a.proposalsCount - b.proposalsCount;
        default:
          return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
      }
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Skills are not included in the list payload; fetch them per visible card (cached 30s).
  const skillsById = new Map<string, string[]>(
    await Promise.all(
      pageItems.map(async (project): Promise<[string, string[]]> => {
        const detail = await fetchPublic<{ project: ApiProjectDetail }>(`/api/v1/projects/${project.id}`);
        return [project.id, detail?.project.skills?.map((skill) => skill.name) ?? []];
      }),
    ),
  );

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (category !== "all") qs.set("category", category);
  if (budget !== "all") qs.set("budget", budget);
  if (exp !== "all") qs.set("exp", exp);
  if (sort !== "newest") qs.set("sort", sort);
  const chipHref = qs.toString() ? `/find-work?${qs.toString()}` : "/find-work";

  const activeChips = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      {q ? <Chip href={chipHref} label={`Matches "${q}"`} clearKey="q" /> : null}
      {category !== "all" ? <Chip href={chipHref} label={CATEGORIES.get(category)?.name ?? category} clearKey="category" /> : null}
      {budget !== "all" ? <Chip href={chipHref} label={BUDGET_RANGES.find((b) => b.value === budget)?.label ?? budget} clearKey="budget" /> : null}
      {exp !== "all" ? <Chip href={chipHref} label={`${EXPERIENCE.get(exp)?.label ?? exp} level`} clearKey="exp" /> : null}
    </div>
  );

  const hasActiveFilters = q !== "" || category !== "all" || budget !== "all" || exp !== "all";

  return (
    <div className="container-page py-10">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Find work</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
            Open briefs, public budgets.
          </h1>
          <p className="mt-1.5 max-w-lg text-neutral-600">
            {formatNumber(openProjects.length)} open listings from verified teams. Budgets and proposal counts are always visible, here and on
            the contract step.
          </p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600">
          <Icon icon={Briefcase02Icon} size={13} strokeWidth={1.8} />
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </p>
      </div>

      {/* Filters (native GET form: everything works without JS) */}
      <form method="get" action="/find-work" className="mt-6 grid gap-3 md:grid-cols-12">
        <label className="relative md:col-span-4">
          <span className="sr-only">Search briefs</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Role, skill, or keyword"
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
          />
        </label>
        <NativeSelect name="category" defaultValue={category} label="Category" className="md:col-span-2">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="budget" defaultValue={budget} label="Budget" className="md:col-span-2">
          <option value="all">Any budget</option>
          {BUDGET_RANGES.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="exp" defaultValue={exp} label="Experience" className="md:col-span-2">
          <option value="all">Any level</option>
          {EXPERIENCE_LEVELS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={sort} label="Sort" className="md:col-span-1">
          {SORT_OPTIONS.projects.map((s) => (
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
      {hasActiveFilters ? <div className="mt-2">{activeChips}</div> : null}

      {/* Results */}
      {pageItems.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
            title="No briefs match those filters"
            description="Try clearing the keyword or widening the budget range."
            action={
              <Link href="/find-work" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                Clear all filters
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((project) => {
            const skills = skillsById.get(project.id) ?? [];
            return (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  className="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Monogram name={project.clientCompanyName ?? "Workora client"} size={28} />
                      <span className="truncate text-xs font-medium text-neutral-500">
                        {project.clientCompanyName ?? "Workora client"}
                      </span>
                    </span>
                    <Badge tone="neutral">{labelize(project.status)}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900 group-hover:text-brand-800">
                    {project.title}
                  </p>
                  {skills.length > 0 ? (
                    <p className="mt-1.5 line-clamp-1 text-xs text-neutral-500">{skills.slice(0, 3).join(" · ")}</p>
                  ) : null}
                  <div className="mt-auto pt-5">
                    <div className="flex items-baseline justify-between gap-3 border-t border-neutral-100 pt-4">
                      <span className="text-sm font-semibold text-neutral-900">{budgetLabel(project)}</span>
                      <span className="text-xs text-neutral-400">{project.proposalsCount} proposals</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-neutral-400">
                      <span>{project.experienceLevel ? `${EXPERIENCE.get(project.experienceLevel)?.label ?? project.experienceLevel} level` : "Any level"}</span>
                      <span>{formatRelative(project.publishedAt ?? project.createdAt)}</span>
                    </div>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
                    View brief
                    <Icon icon={ArrowUpRight02Icon} size={12} strokeWidth={2} />
                  </span>
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
