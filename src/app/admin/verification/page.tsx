"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { formatRelative } from "@/lib/format";
import {
  Icon,
  StampIcon,
} from "@/lib/icons";

interface VerificationRequest {
  id: string;
  user_id: string;
  status: "pending" | "info_requested" | "approved" | "rejected";
  document_type: string;
  submitted_at: string;
  decided_at: string | null;
  notes: string | null;
  user_name: string;
  user_image: string | null;
  user_account_type: string;
}

export default function AdminVerificationPage() {
  const router = useRouter();
  const [items, setItems] = useState<VerificationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [infoDraft, setInfoDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/verification-requests?status=pending", { cache: "no-store", credentials: "include" });
        if (!res.ok) {
          if (cancelled) return;
          setError(res.status === 403 ? "Admin verification permission is required for this queue." : "Could not load the verification queue.");
          return;
        }
        const pending = (await res.json()) as { data?: { requests: VerificationRequest[] } };
        const infoRes = await fetch("/api/v1/verification-requests?status=info_requested", { cache: "no-store", credentials: "include" });
        const infoRequested = infoRes.ok ? ((await infoRes.json()) as { data?: { requests: VerificationRequest[] } }).data?.requests ?? [] : [];
        if (cancelled) return;
        setItems([...(pending.data?.requests ?? []), ...infoRequested]);
      } catch {
        if (!cancelled) setError("Could not reach the API. Check that it is running on :3010.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingItems = items ?? [];
  const stats = useMemo(() => {
    const pending = pendingItems.filter((v) => v.status === "pending");
    const infoRequested = pendingItems.filter((v) => v.status === "info_requested");
    const now = Date.now();
    const oldest = pending.reduce<VerificationRequest | null>(
      (acc, v) => (acc == null || new Date(v.submitted_at).getTime() < new Date(acc.submitted_at).getTime() ? v : acc),
      null,
    );
    const oldestDays = oldest ? Math.max(0, Math.floor((now - new Date(oldest.submitted_at).getTime()) / 86_400_000)) : 0;
    return { pending: pending.length, infoRequested: infoRequested.length, oldest, oldestDays };
  }, [pendingItems]);

  const rejectTarget = rejectId ? pendingItems.find((v) => v.id === rejectId) : undefined;
  const infoTarget = infoId ? pendingItems.find((v) => v.id === infoId) : undefined;

  async function callAdmin(path: string, body: Record<string, string>, successMessage: (name: string) => string, row: VerificationRequest) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok) {
        toast.error(payload?.message ?? "Action failed");
        return;
      }
      setItems((list) => (list ?? []).filter((v) => v.id !== row.id));
      toast.success(successMessage(row.user_name));
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function approve(row: VerificationRequest) {
    await callAdmin(
      `/api/v1/verification-requests/${encodeURIComponent(row.id)}/approve`,
      {},
      (name) => `${name} verified; payout holds are lifted`,
      row,
    );
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    await callAdmin(
      `/api/v1/verification-requests/${encodeURIComponent(rejectTarget.id)}/reject`,
      { reason: "Documents did not pass review" },
      () => "Verification rejected; the freelancer was notified",
      rejectTarget,
    );
    setRejectId(null);
  }

  async function sendInfoRequest() {
    const draft = infoDraft.trim();
    if (!infoTarget || draft.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/verification-requests/${encodeURIComponent(infoTarget.id)}/request-info`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: draft }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        toast.error(payload?.message ?? "Could not send the request");
        return;
      }
      setItems((list) =>
        (list ?? []).map((v) => (v.id === infoTarget.id ? { ...v, status: "info_requested" as const, notes: draft } : v)),
      );
      setInfoId(null);
      setInfoDraft("");
      toast.success(`Info request sent to ${infoTarget.user_name}`);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Verification"
          description="KYC queue for freelancers who want payouts unlocked."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
        />
        <div className="card border-rose-200 bg-rose-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </div>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Verification"
          description="KYC queue for freelancers who want payouts unlocked."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
        />
        <div className="card px-6 py-12 text-center text-sm text-neutral-500">Loading queue…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Verification"
          description="KYC queue for freelancers who want payouts unlocked."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
        />
        <EmptyState
          icon={<Icon icon={StampIcon} size={22} strokeWidth={1.8} />}
          title="Queue clear"
          description="Every verification request has been handled. New submissions land here automatically."
          action={
            <Button size="md" href="/admin/dashboard">
              Back to dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification"
        description="KYC queue for freelancers who want payouts unlocked."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Verification" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={String(stats.pending)} hint="Awaiting a decision" />
        <StatCard label="Info requested" value={String(stats.infoRequested)} hint="Waiting on a resubmission" />
        <StatCard label="Approved this week" value="—" hint="Not tracked in the queue view" />
        <StatCard
          label="Oldest pending"
          value={`${stats.oldestDays} ${stats.oldestDays === 1 ? "day" : "days"}`}
          hint={stats.oldest ? `${stats.oldest.id} waiting since submission` : "Nothing pending"}
        />
      </div>

      <div className="card divide-y divide-neutral-100">
        {items.map((v) => {
          const statusMeta =
            v.status === "pending"
              ? { label: "Pending", tone: "warning" as const }
              : { label: "Info requested", tone: "brand" as const };
          return (
            <div key={v.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <Avatar src={v.user_image ?? undefined} name={v.user_name} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{v.user_name}</p>
                  <Link href={`/freelancers/${v.user_id}`} className="text-xs text-brand-700 hover:text-brand-800">
                    /freelancers/{v.user_id}
                  </Link>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    <span className="font-mono">{v.id}</span> · submitted {formatRelative(v.submitted_at)}
                  </p>
                  <p className="mt-2 text-[13px] text-neutral-800">{v.document_type}</p>
                  {v.notes ? <p className="mt-1 text-xs leading-relaxed text-neutral-500">{v.notes}</p> : null}
                  <div className="mt-2">
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
                <Button size="sm" onClick={() => approve(v)} disabled={busy}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setInfoId(v.id);
                    setInfoDraft("");
                  }}
                >
                  Request info
                </Button>
                <Button size="sm" variant="danger-outline" disabled={busy} onClick={() => setRejectId(v.id)}>
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={rejectTarget != null}
        onClose={() => setRejectId(null)}
        onConfirm={confirmReject}
        title={rejectTarget ? `Reject verification for ${rejectTarget.user_name}?` : "Reject verification"}
        description={
          rejectTarget
            ? `${rejectTarget.document_type} is rejected and the freelancer is notified. They can resubmit with a clearer document.`
            : ""
        }
        confirmLabel="Reject"
        tone="danger"
      />

      <Modal
        open={infoTarget != null}
        onClose={() => setInfoId(null)}
        title={infoTarget ? `Request more info from ${infoTarget.user_name}` : "Request info"}
        description="Tell them exactly what the document is missing. It lands in their console inbox."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setInfoId(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="md" disabled={busy || infoDraft.trim().length === 0} onClick={sendInfoRequest}>
              Send request
            </Button>
          </>
        }
      >
        <Field label="What is missing" required>
          <Textarea
            id="info-request"
            rows={4}
            value={infoDraft}
            onChange={(e) => setInfoDraft(e.target.value)}
            placeholder="e.g. The address proof shows a different name than the profile. Please upload a utility bill or bank statement dated within 90 days."
          />
        </Field>
      </Modal>
    </div>
  );
}
