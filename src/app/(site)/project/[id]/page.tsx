import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionAccount } from "@/components/layout/session-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/ui/logo";
import {
  Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Briefcase02Icon,
  Building01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Flag01Icon,
  FolderCheckIcon,
  Globe02Icon,
  InformationCircleIcon,
  Location01Icon,
  Share01Icon,
  ShieldCheckIcon,
  Wallet01Icon,
  type IconName,
} from "@/lib/icons";
import { apiServer, apiServerOr } from "@/lib/api-data";
import { formatDate, formatMoney, formatNumber, labelize } from "@/lib/format";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");

function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

interface ProjectClient {
  id: string;
  name: string;
  image: string | null;
  companyName: string | null;
  companySize: string | null;
  industry: string | null;
  about: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  projectsCount: number | null;
  memberSince: string | null;
}

interface ProjectSkill {
  id: string;
  slug: string;
  name: string;
  position: number;
}

interface ProjectDetail {
  id: string;
  clientId: string;
  title: string;
  summary: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  status: "draft" | "open" | "in_progress" | "paused" | "completed" | "cancelled" | "flagged";
  budgetType: "fixed" | "hourly";
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  currency: string;
  experienceLevel: "entry" | "intermediate" | "expert" | null;
  durationBucket: "lt-1m" | "1-3m" | "3-6m" | "gt-6m" | null;
  proposalsCount: number;
  invitedOnly: boolean;
  publishedAt: string | null;
  deadline: string | null;
  closeReason: string | null;
  clientCompanyName: string | null;
  createdAt: string;
  updatedAt: string;
  client: ProjectClient | null;
  skills: ProjectSkill[];
}

interface ProjectListItem {
  id: string;
  title: string;
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
  publishedAt: string | null;
  createdAt: string;
}

