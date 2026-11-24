"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { CheckmarkCircle02Icon, Clock01Icon, EyeIcon, Icon, Mail01Icon } from "@/lib/icons";
import { formatDateTime, formatRelative } from "@/lib/format";

type ContactStatus = "new" | "read" | "replied" | "archived";
type Filter = ContactStatus | "all";

interface ContactItem {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: ContactStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactList {
  items: ContactItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasMore: boolean;
  counts: Record<ContactStatus, number>;
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All messages" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  archived: "Archived",
};

const TOPIC_LABELS: Record<string, string> = {
  project: "Project issues",
  billing: "Billing & escrow",
  trust: "Trust & safety",
  press: "Press",
  other: "Other",
};

function statusTone(status: ContactStatus): "warning" | "brand" | "success" | "neutral" {
  if (status === "new") return "warning";
  if (status === "read") return "brand";
  if (status === "replied") return "success";
  return "neutral";
}

async function readEnvelope<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; message?: string }
    | null;
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.message ?? "Request failed. Please try again.");
  }
  return payload.data as T;
}

export default function AdminContactPage() {
  const [items, setItems] = useState<ContactItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ContactStatus, number>>({ new: 0, read: 0, replied: 0, archived: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [detail, setDetail] = useState<ContactItem | null>(null);
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<ContactStatus>("new");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setBusy(targetPage === 1 ? "list" : "more");
      try {
        const params = new URLSearchParams({ page: String(targetPage), perPage: "50" });
        if (filter !== "all") params.set("status", filter);
        if (appliedSearch) params.set("q", appliedSearch);
        const res = await fetch(`/api/v1/admin/contact?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await readEnvelope<ContactList>(res);
        setItems((current) => (targetPage === 1 ? data.items : [...(current ?? []), ...data.items]));
        setTotal(data.total);
        setCounts(data.counts);
        setPage(data.page);
        setHasMore(data.hasMore);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load contact messages.");
      } finally {
        setBusy(null);
      }
    },
    [appliedSearch, filter],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const visible = useMemo(() => items ?? [], [items]);

  async function openDetail(id: string) {
    setBusy("detail");
    try {
      const res = await fetch(`/api/v1/admin/contact/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readEnvelope<{ submission: ContactItem }>(res);
      setDetail(data.submission);
      setNote(data.submission.adminNotes ?? "");
      setNextStatus(data.submission.status);
      setItems((current) =>
        current?.map((item) => (item.id === data.submission.id ? { ...item, status: data.submission.status } : item)) ?? null,
      );
    } catch (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : "Could not open the message");
    } finally {
      setBusy(null);
    }
  }

  async function saveUpdate() {
    if (!detail) return;
    const statusChanged = nextStatus !== detail.status;
    const notesChanged = note.trim() !== (detail.adminNotes ?? "");
    if (!statusChanged && !notesChanged) {
      toast.info("No changes to save");
      return;
    }

    setBusy("save");
    try {
      const body: { status?: ContactStatus; adminNotes?: string } = {};
      if (statusChanged) body.status = nextStatus;
      if (notesChanged) body.adminNotes = note.trim();
      const res = await fetch(`/api/v1/admin/contact/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await readEnvelope<{ submission: ContactItem }>(res);
      const updated = data.submission;
      setDetail(updated);
      setNote(updated.adminNotes ?? "");
      setNextStatus(updated.status);
      setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      if (filter !== "all" && updated.status !== filter) {
        setItems((current) => current?.filter((item) => item.id !== updated.id) ?? null);
        setTotal((value) => Math.max(0, value - 1));
      }
      toast.success("Contact message updated");
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Could not save the update");
    } finally {
      setBusy(null);
    }
  }

  if (error && items === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Contact inbox"
          description="Every message sent through the public contact form."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Contact inbox" }]}
        />
        <div className="card border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm font-medium text-rose-800">
          {error}
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={() => void load(1)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contact inbox"
        description="Every message sent through the public contact form, stored even when email delivery is unavailable."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Contact inbox" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New" value={String(counts.new)} hint="Not opened yet" />
        <StatCard label="Read" value={String(counts.read)} hint="Opened by an admin" />
        <StatCard label="Replied" value={String(counts.replied)} hint="Follow-up handled" />
        <StatCard label="Archived" value={String(counts.archived)} hint="Closed out" />
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="Search messages" hint="Name, email, topic or message text">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setAppliedSearch(search.trim());
              }
            }}
            placeholder="Search the inbox"
          />
        </Field>
        <Button size="md" variant="secondary" loading={busy === "list"} onClick={() => setAppliedSearch(search.trim())}>
          Search
        </Button>
        {appliedSearch ? (
          <Button size="md" variant="ghost" onClick={() => { setSearch(""); setAppliedSearch(""); }}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter contact messages">
        {FILTERS.map((item) => {
          const count = item.value === "all" ? total : counts[item.value];
          return (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "primary" : "secondary"}
              onClick={() => setFilter(item.value)}
            >
              {item.label} <span className="opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      {items === null ? (
        <div className="card px-6 py-12 text-center text-sm text-neutral-500">Loading messages…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Mail01Icon} size={22} strokeWidth={1.8} />}
          title="No messages here"
          description="Contact submissions will appear here as soon as someone uses the public contact form."
          action={
            <Button size="md" href="/">
              Visit the site
            </Button>
          }
        />
      ) : (
        <div className="card divide-y divide-neutral-100">
          {visible.map((item) => (
            <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                  <Badge tone={statusTone(item.status)}>{STATUS_LABELS[item.status]}</Badge>
                  <Badge tone="neutral">{TOPIC_LABELS[item.topic] ?? item.topic}</Badge>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.email} · {formatRelative(item.createdAt)}
                </p>
                <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-neutral-700">{item.message}</p>
                <p className="mt-2 font-mono text-[11px] text-neutral-400">{item.id}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
                <Button size="sm" variant="secondary" loading={busy === "detail"} onClick={() => void openDetail(item.id)}>
                  <Icon icon={EyeIcon} size={15} strokeWidth={1.8} />
                  View message
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button size="md" variant="secondary" loading={busy === "more"} onClick={() => void load(page + 1)}>
            Load more messages
          </Button>
        </div>
      ) : null}

      {error && items !== null ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.name} · ${TOPIC_LABELS[detail.topic] ?? detail.topic}` : "Contact message"}
        description="Read the full message and update the review status."
        size="xl"
      >
        {detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
              <Badge tone={statusTone(detail.status)}>{STATUS_LABELS[detail.status]}</Badge>
              <span>{detail.email}</span>
              <span>·</span>
              <span>Received {formatDateTime(detail.createdAt)}</span>
              {detail.updatedAt !== detail.createdAt ? <span>· Updated {formatDateTime(detail.updatedAt)}</span> : null}
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-900">Message</p>
              <div className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-800">
                {detail.message}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select
                  value={nextStatus}
                  onChange={(value) => setNextStatus(value as ContactStatus)}
                  options={FILTERS.filter((item) => item.value !== "all").map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  ariaLabel="Contact status"
                />
              </Field>
              <div className="flex items-end">
                <p className="text-xs leading-relaxed text-neutral-500">
                  <Icon icon={Clock01Icon} size={14} strokeWidth={1.8} className="mr-1 inline-block align-[-2px]" />
                  Opening a new message marks it as read automatically.
                </p>
              </div>
            </div>

            <Field label="Internal notes" hint="Only admins can see these notes.">
              <Textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add follow-up details for the team"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-5">
              <Button size="md" variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button size="md" loading={busy === "save"} onClick={() => void saveUpdate()}>
                <Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
