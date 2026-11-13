import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Progress } from "@/components/ui/progress";
import { Monogram } from "@/components/ui/logo";
import {
  ArrowRight02Icon,
  Briefcase02Icon,
  Icon,
  Notification01Icon,
  ShieldCheckIcon,
  Wallet01Icon,
} from "@/lib/icons";
import { formatDateShort, formatMoney, formatRelative } from "@/lib/format";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";

interface MeResponse {
  user: { id: string; name: string };
}

interface OwnProjectRow {
  id: string;
  title: string;
  status: string;
  budget_type: "fixed" | "hourly";
  budget_min_minor: string | number | null;
  budget_max_minor: string | number | null;
  proposals_count: number;
  deadline: string | null;
  category_name: string | null;
}

interface OwnProjectsResponse {
  projects: OwnProjectRow[];
}

interface ContractListItem {
  id: string;
  project_id: string;
  title_snapshot: string;
  total_minor: string | number;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
  started_at: string;
  ended_at: string | null;
  project?: { id: string; title: string } | null;
  counterpart?: { id: string; name: string | null; image: string | null; company_name?: string | null } | null;
  milestones: { total: number; paid: number; total_amount_minor: string | number; paid_amount_minor: string | number };
}

interface ContractsResponse {
  contracts: ContractListItem[];
}

interface MilestoneRow {
  id: string;
  title: string;
  amount_minor: string | number;
  status: "upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid" | "cancelled";
  due_date: string | null;
}

interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount_minor: string | number;
  created_at: string;
  description: string;
}

interface TransactionsResponse {
  transactions: TransactionRow[];
  earnings: { pendingPayoutsMinor: number; availableBalanceMinor: number; lifetimeVolumeMinor: number };
}

interface ReceivedProposalRow {
  id: string;
  project_title: string;
  project_status: string;
  bid_type: "fixed" | "hourly";
  bid_amount_minor: string | number;
  status: string;
  submitted_at: string;
  freelancer_id: string;
  freelancer_name: string;
  freelancer_image: string | null;
  freelancer_headline: string | null;
  rating_avg: string | null;
  completed_count: number | null;
}

interface ReceivedProposalsResponse {
  proposals: ReceivedProposalRow[];
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationRow[];
  total: number;
}

