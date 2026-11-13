"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-blocks";
import { Segmented } from "@/components/ui/controls";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatRelative, labelize } from "@/lib/format";
import {
 Alert02Icon,
 HandshakeIcon,
 Icon,
 Message01Icon,
 Notification01Icon,
 Payment01Icon,
 SentIcon,
 StampIcon,
 StarIcon,
 Tick02Icon,
 TrashIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NotificationRow {
 id: string;
 type: string;
 title: string;
 body: string;
 url: string | null;
 is_read: boolean;
 created_at: string;
}

const TYPE_ICONS: Record<string, typeof Notification01Icon> = {
 proposal: SentIcon,
 contract: HandshakeIcon,
 message: Message01Icon,
 payment: Payment01Icon,
 review: StarIcon,
 verification: StampIcon,
 dispute: Alert02Icon,
 system: Notification01Icon,
};

export default function AdminNotificationsPage() {
 const router = useRouter();
 const [items, setItems] = useState<NotificationRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [filter, setFilter] = useState<"all" | "unread">("all");
 const [busyId, setBusyId] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await api<{ notifications: NotificationRow[] }>("/api/v1/notifications");
 setItems(data.notifications);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [router]);

 useEffect(() => {
 void load();
 }, [load]);

 const unread = (items ?? []).filter((n) => !n.is_read).length;
 const visible = (items ?? []).filter((n) => (filter === "all" ? true : !n.is_read));
 const hasRead = (items ?? []).some((n) => n.is_read);

 async function markAllRead() {
 try {
 await api("/api/v1/notifications/mark-all-read", { method: "POST" });
 setItems((list) => list?.map((n) => ({ ...n, is_read: true })) ?? list);
 toast.success("All notifications marked as read");
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Could not mark all read");
 }
 }

 async function markRead(id: string) {
 setBusyId(id);
 try {
 await api(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
 setItems((list) => list?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? list);
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Could not mark read");
 } finally {
 setBusyId(null);
 }
 }

 async function remove(id: string) {
 setBusyId(id);
 try {
 await api(`/api/v1/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
 setItems((list) => list?.filter((n) => n.id !== id) ?? list);
 toast.success("Notification deleted");
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Could not delete notification");
 } finally {
 setBusyId(null);
 }
 }

 async function clearRead() {
 try {
 await api("/api/v1/notifications", { method: "DELETE" });
 setItems((list) => list?.filter((n) => !n.is_read) ?? list);
 toast.success("Read notifications cleared");
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Could not clear read notifications");
 }
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 if (error) {
 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Notifications"
 description="Your admin inbox."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Notifications" }]}
 />
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load notifications"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Notifications"
 description={
 unread === 0
 ? "Your admin inbox is fully caught up."
 : `Your admin inbox. ${unread} unread ${unread === 1 ? "message" : "messages"}.`
 }
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Notifications" }]}
 actions={
 <>
 <Button variant="ghost" size="md" onClick={() => void clearRead()} disabled={!hasRead}>
 Clear read
 </Button>
 <Button size="md" onClick={() => void markAllRead()} disabled={unread === 0}>
 Mark all read
 </Button>
 </>
 }
 />

 <div className="flex flex-wrap items-center justify-between gap-3">
 <Segmented
 value={filter}
 ariaLabel="Filter notifications"
 onChange={(v) => setFilter(v as "all" | "unread")}
 options={[
 { value: "all", label: `All (${items?.length ?? 0})` },
 { value: "unread", label: `Unread (${unread})` },
 ]}
 />
 </div>

 {items === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : visible.length === 0 ? (
 <EmptyState
 icon={<Icon icon={Notification01Icon} size={22} strokeWidth={1.8} />}
 title="Inbox zero"
 description={filter === "unread" ? "Nothing unread right now." : "All caught up."}
 />
 ) : (
 <div className="card divide-y divide-neutral-100">
 {visible.map((n) => {
 const TypeIcon = TYPE_ICONS[n.type] ?? Notification01Icon;
 const busy = busyId === n.id;
 return (
 <div key={n.id} className="flex items-start gap-3 px-5 py-4">
 <span
 aria-hidden
 className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
 >
 <Icon icon={TypeIcon} size={16} strokeWidth={1.8} />
 </span>
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 {!n.is_read ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
 <p className={cn("text-[13px] font-medium", n.is_read ? "text-neutral-600" : "text-neutral-900")}>
 {n.title}
 </p>
 </div>
 <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{n.body}</p>
 <p className="mt-1.5 text-[11px] text-neutral-400">
 {formatRelative(n.created_at)} · {labelize(n.type)}
 </p>
 </div>
 <div className="flex shrink-0 items-center gap-1.5">
 {n.url ? (
 <Button variant="ghost" size="sm" href={n.url}>
 Open
 </Button>
 ) : null}
 {!n.is_read ? (
 <button
 type="button"
 onClick={() => void markRead(n.id)}
 disabled={busy}
 aria-label={`Mark "${n.title}" as read`}
 title="Mark as read"
 className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
 >
 <Icon icon={Tick02Icon} size={16} strokeWidth={1.8} />
 </button>
 ) : null}
 <button
 type="button"
 onClick={() => void remove(n.id)}
 disabled={busy}
 aria-label={`Delete "${n.title}"`}
 title="Delete notification"
 className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
 >
 <Icon icon={TrashIcon} size={16} strokeWidth={1.8} />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 <p className="text-center text-[11px] text-neutral-400">
 Platform-wide notification broadcast is not available yet; this is your admin inbox.
 </p>
 </div>
 );
}
