"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Alert02Icon, CheckmarkCircle02Icon, EyeIcon, File01Icon, Icon, StampIcon } from "@/lib/icons";

type VerificationStatus = "pending" | "info_requested" | "approved" | "rejected";
type Filter = VerificationStatus | "all";
type DocumentCategory = "identity_document" | "selfie" | "supporting_document";

interface VerificationRequest {
  id: string;
  user_id: string;
  status: VerificationStatus;
  document_type: string;
  method: "manual" | "yoti";
  provider: string;
  submitted_at: string;
  decided_at: string | null;
  notes: string | null;
  yoti_state: string | null;
  document_count: number;
  user_name: string;
  user_email: string;
  user_image: string | null;
  user_account_type: string;
  user_verified: boolean;
}

interface VerificationDocument {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category: DocumentCategory;
  source: "upload" | "yoti";
  storage: string | null;
  yoti_media_id: string | null;
  created_at: string;
}

interface VerificationDetail extends VerificationRequest {
  decided_by: string | null;
  yoti_summary: unknown;
  documents: VerificationDocument[];
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "info_requested", label: "Info requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  identity_document: "Identity document",
  selfie: "Selfie",
  supporting_document: "Supporting document",
};

function statusMeta(status: VerificationStatus) {
  if (status === "pending") return { label: "Pending", tone: "warning" as const };
  if (status === "info_requested") return { label: "Info requested", tone: "brand" as const };
  if (status === "approved") return { label: "Approved", tone: "success" as const };
  return { label: "Rejected", tone: "danger" as const };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentUrl(requestId: string, documentId: string): string {
  return `/api/v1/verification-requests/${encodeURIComponent(requestId)}/documents/${encodeURIComponent(documentId)}/content`;
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

export default function AdminVerificationPage() {
  const router = useRouter();
  const [items, setItems] = useState<VerificationRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/verification-requests?status=all", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readEnvelope<{ requests: VerificationRequest[] }>(res);
      setItems(data.requests);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the verification queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? (items ?? []) : (items ?? []).filter((item) => item.status === filter)),
    [filter, items],
  );

  const stats = useMemo(() => {
    const list = items ?? [];
    const pending = list.filter((item) => item.status === "pending");
    const infoRequested = list.filter((item) => item.status === "info_requested");
    const oldest = pending.reduce<VerificationRequest | null>(
      (acc, item) =>
        acc === null || new Date(item.submitted_at).getTime() < new Date(acc.submitted_at).getTime() ? item : acc,
      null,
    );
    const oldestDays = oldest
      ? Math.max(0, Math.floor((Date.now() - new Date(oldest.submitted_at).getTime()) / 86_400_000))
      : 0;
    return {
      pending: pending.length,
      infoRequested: infoRequested.length,
      approved: list.filter((item) => item.status === "approved").length,
      oldestDays,
    };
  }, [items]);

  async function openDetail(id: string) {
    setBusy("detail");
    try {
      const res = await fetch(`/api/v1/verification-requests/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readEnvelope<{ request: VerificationDetail }>(res);
      setDetail(data.request);
      setNote("");
    } catch (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : "Could not open the request");
    } finally {
      setBusy(null);
    }
  }

  async function decide(action: "approve" | "reject" | "request-info") {
    if (!detail) return;
    if (action !== "approve" && note.trim().length < 3) {
      toast.error("Add a short note for the applicant");
      return;
    }
    setBusy(action);
    try {
      const body = action === "approve" ? {} : action === "reject" ? { reason: note.trim() } : { notes: note.trim() };
      const res = await fetch(`/api/v1/verification-requests/${encodeURIComponent(detail.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await readEnvelope<{ request: VerificationRequest }>(res);
      const status = data.request.status as VerificationStatus;
      setItems((list) => (list ?? []).map((item) => (item.id === detail.id ? { ...item, status, notes: data.request.notes } : item)));
      setDetail({ ...detail, status, notes: data.request.notes, decided_at: data.request.decided_at });
      setNote("");
      toast.success(
        action === "approve"
          ? `${detail.user_name} is now verified`
          : action === "reject"
            ? `${detail.user_name} was notified of the rejection`
            : `More information requested from ${detail.user_name}`,
      );
      router.refresh();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Could not save the decision");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Verification"
          description="Manual KYC review for every freelancer and client."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
        />
        <div className="card border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm font-medium text-rose-800">
          {error}
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Verification"
          description="Manual KYC review for every freelancer and client."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
        />
        <div className="card px-6 py-12 text-center text-sm text-neutral-500">Loading queue…</div>
      </div>
    );
  }

  const canDecide = detail?.status === "pending" || detail?.status === "info_requested";
  const canApprove =
    detail !== null && canDecide && (detail.documents.length > 0 || detail.document_count > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification"
        description="Manual KYC review for every freelancer and client. No identity is approved automatically."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={String(stats.pending)} hint="Awaiting a human decision" />
        <StatCard label="Info requested" value={String(stats.infoRequested)} hint="Waiting on a resubmission" />
        <StatCard label="Approved" value={String(stats.approved)} hint="Verified accounts in this queue" />
        <StatCard
          label="Oldest pending"
          value={`${stats.oldestDays} ${stats.oldestDays === 1 ? "day" : "days"}`}
          hint="Review older requests first"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter verification requests">
        {FILTERS.map((item) => {
          const count = item.value === "all" ? items.length : items.filter((row) => row.status === item.value).length;
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

      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon icon={StampIcon} size={22} strokeWidth={1.8} />}
          title="Nothing here"
          description="No verification requests match this filter. New submissions land here automatically."
          action={
            <Button size="md" href="/admin/dashboard">
              Back to dashboard
            </Button>
          }
        />
      ) : (
        <div className="card divide-y divide-neutral-100">
          {visible.map((item) => {
            const status = statusMeta(item.status);
            return (
              <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex items-start gap-3">
                  <Avatar src={item.user_image ?? undefined} name={item.user_name} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{item.user_name}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {item.user_verified ? <Badge tone="success">Account verified</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.user_account_type} · {item.user_email}
                    </p>
                    <Link href={`/freelancers/${item.user_id}`} className="text-xs text-brand-700 hover:text-brand-800">
                      View public profile
                    </Link>
                    <p className="mt-2 text-xs text-neutral-500">
                      <span className="font-mono">{item.id}</span> · submitted {formatRelative(item.submitted_at)}
                    </p>
                    <p className="mt-1 text-[13px] text-neutral-800">
                      {item.method === "yoti" ? "Yoti identity check" : item.document_type} · {item.document_count}{" "}
                      {item.document_count === 1 ? "file" : "files"}
                    </p>
                    {item.notes ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">{item.notes}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
                  <Button size="sm" variant="secondary" loading={busy === "detail"} onClick={() => void openDetail(item.id)}>
                    <Icon icon={EyeIcon} size={15} strokeWidth={1.8} />
                    Review documents
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Review ${detail.user_name}` : "Review verification"}
        description="Inspect every uploaded photo and document before making a decision."
        size="xl"
      >
        {detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
              <Badge tone={statusMeta(detail.status).tone}>{statusMeta(detail.status).label}</Badge>
              <span>{detail.method === "yoti" ? "Yoti" : "Manual upload"}</span>
              <span>·</span>
              <span>Submitted {formatDateTime(detail.submitted_at)}</span>
              {detail.decided_at ? <span>· Decided {formatDateTime(detail.decided_at)}</span> : null}
            </div>

            {detail.yoti_state || detail.yoti_summary != null ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <p className="text-sm font-medium text-brand-900">Yoti checks</p>
                <p className="mt-1 text-xs text-brand-800">Session state: {detail.yoti_state ?? "unknown"}</p>
                {detail.yoti_summary ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-neutral-700">
                    {JSON.stringify(detail.yoti_summary, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="text-sm font-semibold text-neutral-900">Submitted material ({detail.documents.length})</p>
              {detail.documents.length === 0 ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <Icon icon={Alert02Icon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                  <p>
                    No photos or documents are attached yet. For Yoti sessions, wait for the applicant to finish and
                    import the results before approving.
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {detail.documents.map((document) => {
                    const url = contentUrl(detail.id, document.id);
                    const mime = document.mime_type ?? "";
                    return (
                      <figure key={document.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <div className="flex min-h-40 items-center justify-center bg-neutral-100">
                          {mime.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt={`${CATEGORY_LABELS[document.category]} for ${detail.user_name}`}
                              className="max-h-72 w-full object-contain"
                            />
                          ) : mime === "application/pdf" ? (
                            <iframe src={url} title={document.file_name ?? "Verification document"} className="h-72 w-full" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 p-6 text-neutral-500">
                              <Icon icon={File01Icon} size={24} strokeWidth={1.7} />
                              <span className="text-xs">No inline preview for this file type</span>
                            </div>
                          )}
                        </div>
                        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 p-3 text-xs text-neutral-600">
                          <span className="font-medium text-neutral-900">
                            {CATEGORY_LABELS[document.category]} · {document.source === "yoti" ? "Yoti" : "Upload"}
                          </span>
                          <span>{formatBytes(document.size_bytes)}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                            Open full size
                          </a>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              )}
            </div>

            {canDecide ? (
              <div className="space-y-4 border-t border-neutral-100 pt-5">
                <Field
                  label="Review note"
                  hint="Required to reject or request more information. Approvals do not need a note."
                >
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. The document is cropped — please upload all four corners."
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="md" loading={busy === "approve"} disabled={!canApprove || busy !== null} onClick={() => void decide("approve")}>
                    <Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
                    Approve identity
                  </Button>
                  <Button
                    size="md"
                    variant="secondary"
                    loading={busy === "request-info"}
                    disabled={busy !== null || note.trim().length < 3}
                    onClick={() => void decide("request-info")}
                  >
                    Request more info
                  </Button>
                  <Button
                    size="md"
                    variant="danger-outline"
                    loading={busy === "reject"}
                    disabled={busy !== null || note.trim().length < 3}
                    onClick={() => void decide("reject")}
                  >
                    Reject
                  </Button>
                </div>
                {!canApprove ? (
                  <p className="text-xs text-amber-700">Approve is disabled until at least one reviewable photo or document is attached.</p>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                <Icon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.8} />
                This request has already been decided.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