interface ActiveContract {
  list: ContractListItem;
  milestones: MilestoneRow[];
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientDashboard() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  let ownProjects: OwnProjectsResponse;
  let contractsRes: ContractsResponse;
  let transactionsRes: TransactionsResponse;
  let received: ReceivedProposalsResponse;
  let unread: NotificationsResponse;
  try {
    [me, ownProjects, contractsRes, transactionsRes, received, unread] = await Promise.all([
      apiServer<MeResponse>("/api/v1/users/me", undefined, cookie),
      apiServer<OwnProjectsResponse>("/api/v1/users/me/projects", undefined, cookie),
      apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
      apiServer<TransactionsResponse>("/api/v1/payments/transactions?limit=8", undefined, cookie),
      apiServer<ReceivedProposalsResponse>("/api/v1/users/me/project-proposals", undefined, cookie),
      apiServer<NotificationsResponse>("/api/v1/notifications?unread=true", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const contracts = contractsRes.contracts ?? [];
  const activeList = contracts.filter((c) => c.status === "active" || c.status === "paused" || c.status === "disputed");
  let activeContracts: ActiveContract[] = [];
  try {
    activeContracts = await Promise.all(
      activeList.map(async (list) => {
        const detail = await apiServer<{ contract: { milestones: MilestoneRow[] } }>(
          `/api/v1/contracts/${encodeURIComponent(list.id)}`,
          undefined,
          cookie,
        );
        return { list, milestones: detail.contract.milestones ?? [] };
      }),
    );
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const projects = ownProjects.projects ?? [];
  const transactions = transactionsRes.transactions ?? [];
  const pendingProposals = (received.proposals ?? [])
    .filter((p) => p.status === "pending")
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const latestPending = pendingProposals.slice(0, 3);
  const notifications = (unread.notifications ?? []).slice(0, 4);
  const unreadCount = unread.total ?? notifications.length;

  const activeProjectCount = projects.filter((p) => p.status === "open" || p.status === "in_progress").length;
  const contractTotalMinor = contracts.reduce((sum, c) => sum + Number(c.total_minor), 0);
  const completedPaymentSpend = transactions
    .filter((t) => t.type === "payment" && t.status === "completed")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount_minor)), 0);
  const lifetimeSpendMinor = contractTotalMinor + completedPaymentSpend;

  const escrowTotalMinor = activeContracts.reduce(
    (sum, c) =>
      sum +
      c.milestones
        .filter((m) => m.status === "funded" || m.status === "in_review" || m.status === "approved")
        .reduce((s, m) => s + Number(m.amount_minor), 0),
    0,
  );

  const firstName = me.user.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Where your projects, money and pending decisions stand today."
        actions={
          <Button href="/client/post-project" size="md">
            Post a project
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={String(activeProjectCount)}
          hint="Open plus in-progress listings"
          icon={<Icon icon={Briefcase02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Proposals awaiting you"
          value={String(pendingProposals.length)}
          hint="Pending decisions on your listings"
          icon={<Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Lifetime spend"
          value={formatMoney(lifetimeSpendMinor / 100)}
          hint="Contract value plus completed card charges"
          icon={<Icon icon={Wallet01Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Unread notifications"
          value={String(unreadCount)}
          hint="In-app notifications you have not opened"
          icon={<Icon icon={Notification01Icon} size={16} strokeWidth={1.8} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Active contracts with milestone progress */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">Active contracts</h2>
              <Link href="/client/contracts" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                All contracts
                <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
              </Link>
            </div>
            <ul className="divide-y divide-neutral-100">
              {activeContracts.map(({ list, milestones }) => {
                const total = milestones.length;
                const paid = milestones.filter((m) => m.status === "paid").length;
                const title = list.project?.title ?? list.title_snapshot;
                const counterpartName = list.counterpart?.company_name ?? list.counterpart?.name ?? "Freelancer";
                return (
                  <li key={list.id} className="flex items-center gap-4 px-5 py-4">
                    <Monogram name={title} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {counterpartName} · {formatMoney(Number(list.total_minor) / 100)} total
                      </p>
                      <div className="mt-2 flex w-48 items-center gap-2">
                        <Progress value={total === 0 ? 0 : Math.round((paid / total) * 100)} className="flex-1" />
                        <span className="text-[11px] tabular-nums text-neutral-500">
                          {paid}/{total} paid
                        </span>
                      </div>
                    </div>
                    <Link href="/client/contracts" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                      Review
                      <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
                    </Link>
                  </li>
                );
              })}
              {activeContracts.length === 0 ? (
                <li className="px-5 py-6 text-sm text-neutral-500">
                  No active contracts. Accepted proposals become contracts you can fund from here.
                </li>
              ) : null}
            </ul>
          </section>

          {/* Proposals in */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">Proposals in</h2>
              <Link href="/client/proposals" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                Proposals desk
                <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
              </Link>
            </div>
            <ul className="divide-y divide-neutral-100">
              {latestPending.map((proposal) => (
                <li key={proposal.id} className="flex items-center gap-4 px-5 py-4">
                  <Avatar src={proposal.freelancer_image ?? undefined} name={proposal.freelancer_name} size="md" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{proposal.freelancer_name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {proposal.project_title} · {formatMoney(Number(proposal.bid_amount_minor) / 100)}
                      {proposal.bid_type === "hourly" ? "/hr" : " fixed"} · {formatDateShort(proposal.submitted_at)}
                    </p>
                  </div>
                  <Link href="/client/proposals" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                    Evaluate
                    <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
                  </Link>
                </li>
              ))}
              {latestPending.length === 0 ? (
                <li className="px-5 py-6 text-sm text-neutral-500">No pending proposals. New proposals on your listings appear here.</li>
              ) : null}
            </ul>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Recent notifications */}
          <section className="card h-fit">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">Recent notifications</h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <Icon icon={Notification01Icon} size={14} strokeWidth={1.8} />
                {unreadCount} unread
              </span>
            </div>
            <ul className="divide-y divide-neutral-100">
              {notifications.map((notification) => (
                <li key={notification.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? "bg-transparent" : "bg-brand-600"}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-neutral-900">{notification.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{notification.body}</span>
                    <span className="mt-1 block text-[11px] text-neutral-400">{formatRelative(notification.createdAt)}</span>
                  </span>
                </li>
              ))}
              {notifications.length === 0 ? (
                <li className="px-5 py-6 text-sm text-neutral-500">You are all caught up. Nothing unread right now.</li>
              ) : null}
            </ul>
          </section>

          {/* Recent transactions */}
          <section className="card h-fit">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">Recent transactions</h2>
              <Link href="/client/transactions" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                Ledger
                <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
              </Link>
            </div>
            <ul className="divide-y divide-neutral-100">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium leading-snug text-neutral-800">{tx.description}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      {formatDateShort(tx.created_at)} · <Badge tone={tx.status === "completed" ? "success" : tx.status === "failed" ? "danger" : "neutral"}>{tx.status}</Badge>
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                    {formatMoney(Number(tx.amount_minor) / 100)}
                  </p>
                </li>
              ))}
              {transactions.length === 0 ? (
                <li className="px-5 py-6 text-sm text-neutral-500">No transactions yet. Charges and refunds will show up here.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>

      {/* Escrow strip */}
      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900 tabular-nums">{formatMoney(escrowTotalMinor / 100)} held in escrow</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              Escrow protects both sides: funds release only when you approve a milestone.
            </p>
          </div>
        </div>
        <Button href="/client/payments" variant="secondary" size="md" className="shrink-0">
          Payments overview
        </Button>
      </section>
    </div>
  );
}