async function getProject(encodedId: string): Promise<ProjectDetail | null> {
  try {
    const data = await apiServer<{ project: ProjectDetail }>(
      `/api/v1/projects/${encodedId}`,
      { public: true }
    );
    return data.project;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(encodeURIComponent(id));
  if (!project) return { title: "Project not found" };
  const description = project.description.slice(0, 160);
  return {
    title: project.title,
    description,
    alternates: { canonical: `/project/${encodeURIComponent(id)}` },
    openGraph: {
      type: "website",
      url: `/project/${encodeURIComponent(id)}`,
      title: `${project.title} on Workora`,
      description,
      siteName: "Workora",
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} on Workora`,
      description,
    },
  };
}

function priceLabel(project: ProjectDetail): string {
  const min = project.budgetMinMinor != null ? project.budgetMinMinor / 100 : null;
  const max = project.budgetMaxMinor != null ? project.budgetMaxMinor / 100 : null;
  const suffix = project.budgetType === "hourly" ? "/hr" : "";
  if (min != null && max != null && min !== max) {
    return `${formatMoney(min)} - ${formatMoney(max)}${suffix}`;
  }
  return `${formatMoney(min ?? max ?? 0)}${suffix}`;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flagged?: string }>;
}) {
  const { id } = await params;
  const { flagged } = await searchParams;
  const project = await getProject(encodeURIComponent(id));
  if (!project) notFound();
  if (project.status !== "open" && project.status !== "in_progress") notFound();

  const client = project.client;
  const clientName = client?.companyName ?? project.clientCompanyName ?? client?.name ?? "Client";
  const clientSince = client?.memberSince ? client.memberSince.slice(0, 4) : null;

  // Determine viewer role for role-aware CTA
  const account = await getSessionAccount();
  const viewerRole = account?.role ?? "visitor";

  const relatedList = await apiServerOr<{ projects: ProjectListItem[] }>(
    "/api/v1/projects",
    { projects: [] },
    true,
  );
  const related = relatedList.projects
    .filter((item) => item.id !== project.id && project.categoryId !== null && item.categoryId === project.categoryId)
    .slice(0, 3);

  const price = priceLabel(project);
  const priceCaption = project.budgetType === "fixed" ? "Fixed price" : "Hourly rate";

  const budgetMin = project.budgetMinMinor != null ? project.budgetMinMinor / 100 : null;
  const budgetMax = project.budgetMaxMinor != null ? project.budgetMaxMinor / 100 : null;
  const hasBudget = budgetMin != null || budgetMax != null;
  const organizationName = project.clientCompanyName ?? client?.companyName ?? client?.name;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: project.title,
    description: project.description,
    datePosted: toIsoDate(project.publishedAt ?? project.createdAt),
    ...(toIsoDate(project.deadline) ? { validThrough: toIsoDate(project.deadline) } : {}),
    ...(hasBudget
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: project.currency,
            value:
              budgetMin != null && budgetMax != null
                ? { "@type": "QuantitativeValue", minValue: budgetMin, maxValue: budgetMax }
                : { "@type": "QuantitativeValue", value: budgetMax ?? budgetMin },
          },
        }
      : {}),
    // The page lists the location as Worldwide.
    jobLocationType: "TELECOMMUTE",
    ...(organizationName ? { hiringOrganization: { "@type": "Organization", name: organizationName } } : {}),
    url: `${baseUrl}/project/${encodeURIComponent(id)}`,
  };

  async function flagListing(formData: FormData) {
    "use server";
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 10) {
      redirect(`/project/${encodeURIComponent(id)}`);
    }
    // Flags go to the trust queue; no external service in this build.
    redirect(`/project/${encodeURIComponent(id)}?flagged=1#flagged`);
  }

  // Determine CTA text based on viewer role
  const ctaText = viewerRole === "freelancer" ? "Apply" : viewerRole === "client" ? "Manage project" : "Create account to propose";
  const ctaHref = viewerRole === "freelancer" ? "/freelancer/projects?apply=" + project.id : viewerRole === "client" ? "/client/projects" : "/register";

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <a href="#main-content" className="skip-link" />

      <div className="container-page py-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] text-neutral-500">
          <Link href="/find-work" className="inline-flex items-center gap-1 hover:text-neutral-800">
            <Icon icon={ArrowLeft02Icon} size={14} strokeWidth={1.8} />
            Find work
          </Link>
          <span aria-hidden className="text-neutral-300">/</span>
          <span className="max-w-[55vw] truncate text-neutral-700" aria-current="page">
            {project.title}
          </span>
        </nav>

        {/* Flagged confirmation */}
        {flagged === "1" ? (
          <div
            id="flagged"
            role="status"
            className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <Icon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>
              Thanks. Our trust team reviews every flag within one business day. If this listing breaks our rules it will be taken down or fixed.
            </span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Main column */}
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <Monogram name={project.title} size={56} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {project.categoryName ? <Badge tone="outline">{project.categoryName}</Badge> : null}
                </div>
                <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight text-neutral-900 sm:text-3xl text-wrap-balance">
                  {project.title}
                </h1>
              </div>
            </div>

            {/* Meta grid */}
            <dl className="mt-6 grid grid-cols-2 gap-y-3 gap-x-4 sm:grid-cols-4">
              <MetaCell icon={Wallet01Icon} label="Budget" value={price} />
              <MetaCell
                icon={Briefcase02Icon}
                label="Type"
                value={project.budgetType === "fixed" ? "Fixed price" : "Hourly"}
              />
              <MetaCell
                icon={Clock01Icon}
                label="Experience"
                value={project.experienceLevel ? labelize(project.experienceLevel) : "-"}
              />
              <MetaCell
                icon={FolderCheckIcon}
                label="Duration"
                value={project.durationBucket ? labelize(project.durationBucket) : "-"}
              />
              <MetaCell
                icon={Calendar03Icon}
                label="Posted"
                value={formatDate(project.publishedAt ?? project.createdAt)}
              />
              <MetaCell
                icon={Calendar03Icon}
                label="Deadline"
                value={project.deadline ? formatDate(project.deadline) : "-"}
              />
              <MetaCell icon={Location01Icon} label="Location" value="Worldwide" />
              <MetaCell icon={Globe02Icon} label="Proposals" value={String(project.proposalsCount)} />
            </dl>

            {/* Skills */}
            {project.skills.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {project.skills.map((skill) => (
                  <Badge key={skill.id} tone="neutral">{skill.name}</Badge>
                ))}
              </div>
            ) : null}

            {/* About this project */}
            <section aria-labelledby="about-project" className="mt-8">
              <h2 id="about-project" className="text-lg font-semibold tracking-tight text-neutral-900">About this project</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-neutral-700">{project.description}</p>
            </section>

            {/* Payment flow honesty box */}
            <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5">
              <div className="flex items-center gap-2">
                <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} className="text-brand-700" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-brand-800">How payment works</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-brand-900">
                Milestone funding with release on your approval. Milestones are funded via our payment provider and
                are never touched by Workora unless you approve the work or a dispute is decided. An {PLATFORM_FEE_PERCENT}%
                fee is deducted from the milestone release on the freelancer side, never added to the budget you see as a
                client.
              </p>
            </div>

            {/* About the client */}
            <section aria-labelledby="about-client" className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
              <h2 id="about-client" className="text-lg font-semibold tracking-tight text-neutral-900">About the client</h2>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Monogram name={clientName} size={52} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-neutral-900">{clientName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                    <Icon icon={Building01Icon} size={13} strokeWidth={1.8} />
                    {client?.industry ?? "Independent"}
                    {client?.companySize ? ` · ${client.companySize} people` : ""}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-6 border-t border-neutral-100 pt-5 text-center sm:text-left">
                <div>
                  <dt className="text-xs text-neutral-500">Projects posted</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-neutral-900">{formatNumber(client?.projectsCount ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Client since</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-neutral-900">{clientSince ?? "-"}</dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-neutral-100 pt-5">
                <p className="text-sm font-semibold text-neutral-900">About</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                  {client?.about?.trim() || "This client hasn't added an About yet."}
                </p>
                {client?.id ? (
                  <Link
                    href={`/clients/${client.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    View public profile
                    <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
                  </Link>
                ) : null}
              </div>
            </section>
          </div>

          {/* Aside */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{priceCaption}</p>
              <p className="mt-1.5 text-4xl font-semibold tracking-tight text-neutral-900">{price}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-500">
                <Icon icon={Briefcase02Icon} size={14} strokeWidth={1.8} />
                {project.proposalsCount} {project.proposalsCount === 1 ? "proposal" : "proposals"} so far
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  href={ctaHref}
                  size="lg"
                  className="w-full"
                >
                  {ctaText}
                  <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} />
                </Button>
                <Button
                  href={`mailto:?subject=${encodeURIComponent(`Workora project: ${project.title}`)}&body=${encodeURIComponent(`I found this brief on Workora and thought it might fit: https://workora.com/project/${project.id}`)}`}
                  variant="secondary"
                  className="w-full"
                >
                  <Icon icon={Share01Icon} size={16} strokeWidth={1.8} />
                  Share link
                </Button>
              </div>

              {/* Report: native disclosure, no JS required */}
              <details className="relative">
                <summary
                  aria-label="Report this listing"
                  className="inline-flex h-9 w-full cursor-pointer list-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 [&::-webkit-details-marker]:hidden"
                >
                  <Icon icon={Flag01Icon} size={15} strokeWidth={1.8} />
                  Report this listing
                </summary>
                <div className="anim-pop absolute left-0 right-0 z-20 mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-dropdown">
                  <form action={flagListing} className="flex flex-col gap-2">
                    <label htmlFor="flag-reason" className="text-[13px] font-medium text-neutral-800">
                      Why is this listing a problem?
                    </label>
                    <textarea
                      id="flag-reason"
                      name="reason"
                      required
                      minLength={10}
                      rows={3}
                      placeholder="Spam, scam, off-platform payment request, misleading budget..."
                      className="w-full rounded-lg border border-neutral-200 p-2.5 text-sm leading-relaxed placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none"
                    />
                    <Button type="submit" size="sm">
                      Send flag
                    </Button>
                  </form>
                </div>
              </details>
              <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-neutral-500">
                <Icon icon={InformationCircleIcon} size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                You need an account to propose. Creating one is free and takes a minute.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetaCell({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string | number;
}) {
  return (
    <>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-neutral-900">{value}</dd>
    </>
  );
}