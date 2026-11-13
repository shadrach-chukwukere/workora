import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-blocks";
import { RatingStars } from "@/components/ui/rating-stars";
import { formatDate } from "@/lib/format";
import { Medal01Icon, Icon, StarIcon } from "@/lib/icons";
import { apiServer, isAuthError, sessionCookie } from "@/lib/api-server";

interface MeResponse {
  user: {
    id: string;
  };
}

interface ReviewDto {
  id: string;
  contractId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; image: string | null } | null;
  contractTitle: string | null;
}

interface ReviewsResponse {
  reviews: ReviewDto[];
  averageRating: number | null;
  total: number;
}

export default async function FreelancerReviewsPage() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  try {
    me = await apiServer<MeResponse>("/api/v1/users/me", undefined, cookie);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  let data: ReviewsResponse | null = null;
  let loadError: string | null = null;
  try {
    data = await apiServer<ReviewsResponse>(`/api/v1/users/${me.user.id}/reviews?perPage=50`, undefined, cookie);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    loadError = error instanceof Error ? error.message : "Could not load your reviews";
  }

  const reviews = (data?.reviews ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const averageRating = data?.averageRating ?? null;
  const total = data?.total ?? reviews.length;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reviews"
        description="What clients wrote about working with you, after every contract closed."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Reviews" }]}
      />

      {loadError ? (
        <EmptyState
          icon={<Icon icon={StarIcon} size={22} strokeWidth={1.8} />}
          title="Reviews are unavailable right now"
          description={loadError}
        />
      ) : (
        <>
          <section className="rounded-xl border border-neutral-200 bg-white grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-5xl font-semibold tracking-tight text-neutral-900">
                  {averageRating === null ? "n/a" : averageRating.toFixed(2)}
                </p>
                {averageRating === null ? null : <RatingStars value={averageRating} size="md" showValue={false} className="mt-1.5" />}
                <p className="mt-1.5 text-sm text-neutral-500">
                  {total === 0 ? "No client reviews yet" : `${total} ${total === 1 ? "client review" : "client reviews"}`}
                </p>
              </div>
              <span aria-hidden className="hidden size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 sm:inline-flex">
                <Icon icon={Medal01Icon} size={30} strokeWidth={1.6} />
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Rating distribution</p>
              <ul className="mt-2 flex max-w-md flex-col gap-1.5">
                {distribution.map(({ star, count }) => (
                  <li key={star} className="flex items-center gap-2 text-xs">
                    <span className="inline-flex w-6 shrink-0 items-center gap-0.5 font-medium text-neutral-600">
                      {star}
                      <Icon icon={StarIcon} size={11} strokeWidth={1.8} className="text-amber-400" />
                    </span>
                    <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">{count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-neutral-400">
                {reviews.length > 0 ? "Based on the written reviews shown below." : "No written reviews to break down yet."}
              </p>
            </div>
          </section>

          {reviews.length === 0 ? (
            <EmptyState
              icon={<Icon icon={StarIcon} size={22} strokeWidth={1.8} />}
              title="No reviews yet"
              description="When a client closes a contract with you, their review shows up here."
            />
          ) : (
            <section className="flex flex-col gap-3">
              {reviews.map((review) => {
                const reviewerName = review.reviewer?.name ?? "Anonymous client";
                return (
                  <article key={review.id} className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar src={review.reviewer?.image ?? null} name={reviewerName} size="md" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900">{reviewerName}</p>
                        <p className="text-xs text-neutral-500">{formatDate(review.createdAt)}</p>
                      </div>
                      <RatingStars value={review.rating} size="sm" showValue={false} />
                    </div>
                    {review.contractTitle ? (
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {review.contractTitle}
                      </p>
                    ) : null}
                    <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-neutral-800">
                      {review.comment?.trim() ? review.comment : "The client left a rating without a written comment."}
                    </p>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
