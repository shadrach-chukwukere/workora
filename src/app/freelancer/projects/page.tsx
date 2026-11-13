"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Monogram } from "@/components/ui/logo";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import {
  EXPERIENCE_LEVELS,
} from "@/lib/constants";
import { formatMoney, formatRelative } from "@/lib/format";
import {
  ArrowUpRight02Icon,
  Icon,
  JobSearchIcon,
  Search01Icon,
  SearchRemoveIcon,
  Tick02Icon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

type BudgetFilter = "all" | "fixed" | "hourly";
type LevelFilter = "all" | "entry" | "intermediate" | "expert";

const BUDGET_CHIPS: { value: BudgetFilter; label: string }[] = [
  { value: "all", label: "All budgets" },
  { value: "fixed", label: "Fixed price" },
  { value: "hourly", label: "Hourly" },
];

interface ProjectDto {
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
  durationBucket: string | null;
  proposalsCount: number;
  invitedOnly: boolean;
  publishedAt: string | null;
  deadline: string | null;
  clientCompanyName: string | null;
}

interface ProjectsResponse {
  projects: ProjectDto[];
  total: number;
}

interface CategoryDto {
  id: string;
  name: string;
}

interface CategoriesResponse {
  categories: CategoryDto[];
}

interface MyProposalDto {
  project_id: string;
}

interface MyProposalsResponse {
  proposals: MyProposalDto[];
}

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body !== undefined ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  });
  if (res.status === 401) {
    const error = new Error("AUTH_REQUIRED");
    error.name = "AuthRequired";
    throw error;
  }
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!res.ok || !envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message ?? `Request to ${path} failed`);
  }
  return envelope.data;
}

function budgetText(project: ProjectDto): string {
  const min = (project.budgetMinMinor ?? 0) / 100;
  const max = project.budgetMaxMinor === null ? null : project.budgetMaxMinor / 100;
  if (project.budgetType === "hourly") {
    return max !== null ? `${formatMoney(min)} - ${formatMoney(max)}/hr` : `${formatMoney(min)}/hr`;
  }
  return max !== null && max > min ? `${formatMoney(min)} - ${formatMoney(max)} fixed` : `${formatMoney(min)} fixed`;
}

