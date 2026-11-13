import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { VolumeTrendChart } from "@/components/admin/volume-chart";
import { AdminAccessCard } from "@/components/admin/admin-access";
import {
  Alert02Icon,
  ArrowRight02Icon,
  Briefcase02Icon,
  CheckmarkCircle02Icon,
  Icon,
  Money01Icon,
  StampIcon,
  StarIcon,
  UserMultiple02Icon,
  Wallet02Icon,
} from "@/lib/icons";
import { ApiServerError, apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import { formatMoney, formatNumber, formatRelative } from "@/lib/format";

interface Overview {
  users: { freelancers: string | number; clients: string | number; admins: string | number; new_this_month: string | number; total: string | number };
  projects: { open: string | number; in_progress: string | number; completed: string | number };
  contracts: { active: string | number; completed: string | number };
  disputes: { open: string | number; under_review: string | number };
  verification: { pending: string | number; info_requested: string | number };
  revenueMinor: number;
  commissionMinor: number;
}

interface MonthlyPoint {
  month: string;
  signups: number;
  projectsPosted: number;
  contractsStarted: number;
  volumeMinor: number;
}

interface DisputeRow {
  id: string;
  reason: string;
  amount_minor: string | number;
  opened_at: string;
  opened_by_name: string;
  client_name: string;
  freelancer_name: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string;
  subject_name: string;
  reported: boolean;
}

interface UserRow {
  id: string;
  name: string;
  status: string;
}

const n = (v: string | number | null | undefined): number => {
  const parsed = Number(v ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const monthLabel = (month: string): string => {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
};

export default async function AdminDashboardPage() {
  const cookie = await sessionCookie();

  let overview: Overview;
  let monthly: MonthlyPoint[];
  let openDisputes: DisputeRow[];
  let reportedReviews: ReviewRow[];
  let suspendedUsers: UserRow[];
  let adminName = "Admin";

  try {
    const [overviewRes, monthlyRes, disputesRes, reviewsRes, suspendedRes, meRes] = await Promise.all([
      apiServer<Overview>("/api/v1/admin/overview", undefined, cookie),
      apiServer<{ months: MonthlyPoint[] }>("/api/v1/admin/analytics/monthly?months=6", undefined, cookie),
      apiServer<{ disputes: DisputeRow[] }>("/api/v1/admin/disputes?status=open", undefined, cookie),
      apiServer<{ reviews: ReviewRow[] }>("/api/v1/admin/reviews?reported=true", undefined, cookie),
      apiServer<{ users: UserRow[] }>("/api/v1/admin/users?status=suspended", undefined, cookie),
      apiServer<{ user: { name?: string | null } }>("/api/v1/users/me", undefined, cookie),
    ]);
    overview = overviewRes;
    monthly = monthlyRes.months;
    openDisputes = disputesRes.disputes.slice(0, 3);
    reportedReviews = reviewsRes.reviews.filter((r) => r.reported).slice(0, 3);
    suspendedUsers = suspendedRes.users;
    adminName = meRes.user.name?.trim() || "Admin";
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    if (error instanceof ApiServerError && error.status === 403) return <AdminAccessCard message={error.message} />;
    throw error;
  }

  const totalAccounts = n(overview.users.total);
  const newThisMonth = n(overview.users.new_this_month);
  const openListings = n(overview.projects.open);
  const activeContracts = n(overview.contracts.active);
  const openDisputeCount = n(overview.disputes.open);
  const pendingVerifications = n(overview.verification.pending);
  const infoRequested = n(overview.verification.info_requested);
  const revenue = n(overview.revenueMinor) / 100;
  const commission = n(overview.commissionMinor) / 100;

  const chartData = monthly.map((m) => ({ label: monthLabel(m.month), volume: n(m.volumeMinor) / 100 }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${adminName.split(" ")[0]}`}
        description="Where the marketplace stands today: money moving, work open, and the queues that need an ops decision."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Dashboard" }]}
        actions={
          <Button variant="secondary" size="md" href="/admin/analytics">
            Open analytics
          </Button>
        }
      />
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
        <Badge tone="outline">Environment: local development · demo data</Badge>
      </div>

      {/* Platform pulse */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard
          label="Total accounts"
          value={formatNumber(totalAccounts)}
          hint={`${formatNumber(n(overview.users.freelancers))} freelancers · ${formatNumber(n(overview.users.clients))} clients · ${formatNumber(n(overview.users.admins))} admins`}
          icon={<Icon icon={UserMultiple02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="New this month"
          value={formatNumber(newThisMonth)}
          hint="Accounts created in the trailing 30 days"
          icon={<Icon icon={UserMultiple02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Open listings"
          value={formatNumber(openListings)}
          hint={`${formatNumber(n(overview.projects.in_progress))} in progress · ${formatNumber(n(overview.projects.completed))} completed`}
          icon={<Icon icon={Briefcase02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Active contracts"
          value={formatNumber(activeContracts)}
          hint={`${formatNumber(n(overview.contracts.completed))} completed, all time`}
          icon={<Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Open disputes"
          value={formatNumber(openDisputeCount)}
          hint={`${formatNumber(n(overview.disputes.under_review))} under review`}
          icon={<Icon icon={Alert02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Pending verifications"
          value={formatNumber(pendingVerifications)}
          hint={`${formatNumber(infoRequested)} waiting on a resubmission`}
          icon={<Icon icon={StampIcon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Revenue volume"
          value={formatMoney(revenue)}
          hint="Completed transactions, all time"
          icon={<Icon icon={Wallet02Icon} size={16} strokeWidth={1.8} />}
        />
        <StatCard
          label="Commission earned"
          value={formatMoney(commission)}
          hint="Commission rows in the ledger, all time"
          icon={<Icon icon={Money01Icon} size={16} strokeWidth={1.8} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Volume trend */}
        <section className="card lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Gross volume, trailing 6 months</h2>
              <p className="mt-0.5 text-xs text-neutral-500">Sum of completed transactions per calendar month.</p>
            </div>
            <Link href="/admin/analytics" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Trends and cohorts
              <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
            </Link>
          </div>
          <div className="px-3 py-4 sm:px-5">
            <VolumeTrendChart data={chartData} />
            <p className="mt-2 text-center text-[11px] text-neutral-400">Months with no settled volume report 0. The current month is month to date.</p>
          </div>
        </section>

        {/* Needs your attention */}
        <section className="card">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Needs your attention</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {openDisputes.map((d) => (
              <AttentionRow
                key={d.id}
                href="/admin/disputes"
                icon={<Icon icon={Alert02Icon} size={15} strokeWidth={1.8} />}
                title={`Dispute: ${d.reason}`}
                body={`${d.client_name} vs ${d.freelancer_name} · ${formatMoney(n(d.amount_minor) / 100)} at stake · opened ${formatRelative(d.opened_at)}`}
                tone="warning"
              />
            ))}
            {reportedReviews.map((r) => (
              <AttentionRow
                key={r.id}
                href="/admin/reviews"
                icon={<Icon icon={StarIcon} size={15} strokeWidth={1.8} />}
                title={`Reported review, ${r.rating} star${r.rating === 1 ? "" : "s"}`}
                body={`${r.reviewer_name} on ${r.subject_name} · "${r.comment.slice(0, 90)}${r.comment.length > 90 ? "…" : ""}"`}
                tone="brand"
              />
            ))}
            <AttentionRow
              href="/admin/verification"
              icon={<Icon icon={StampIcon} size={15} strokeWidth={1.8} />}
              title={`${pendingVerifications} verification ${pendingVerifications === 1 ? "request" : "requests"} pending`}
              body={infoRequested > 0 ? `${infoRequested} waiting on a freelancer resubmission.` : "No resubmissions outstanding."}
              tone="warning"
            />
            <AttentionRow
              href="/admin/users"
              icon={<Icon icon={UserMultiple02Icon} size={15} strokeWidth={1.8} />}
              title={`${suspendedUsers.length} suspended ${suspendedUsers.length === 1 ? "account" : "accounts"}`}
              body={suspendedUsers.length > 0 ? suspendedUsers.slice(0, 3).map((u) => u.name).join(", ") : "No suspended accounts right now."}
              tone="brand"
            />
          </ul>
        </section>
      </div>

      <p className="text-center text-[11px] text-neutral-400">
        Volume and commission are settled on the platform ledger. Environment: local development · demo data.
      </p>
    </div>
  );
}

function AttentionRow({
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
  tone: "warning" | "brand";
}) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50">
        <span
          aria-hidden
          className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
            tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-700"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-neutral-900">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{body}</span>
        </span>
        <span className="ml-auto mt-1 shrink-0 text-neutral-400">
          <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
        </span>
      </Link>
    </li>
  );
}
