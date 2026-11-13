import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EarningsAreaChart } from "@/components/ui/charts";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Monogram } from "@/components/ui/logo";
import {
  Alert02Icon,
  ArrowRight02Icon,
  Briefcase02Icon,
  HandshakeIcon,
  Icon,
  Message01Icon,
  ShieldCheckIcon,
  StarIcon,
  TrendingUpIcon,
  Wallet01Icon,
} from "@/lib/icons";
import { PROPOSAL_STATUS_META } from "@/lib/constants";
import { formatDateShort, formatMoney, formatPercent, formatRelative } from "@/lib/format";
import { apiServer, isAuthError, monthlyEarnings, sessionCookie } from "@/lib/api-server";
import type { ProposalStatus } from "@/lib/types";
import { redirect } from "next/navigation";

interface MeResponse {
  user: {
    id: string;
    name: string;
    headline: string | null;
    hourly_rate_minor: number | null;
    response_time_hours: number | null;
    rating_avg: string | null;
    rating_count: number;
    completed_count: number;
    earnings_minor: number;
  };
}

interface ContractListItem {
  id: string;
  project_id: string;
  title_snapshot: string;
  total_minor: number;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
  started_at: string;
  ended_at: string | null;
  project?: { id: string; title: string } | null;
  counterpart?: { id: string; name: string | null; image: string | null; company_name?: string | null } | null;
  milestones: { total: number; paid: number; total_amount_minor: number; paid_amount_minor: number };
}

interface ContractsResponse {
  contracts: ContractListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

interface MilestoneRow {
  id: string;
  title: string;
  amount_minor: number;
  status: "upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid" | "cancelled";
  due_date: string | null;
  in_review_at: string | null;
  updated_at: string;
}

interface ContractDetail {
  id: string;
  milestones: MilestoneRow[];
}

interface ProposalItem {
  id: string;
  status: ProposalStatus;
  bid_amount_minor: number;
  submitted_at: string;
  project?: { id: string; title: string } | null;
}

interface ProposalsResponse {
  proposals: ProposalItem[];
}

interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount_minor: number;
  created_at: string;
  description: string;
}

interface TransactionsResponse {
  transactions: TransactionRow[];
  earnings: { pendingPayoutsMinor: number; availableBalanceMinor: number; lifetimeVolumeMinor: number };
}

interface ConversationsResponse {
  conversations: { id: string; unreadCount: number }[];
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
  experienceLevel: string | null;
  proposalsCount: number;
  publishedAt: string | null;
}

interface ProjectsResponse {
  projects: ProjectListItem[];
}

interface CategoriesResponse {
  categories: { id: string; slug: string; name: string }[];
}

interface ActiveContract {
  list: ContractListItem;
  milestones: MilestoneRow[];
}

