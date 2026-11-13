"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-blocks";
import { Tabs } from "@/components/ui/tabs";
import { Icon, StarIcon } from "@/lib/icons";
import { formatDate } from "@/lib/format";

export interface AboutMeReview {
  id: string;
  contractId: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: { id: string; name: string; image: string | null } | null;
  contractTitle: string | null;
}

export interface LeftReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  subject_id: string;
  subject_name: string | null;
  contract_title: string | null;
  project_title: string | null;
  contract_id: string;
}

export interface PendingContract {
  id: string;
  title: string;
  counterpartName: string | null;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon key={star} icon={StarIcon} size={size} strokeWidth={1.8} className={star <= value ? "text-amber-500" : "text-neutral-300"} />
      ))}
    </span>
  );
}

function RatingSummary({ ratings, average, total }: { ratings: number[]; average: number | null; total: number }) {
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const rating of ratings) {
      const index = Math.min(5, Math.max(1, Math.round(rating))) - 1;
      counts[index] += 1;
    }
    return counts;
  }, [ratings]);

  const computedAverage = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
  const shownAverage = average ?? computedAverage;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <p className="text-4xl font-semibold tracking-tight text-neutral-900">
          {shownAverage === null ? "-" : shownAverage.toFixed(1)}
        </p>
        <div>
          <Stars value={shownAverage === null ? 0 : Math.round(shownAverage)} size={16} />
          <p className="mt-1 text-xs text-neutral-500">
            {total} {total === 1 ? "review" : "reviews"}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1];
          const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="w-2 tabular-nums">{star}</span>
              <Icon icon={StarIcon} size={11} strokeWidth={1.8} className="text-amber-500" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewsClient({
  received,
  receivedAverage,
  receivedTotal,
  left,
  pendingContracts,
}: {
  received: AboutMeReview[];
  receivedAverage: number | null;
  receivedTotal: number;
  left: LeftReview[];
  pendingContracts: PendingContract[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"received" | "left">("received");
  const [composerFor, setComposerFor] = useState<PendingContract | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = rating >= 1 && comment.trim().length >= 20;

  const receivedRatings = useMemo(() => received.map((r) => r.rating), [received]);
  const leftRatings = useMemo(() => left.map((r) => r.rating), [left]);

  function openComposer(contract: PendingContract) {
    setComposerFor(contract);
    setRating(0);
    setComment("");
    setRatingError("");
    setCommentError("");
  }

  async function submitReview() {
    if (!composerFor || submitting) return;
    let ok = true;
    if (rating < 1) {
      setRatingError("Choose a star rating");
      ok = false;
    } else setRatingError("");
    if (comment.trim().length < 20) {
      setCommentError("Write at least 20 characters");
      ok = false;
    } else setCommentError("");
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.API_URL}/api/v1/contracts/${encodeURIComponent(composerFor.id)}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Review not published", { description: body?.message ?? "Only completed contracts can be reviewed, once each." });
        return;
      }
      setComposerFor(null);
      toast.success("Review published");
      router.refresh();
    } catch {
      toast.error("Review not published", { description: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reviews" description="What freelancers say about working with you, and what you have said about them." />

      {pendingContracts.length > 0 ? (
        <section className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Waiting on your review ({pendingContracts.length})</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Honest, specific reviews help the next client decide.</p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {pendingContracts.map((contract) => (
              <li key={contract.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-neutral-400">{contract.id}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{contract.title}</p>
                  {contract.counterpartName ? <p className="mt-0.5 text-xs text-neutral-500">with {contract.counterpartName}</p> : null}
                </div>
                <Button size="sm" variant="secondary" onClick={() => openComposer(contract)}>
                  Leave a review
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={<Icon icon={StarIcon} size={20} strokeWidth={1.6} />}
          title="Nothing waiting on your review right now"
          description="When a contract you have with a freelancer completes, you can leave a review from here."
        />
      )}

      <Tabs ariaLabel="Reviews" value={tab} onChange={(id) => setTab(id as typeof tab)} items={[
        { id: "received", label: "Received", count: received.length },
        { id: "left", label: "You left", count: left.length },
      ]} />

      {tab === "received" ? (
        <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">About your company ({received.length})</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Written by freelancers after contracts with you close.</p>
          </div>
          <RatingSummary ratings={receivedRatings} average={receivedAverage} total={receivedTotal} />
          {received.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">No reviews yet. Finished contracts invite one automatically.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {received.map((review) => (
                <li key={review.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar src={review.reviewer?.image ?? undefined} name={review.reviewer?.name ?? "Freelancer"} size="md" alt="" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{review.reviewer?.name ?? "Freelancer"}</p>
                        <Stars value={review.rating} />
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {review.contractTitle ?? "Contract"} · {formatDate(review.createdAt)}
                      </p>
                      <p className="mt-2 max-w-2xl whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">{review.comment}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">You left ({left.length})</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Public on the freelancer profiles you worked with.</p>
          </div>
          <RatingSummary ratings={leftRatings} average={null} total={left.length} />
          {left.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">You have not written any reviews yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {left.map((review) => (
                <li key={review.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={review.subject_name ?? "Freelancer"} size="md" alt="" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">For {review.subject_name ?? "Freelancer"}</p>
                        <Stars value={review.rating} />
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {review.project_title ?? review.contract_title ?? "Contract"} · {formatDate(review.created_at)}
                      </p>
                      <p className="mt-2 max-w-2xl whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">{review.comment}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Modal
        open={composerFor !== null}
        onClose={() => setComposerFor(null)}
        title="Leave a review"
        description={composerFor ? `About your contract: ${composerFor.title}` : undefined}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setComposerFor(null)}>
              Cancel
            </Button>
            <Button size="md" onClick={submitReview} disabled={!canSubmit} loading={submitting}>
              Publish review
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Rating" required error={ratingError}>
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRating(star)} className="rounded-md p-1 transition-colors hover:bg-amber-50">
                  <Icon icon={StarIcon} size={26} strokeWidth={1.8} className={star <= rating ? "text-amber-500" : "text-neutral-300"} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="What should future clients know?" required hint={`${comment.trim().length}/20 characters minimum`} error={commentError}>
            <Textarea rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="How was the communication, quality and reliability? Be specific; it helps everyone on the marketplace." />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
