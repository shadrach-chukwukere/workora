"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { RatingStars } from "@/components/ui/rating-stars";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatDateShort, formatNumber } from "@/lib/format";
import {
 Alert02Icon,
 CheckmarkCircle02Icon,
 Icon,
 Search01Icon,
 StarIcon,
 TrashIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface ReviewRow {
 id: string;
 rating: number;
 comment: string;
 created_at: string;
 reviewer_name: string;
 subject_name: string;
 reported: boolean;
}

export default function AdminReviewsPage() {
 const router = useRouter();
 const [rows, setRows] = useState<ReviewRow[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [query, setQuery] = useState("");
 const [reportedOnly, setReportedOnly] = useState(true);
 const [removeTarget, setRemoveTarget] = useState<ReviewRow | null>(null);
 const [removing, setRemoving] = useState(false);
 const [removedCount, setRemovedCount] = useState(0);
 const debounceRef = useRef<number | undefined>(undefined);
 const [debouncedQuery, setDebouncedQuery] = useState("");

 useEffect(() => {
 window.clearTimeout(debounceRef.current);
 debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 300);
 return () => window.clearTimeout(debounceRef.current);
 }, [query]);

 const load = useCallback(async () => {
 const params = new URLSearchParams();
 if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
 if (reportedOnly) params.set("reported", "true");
 const qs = params.toString();
 try {
 const data = await api<{ reviews: ReviewRow[] }>(`/api/v1/admin/reviews${qs ? `?${qs}` : ""}`);
 setRows(data.reviews);
 setError(null);
 } catch (err) {
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 }
 }, [debouncedQuery, reportedOnly, router]);

 useEffect(() => {
 void load();
 }, [load]);

 const reportedCount = useMemo(() => (rows ?? []).filter((r) => r.reported).length, [rows]);

 async function confirmRemove() {
 if (!removeTarget) return;
 setRemoving(true);
 try {
 await api(`/api/v1/reviews/${encodeURIComponent(removeTarget.id)}`, { method: "DELETE" });
 setRows((list) => list?.filter((r) => r.id !== removeTarget.id) ?? list);
 setRemovedCount((count) => count + 1);
 toast.success("Review removed");
 setRemoveTarget(null);
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Could not remove review");
 } finally {
 setRemoving(false);
 }
 }

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Reviews"
 description="Moderation desk for reported reviews: inspect, then remove when warranted. Removal is final for the public profile."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Reviews" }]}
 />

 <div className="grid gap-4 sm:grid-cols-3">
 <StatCard
 label={reportedOnly ? "Reported reviews" : "Reviews shown"}
 value={rows === null ? "—" : formatNumber(rows.length)}
 hint={reportedOnly ? "Currently reported, still public" : "Every review in the window"}
 icon={<Icon icon={StarIcon} size={16} strokeWidth={1.8} />}
 />
 <StatCard label="Reported in view" value={rows === null ? "—" : formatNumber(reportedCount)} hint="Of the loaded rows" />
 <StatCard label="Removed this session" value={formatNumber(removedCount)} hint="Deleted via this console" />
 </div>

 {/* Filters */}
 <div className="card flex flex-wrap items-end gap-3 p-4">
 <div className="min-w-56 flex-1">
 <Field label="Search">
 <div className="relative">
 <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
 <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
 </span>
 <Input
 id="review-search"
 className="pl-9"
 placeholder="Reviewer, subject or comment text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 </Field>
 </div>
 <div className="flex h-10 items-center gap-2 pb-0.5">
 <Switch checked={reportedOnly} onChange={setReportedOnly} ariaLabel="Reported only" />
 <span className="text-sm text-neutral-700">Reported only</span>
 </div>
 </div>

 {error ? (
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load reviews"
 description={error}
 action={
 <Button variant="secondary" size="md" onClick={() => void load()}>
 Try again
 </Button>
 }
 />
 ) : rows === null ? (
 <div className="card h-64 animate-pulse bg-neutral-50" />
 ) : rows.length === 0 ? (
 <EmptyState
 icon={<Icon icon={CheckmarkCircle02Icon} size={22} strokeWidth={1.8} />}
 title={reportedOnly ? "No reported reviews" : "No reviews match this search"}
 description={reportedOnly ? "Nothing is waiting on a moderation decision right now." : "Try a different query or clear the reported-only filter."}
 />
 ) : (
 <section className="card">
 <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
 <div>
 <h2 className="text-sm font-semibold text-neutral-900">{reportedOnly ? "Reported" : "All reviews"}</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Removing a review takes it off the public profile immediately.</p>
 </div>
 <Badge tone={reportedCount > 0 ? "danger" : "success"} dot={reportedCount > 0 ? "danger" : "success"}>
 {reportedCount > 0 ? `${reportedCount} waiting` : "Clear"}
 </Badge>
 </div>
 <ul className="divide-y divide-neutral-100">
 {rows.map((r) => (
 <li key={r.id} className="flex flex-col gap-3 px-5 py-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="flex flex-wrap items-center gap-3">
 <RatingStars value={r.rating} size="md" showValue={false} />
 {r.reported ? <Badge tone="danger">Reported</Badge> : null}
 </div>
 <span className="text-xs text-neutral-400">{formatDateShort(r.created_at)}</span>
 </div>
 <p className="max-w-3xl text-sm leading-relaxed text-neutral-800">“{r.comment}”</p>
 <p className="text-xs text-neutral-500">
 <span className="font-medium text-neutral-700">{r.reviewer_name}</span> →{" "}
 <span className="font-medium text-neutral-700">{r.subject_name}</span>
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <Button variant="danger-outline" size="sm" onClick={() => setRemoveTarget(r)}>
 <Icon icon={TrashIcon} size={14} strokeWidth={1.8} />
 Remove review
 </Button>
 </div>
 </li>
 ))}
 </ul>
 </section>
 )}

 <ConfirmDialog
 open={removeTarget != null}
 onClose={() => setRemoveTarget(null)}
 onConfirm={() => void confirmRemove()}
 title="Remove this review?"
 description="The review disappears from the public profile immediately. Both parties keep the audit trail; this cannot be undone from the console."
 confirmLabel="Remove review"
 tone="danger"
 loading={removing}
 />
 </div>
 );
}