export default async function FreelancerDashboard() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  let contractsRes: ContractsResponse;
  let proposalsRes: ProposalsResponse;
  let transactionsRes: TransactionsResponse;
  let conversationsRes: ConversationsResponse;
  let projectsRes: ProjectsResponse;
  let categoriesRes: CategoriesResponse;
  try {
    [me, contractsRes, proposalsRes, transactionsRes, conversationsRes, projectsRes, categoriesRes] =
      await Promise.all([
        apiServer<MeResponse>("/api/v1/users/me", undefined, cookie),
        apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
        apiServer<ProposalsResponse>("/api/v1/proposals/me", undefined, cookie),
        apiServer<TransactionsResponse>("/api/v1/payments/transactions?perPage=50", undefined, cookie),
        apiServer<ConversationsResponse>("/api/v1/conversations", undefined, cookie),
        apiServer<ProjectsResponse>("/api/v1/projects", undefined, cookie),
        apiServer<CategoriesResponse>("/api/v1/categories", undefined, cookie),
      ]);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  const activeList = contractsRes.contracts.filter((c) => c.status === "active");
  let activeContracts: ActiveContract[] = [];
  try {
    activeContracts = await Promise.all(
      activeList.map(async (list) => {
        const detail = await apiServer<{ contract: ContractDetail }>(
          `/api/v1/contracts/${encodeURIComponent(list.id)}`,
          undefined,
          cookie,
        );
        return { list, milestones: detail.contract.milestones ?? [] };
      }),
    );
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  const user = me.user;
  const rating = user.rating_avg === null ? null : Number(user.rating_avg);

  const milestoneOf = (c: ActiveContract) => c.milestones;
  const sumMilestones = (milestones: MilestoneRow[], statuses: MilestoneRow["status"][]) =>
    milestones.filter((m) => statuses.includes(m.status)).reduce((sum, m) => sum + Number(m.amount_minor), 0);

  const escrowTotalMinor = activeContracts.reduce(
    (sum, c) => sum + sumMilestones(milestoneOf(c), ["funded", "in_review", "approved"]),
    0,
  );

  const series = monthlyEarnings(transactionsRes.transactions, new Date(), 13);
  const [prevMonth, lastMonth, thisMonth] = series.slice(-3);
  const monthDelta =
    prevMonth && lastMonth && prevMonth.earningsMinor > 0
      ? (lastMonth.earningsMinor - prevMonth.earningsMinor) / prevMonth.earningsMinor
      : 0;

  const earnings = transactionsRes.earnings;
  const availableBalance = Number(earnings.availableBalanceMinor) / 100;
  const pendingPayouts = Number(earnings.pendingPayoutsMinor) / 100;

  const pendingProposals = proposalsRes.proposals.filter((p) => p.status === "pending");
  const inFlight = proposalsRes.proposals.filter((p) => p.status === "pending" || p.status === "shortlisted").length;

  const unreadMessages = conversationsRes.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const awaitingReview = activeContracts.flatMap((c) =>
    c.milestones
      .filter((m) => m.status === "in_review")
      .map((m) => ({ milestone: m, contract: c.list })),
  );

  /* Featured open work in Amara's categories, excluding what she already bid on. */
  const categorySlugById = new Map(categoriesRes.categories.map((c) => [c.id, c.slug]));
  const bidProjectIds = new Set(proposalsRes.proposals.map((p) => p.project?.id).filter(Boolean) as string[]);
  const featured = projectsRes.projects
    .filter((p) => {
      const slug = p.categoryId ? categorySlugById.get(p.categoryId) : undefined;
      return (slug === "web-development" || slug === "data-ai") && !bidProjectIds.has(p.id);
    })
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Here's where your work, money and pending decisions stand today."
        actions={
          <Button href="/freelancer/projects" size="md">
            Find new projects
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatMoney(availableBalance)}
          hint={pendingPayouts > 0 ? `${formatMoney(pendingPayouts)} is on the way from withdrawals` : "No withdrawals in flight"}
          icon={<Icon icon={Wallet01Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="In escrow"
          value={formatMoney(escrowTotalMinor / 100)}
          hint="Milestones funded or awaiting approval on active contracts"
          icon={<Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label={`${lastMonth ? monthLabel(lastMonth.month) : ""} earnings`}
          value={formatMoney((lastMonth?.earningsMinor ?? 0) / 100)}
          delta={{ value: formatPercent(monthDelta), positive: monthDelta >= 0 }}
          hint={`${thisMonth ? monthLabel(thisMonth.month) : "This month"} is month to date: ${formatMoney((thisMonth?.earningsMinor ?? 0) / 100)}`}
          icon={<Icon icon={TrendingUpIcon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Proposals in flight"
          value={String(inFlight)}
          hint="Waiting on a client decision"
          icon={<Icon icon={Briefcase02Icon} size={16} strokeWidth={1.8} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active contracts */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Active contracts</h2>
            <Link href="/freelancer/contracts" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              All contracts
              <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
            </Link>
          </div>
          <ul className="divide-y divide-neutral-100">
            {activeContracts.length === 0 ? (
              <li className="px-5 py-6 text-sm text-neutral-500">No active contracts right now.</li>
            ) : null}
            {activeContracts.map(({ list: contract, milestones }) => {
              const total = milestones.length;
              const paid = milestones.filter((m) => m.status === "paid").length;
              const paidTotal = sumMilestones(milestones, ["paid"]);
              const wip = milestones.find((m) => m.status === "in_review" || m.status === "funded");
              const title = contract.project?.title ?? contract.title_snapshot;
              const counterpartName = contract.counterpart?.company_name ?? contract.counterpart?.name ?? "Client";
              return (
                <li key={contract.id}>
                  <Link href="/freelancer/contracts" className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-neutral-50">
                    <span aria-hidden className="mt-0.5 hidden bg-neutral-100 p-2 rounded-lg text-neutral-600 sm:inline-flex">
                      <Icon icon={HandshakeIcon} size={18} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-neutral-400">
                        {contract.id} · started {formatDateShort(contract.started_at)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{title}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-24">
                          <Progress value={total === 0 ? 0 : Math.round((paid / total) * 100)} />
                        </div>
                        <span className="text-xs text-neutral-500">
                          {paid} of {total} milestones paid
                        </span>
                      </div>
                      {wip ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-neutral-600">
                          <Badge tone={wip.status === "in_review" ? "warning" : "brand"}>
                            {wip.status === "in_review" ? "In review" : "Funded"}
                          </Badge>
                          <span className="truncate">{wip.title}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-neutral-900 tabular-nums">{formatMoney(paidTotal / 100)}</p>
                      <p className="text-xs text-neutral-400">of {formatMoney(Number(contract.total_minor) / 100)}</p>
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <Avatar src={contract.counterpart?.image ?? undefined} name={counterpartName} size="xs" alt="" />
                        <span className="max-w-24 truncate text-xs text-neutral-500">{counterpartName}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Needs attention */}
        <section className="card">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Needs your attention</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {awaitingReview.map(({ milestone }) => (
              <li key={milestone.id}>
                <AttentionItem
                  href="/freelancer/contracts"
                  icon={<Icon icon={ShieldCheckIcon} size={15} strokeWidth={1.8} />}
                  title={`Awaiting review: ${milestone.title}`}
                  body={`Submitted ${formatRelative(milestone.in_review_at ?? milestone.updated_at)}. The client has 5 business days to respond.`}
                  tone="warning"
                />
              </li>
            ))}
            {unreadMessages > 0 ? (
              <li>
                <AttentionItem
                  href="/freelancer/messages"
                  icon={<Icon icon={Message01Icon} size={15} strokeWidth={1.8} />}
                  title={`${unreadMessages} unread ${unreadMessages === 1 ? "message" : "messages"}`}
                  body="Review the latest conversations and reply while the details are fresh."
                  tone="brand"
                />
              </li>
            ) : null}
            <li>
              <AttentionItem
                href="/freelancer/settings"
                icon={<Icon icon={Alert02Icon} size={15} strokeWidth={1.8} />}
                title="Tax information incomplete"
                body="Add your tax details to keep milestone payouts and withdrawals on schedule."
              />
            </li>
          </ul>
          {pendingProposals.map((proposal) => {
            const project = proposal.project;
            if (!project) return null;
            return (
              <Link
                key={proposal.id}
                href="/freelancer/proposals"
                className="flex items-center gap-3 border-t border-neutral-100 px-5 py-3.5 transition-colors hover:bg-neutral-50"
              >
                <span aria-hidden>
                  <Monogram name={project.title} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-neutral-900">{project.title}</span>
                  <span className="text-xs text-neutral-500">
                    Bid {formatMoney(Number(proposal.bid_amount_minor) / 100)} · submitted {formatDateShort(proposal.submitted_at)}
                  </span>
                </span>
                <StatusBadge status={proposal.status} meta={PROPOSAL_STATUS_META} />
              </Link>
            );
          })}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings trend */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Earnings trend</h2>
            <Link href="/freelancer/earnings" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Earnings details
              <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
            </Link>
          </div>
          <div className="px-3 py-4 sm:px-5">
            <EarningsAreaChart data={series.map((p) => ({ label: p.label, value: p.earningsMinor / 100 }))} />
            <p className="mt-2 text-center text-[11px] text-neutral-400">
              Milestone earnings, net of the platform commission · {thisMonth ? monthLabel(thisMonth.month) : "This month"} is month to date
            </p>
          </div>
        </section>

        {/* Reputation snapshot */}
        <section className="card flex flex-col p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Reputation</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-800">
              <Icon icon={StarIcon} size={15} strokeWidth={1.8} className="text-amber-500" />
              {rating === null ? "New" : rating.toFixed(2)}
            </span>
            <span className="text-sm text-neutral-500">{user.rating_count} client reviews</span>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Hourly rate</dt>
              <dd className="font-semibold text-neutral-900 tabular-nums">
                {user.hourly_rate_minor ? `${formatMoney(Number(user.hourly_rate_minor) / 100)}/hr` : "Not set"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Completed projects</dt>
              <dd className="font-semibold text-neutral-900 tabular-nums">{user.completed_count}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Response time</dt>
              <dd className="font-semibold text-neutral-900">{user.response_time_hours ?? "—"}h avg</dd>
            </div>
          </dl>
          <Link href="/freelancer/reviews" className="mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium text-brand-700 hover:text-brand-800">
            Read what clients wrote
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Link>
        </section>
      </div>

      {/* Recommended work */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Open roles in your categories</h2>
          <Link href="/find-work" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
            Browse all projects
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Link>
        </div>
        <div className="grid gap-px bg-neutral-100 sm:grid-cols-3">
          {featured.length === 0 ? (
            <p className="col-span-full bg-white px-5 py-6 text-sm text-neutral-500">
              No open projects in your categories right now.
            </p>
          ) : null}
          {featured.map((project) => (
            <Link key={project.id} href={`/project/${project.id}`} className="group flex flex-col gap-2 bg-white p-5 transition-colors hover:bg-neutral-50">
              <div className="flex items-center justify-between">
                <Monogram name={project.title} size={26} />
                <Badge tone="neutral">Open</Badge>
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-neutral-900 group-hover:text-brand-800">{project.title}</p>
              <p className="text-xs text-neutral-500">
                {[project.categoryName, project.experienceLevel ? project.experienceLevel[0].toUpperCase() + project.experienceLevel.slice(1) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-auto flex items-baseline justify-between pt-2">
                <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                  {project.budgetType === "fixed"
                    ? formatMoney(Number(project.budgetMaxMinor ?? project.budgetMinMinor ?? 0) / 100)
                    : `${formatMoney(Number(project.budgetMinMinor ?? 0) / 100)} – ${formatMoney(Number(project.budgetMaxMinor ?? 0) / 100)}`}
                </span>
                <span className="text-xs text-neutral-400">{project.publishedAt ? formatRelative(project.publishedAt) : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttentionItem({
  href,
  icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "warning" | "brand";
}) {
  return (
    <Link href={href} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50">
      <span
        aria-hidden
        className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
          tone === "warning" ? "bg-amber-100 text-amber-800" : tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-neutral-100 text-neutral-600"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{body}</span>
      </span>
    </Link>
  );
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}
