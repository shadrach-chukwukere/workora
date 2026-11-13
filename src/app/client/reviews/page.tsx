import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { ReviewsClient, type AboutMeReview, type LeftReview, type PendingContract } from "./reviews-client";

interface MeResponse {
  user: { id: string };
}

interface AboutMeReviewsResponse {
  reviews: AboutMeReview[];
  averageRating: number | null;
  total: number;
}

interface LeftReviewsResponse {
  reviews: LeftReview[];
}

interface ContractListItem {
  id: string;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
  title_snapshot: string;
  project?: { id: string; title: string } | null;
  viewer_role?: "client" | "freelancer";
  counterpart?: { id: string; name: string | null } | null;
}

interface ContractsResponse {
  contracts: ContractListItem[];
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientReviewsPage() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  let aboutMe: AboutMeReviewsResponse;
  let left: LeftReviewsResponse;
  let contractsRes: ContractsResponse;
  try {
    me = await apiServer<MeResponse>("/api/v1/users/me", undefined, cookie);
    [aboutMe, left, contractsRes] = await Promise.all([
      apiServer<AboutMeReviewsResponse>(`/api/v1/users/${encodeURIComponent(me.user.id)}/reviews`, undefined, cookie),
      apiServer<LeftReviewsResponse>("/api/v1/users/me/reviews", undefined, cookie),
      apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const reviewedContractIds = new Set((left.reviews ?? []).map((r) => r.contract_id));
  const pendingContracts: PendingContract[] = (contractsRes.contracts ?? [])
    .filter((c) => (c.viewer_role === "client" || c.viewer_role === undefined) && c.status === "completed" && !reviewedContractIds.has(c.id))
    .map((c) => ({
      id: c.id,
      title: c.project?.title ?? c.title_snapshot,
      counterpartName: c.counterpart?.name ?? null,
    }));

  return (
    <ReviewsClient
      received={aboutMe.reviews ?? []}
      receivedAverage={aboutMe.averageRating ?? null}
      receivedTotal={aboutMe.total ?? aboutMe.reviews?.length ?? 0}
      left={left.reviews ?? []}
      pendingContracts={pendingContracts}
    />
  );
}