export default function FreelancerProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState<BudgetFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [bidTarget, setBidTarget] = useState<ProjectDto | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectData, categoryData, myProposals] = await Promise.all([
        apiClient<ProjectsResponse>("/api/v1/projects?status=open&perPage=50"),
        apiClient<CategoriesResponse>("/api/v1/categories").catch(() => ({ categories: [] as CategoryDto[] })),
        apiClient<MyProposalsResponse>("/api/v1/proposals/me?perPage=50").catch(() => ({ proposals: [] as MyProposalDto[] })),
      ]);
      setProjects(projectData.projects ?? []);
      setCategories(categoryData.categories ?? []);
      setAppliedIds(new Set((myProposals.proposals ?? []).map((p) => p.project_id)));
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load open projects");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (budget !== "all" && p.budgetType !== budget) return false;
      if (level !== "all" && p.experienceLevel !== level) return false;
      if (category !== "all" && p.categoryId !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q) ||
        (p.clientCompanyName ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, query, budget, level, category]);

  function clearFilters() {
    setQuery("");
    setBudget("all");
    setLevel("all");
    setCategory("all");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Find projects"
        description="Open briefs matched to what you do. Submit a proposal when the scope fits your week."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Find projects" }]}
        actions={
          <Button href="/find-work" variant="secondary" size="md">
            Browse all open work
            <Icon icon={ArrowUpRight02Icon} size={15} strokeWidth={1.8} />
          </Button>
        }
      />

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <Field label="Search projects">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
              </span>
              <Input
                id="project-search"
                className="pl-9"
                placeholder="Title, skill or company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>
        <div className="w-48">
          <Select
            ariaLabel="Filter by experience level"
            value={level}
            onChange={(v) => setLevel(v as LevelFilter)}
            options={[
              { value: "all", label: "All levels" },
              ...EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: l.label })),
            ]}
          />
        </div>
        <div className="w-52">
          <Select
            ariaLabel="Filter by category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {BUDGET_CHIPS.map((chip) => {
            const active = budget === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setBudget(chip.value)}
                aria-pressed={active}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border border-rose-100 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      <p className="text-sm text-neutral-500">
        {loading
          ? "Loading open projects"
          : `${filtered.length} ${filtered.length === 1 ? "open project" : "open projects"}`}
      </p>

      {!loading && filtered.length === 0 ? (
        projects.length === 0 && !error ? (
          <EmptyState
            icon={<Icon icon={JobSearchIcon} size={22} strokeWidth={1.8} />}
            title="No open projects right now"
            description="Check back soon, new briefs are posted as clients publish them."
          />
        ) : (
          <EmptyState
            icon={<Icon icon={SearchRemoveIcon} size={22} strokeWidth={1.8} />}
            title="No projects match these filters"
            description="Try a different search term, or clear the filters to see everything open now."
            action={
              <Button variant="secondary" size="md" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const alreadyApplied = appliedIds.has(project.id);
            const levelLabel =
              EXPERIENCE_LEVELS.find((l) => l.value === project.experienceLevel)?.label ??
              project.experienceLevel ??
              "Level not set";
            return (
              <article key={project.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <Monogram name={project.clientCompanyName ?? project.title} size={36} />
                  {project.categoryName ? <Badge tone="neutral">{project.categoryName}</Badge> : null}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/project/${project.id}`}
                    className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 hover:text-brand-800"
                  >
                    {project.title}
                  </Link>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-900">{budgetText(project)}</span>
                    <span aria-hidden>·</span>
                    <span>{levelLabel}</span>
                    <span aria-hidden>·</span>
                    <span>{project.publishedAt ? `Posted ${formatRelative(project.publishedAt)}` : "Posting date not set"}</span>
                  </p>
                  {project.clientCompanyName ? (
                    <p className="mt-1 text-xs text-neutral-500">{project.clientCompanyName}</p>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{project.summary}</p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                    <Icon icon={JobSearchIcon} size={14} strokeWidth={1.8} />
                    {project.proposalsCount} {project.proposalsCount === 1 ? "proposal" : "proposals"}
                  </span>
                  {alreadyApplied ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-[13px] font-medium text-emerald-800">
                      <Icon icon={Tick02Icon} size={15} strokeWidth={1.8} />
                      Proposal sent
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => setBidTarget(project)}>
                      Submit proposal
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <SubmitProposalModal
        project={bidTarget}
        onClose={() => setBidTarget(null)}
        onSent={(projectId) => {
          setAppliedIds((prev) => new Set(prev).add(projectId));
          setProjects((list) =>
            list.map((p) => (p.id === projectId ? { ...p, proposalsCount: p.proposalsCount + 1 } : p)),
          );
        }}
      />
    </div>
  );
}

function SubmitProposalModal({
  project,
  onClose,
  onSent,
}: {
  project: ProjectDto | null;
  onClose: () => void;
  onSent: (projectId: string) => void;
}) {
  const router = useRouter();
  const [bid, setBid] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [sending, setSending] = useState(false);

  const bidValue = Number(bid);
  const bidValid = bid.trim() !== "" && Number.isFinite(bidValue) && bidValue > 0;
  const letterValid = coverLetter.trim().length >= 50;
  const canSubmit = bidValid && letterValid && !sending;

  function close() {
    onClose();
    setBid("");
    setCoverLetter("");
  }

  async function submit() {
    if (!project || !canSubmit) return;
    setSending(true);
    try {
      await apiClient(`/api/v1/projects/${encodeURIComponent(project.id)}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          coverLetter: coverLetter.trim(),
          bidType: project.budgetType,
          bidAmountMinor: Math.round(bidValue * 100),
        }),
      });
      toast.success(`Proposal sent with ${formatMoney(bidValue)} bid`, {
        description: "The client is notified and typically responds within a few days.",
      });
      onSent(project.id);
      router.refresh();
      close();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      toast.error("Could not send the proposal", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  }

  if (!project) return null;

  const bidLabel = project.budgetType === "hourly" ? "Your hourly rate (USD)" : "Your bid (USD)";
  const bidHint =
    project.budgetType === "hourly"
      ? "Your rate per hour, before the 8% commission."
      : "Fixed price for the full scope, before the 8% commission.";

  return (
    <Modal
      open={Boolean(project)}
      onClose={close}
      title="Submit a proposal"
      description={project.title}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={close}>
            Cancel
          </Button>
          <Button size="md" disabled={!canSubmit} onClick={() => void submit()}>
            {sending ? "Sending" : "Send proposal"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={bidLabel} required hint={bidHint}>
          <Input
            id="proposal-bid"
            type="number"
            min={1}
            step="1"
            placeholder="e.g. 4500"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
          />
        </Field>
        <Field
          label="Cover letter"
          required
          hint="At least 50 characters. Lead with the outcome the client wants."
          error={coverLetter.trim().length > 0 && !letterValid ? "Tell the client a little more, at least 50 characters." : undefined}
        >
          <Textarea
            id="proposal-cover-letter"
            rows={6}
            placeholder="Hi, I have built..."
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
