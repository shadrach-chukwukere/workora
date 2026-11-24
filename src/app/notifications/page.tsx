import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { DataTable } from "@/components/ui/data-table";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ArrowRight02Icon } from "@/lib/icons";
import { getSessionAccount } from "@/components/layout/session-guard";
import { apiServer, sessionCookie } from "@/lib/api-server";
import { formatDateTime } from "@/lib/format";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  url: string | null;
}

export default async function NotificationsPage() {
  const cookie = await sessionCookie();
  if ((await getSessionAccount())?.needsRoleSelection) redirect("/onboarding/role");

  let rawData: { notifications: NotificationRow[]; total: number; unreadCount: number };
  try {
    rawData = await apiServer<{ notifications: NotificationRow[]; total: number; unreadCount: number }>(
      "/api/v1/notifications?perPage=50",
      undefined,
      cookie,
    );
  } catch {
    rawData = { notifications: [], total: 0, unreadCount: 0 };
  }

  // Transform data to match DataTable expected format
  const notifications = rawData.notifications.map(n => ({ original: n }));
  const unreadCount = rawData.unreadCount;
  const readCount = rawData.notifications.length - unreadCount;

  const columns = [
    {
      key: "title",
      header: "Notification",
      cell: (info: { original: NotificationRow }) => {
        const n = info.original;
        const typeLabelMap: Record<string, string> = {
          proposal: "Proposal",
          message: "Message",
          contract: "Contract",
          payment: "Payment",
          review: "Review",
          verification: "Verification",
          dispute: "Dispute",
          system: "System",
        };
        const badgeToneMap: Record<string, "neutral" | "brand" | "success" | "danger"> = {
          proposal: "brand" as "neutral" | "brand" | "success" | "danger",
          message: "neutral" as "neutral" | "brand" | "success" | "danger",
          contract: "success" as "neutral" | "brand" | "success" | "danger",
          payment: "success" as "neutral" | "brand" | "success" | "danger",
          review: "neutral" as "neutral" | "brand" | "success" | "danger",
          verification: "brand" as "neutral" | "brand" | "success" | "danger",
          dispute: "danger" as "neutral" | "brand" | "success" | "danger",
          system: "neutral" as "neutral" | "brand" | "success" | "danger",
        };
        const tone = badgeToneMap[n.type];
        const styleClass = tone === "brand"
          ? "bg-brand-100 text-brand-700"
          : tone === "success"
            ? "bg-emerald-100 text-emerald-700"
            : tone === "danger"
              ? "bg-rose-100 text-rose-700"
              : "bg-neutral-100 text-neutral-500";
        return (
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${styleClass}`}>
              <span className="relative inline-flex size-2 shrink-0 rounded-full bg-brand-500">
                <span className="absolute inset-0 animate-ping inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" aria-hidden></span>
              </span>
              {typeLabelMap[n.type]}
            </span>
            <div className="min-w-0">
              <p className={cn("block text-[13px] font-semibold", n.isRead ? "text-neutral-700" : "text-neutral-900")}>{n.title}</p>
              <p className="mt-0.5 block line-clamp-1 text-[12px] text-neutral-500">{n.body}</p>
              <p className="mt-1 block text-[11px] text-neutral-400">{formatDateTime(n.createdAt)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (info: { original: NotificationRow }) => {
        const n = info.original;
        return (
          <Badge tone={n.isRead ? "neutral" : "brand"}>
            {n.isRead ? "Read" : "Unread"}
          </Badge>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      cell: (info: { original: NotificationRow }) => {
        const n = info.original;
        if (!n.url) return <span className="text-[12px] text-neutral-400">—</span>;
        return (
          <Link href={n.url} className="text-[13px] font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
            Go to {n.url.split("/").pop()?.replace(/-/g, " ") ?? "item"}
            <span className="text-[12px]">
              <Icon icon={ArrowRight02Icon} size={12} strokeWidth={1.8} />
            </span>
          </Link>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
        actions={
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" size="sm" disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={String(rawData.total)} hint="Notifications in your feed" />
        <StatCard label="Unread" value={String(unreadCount)} hint="Notifications you haven't opened" />
        <StatCard label="Read" value={String(readCount)} hint="Notifications you've already seen" />
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={notifications}
          pageSize={15}
          emptyTitle="No notifications"
          emptyDescription="Your notification feed is empty. Activity from proposals, contracts, payments and reviews will appear here."
        />
      </div>
    </div>
  );
}