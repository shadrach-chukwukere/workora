import { Suspense } from "react";
import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalsClient, type ReceivedProposal } from "./proposals-client";

interface ReceivedProposalsResponse {
  proposals: ReceivedProposal[];
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

function ProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default async function ClientProposalsPage() {
  const cookie = await sessionCookie();

  let data: ReceivedProposalsResponse;
  try {
    data = await apiServer<ReceivedProposalsResponse>("/api/v1/users/me/project-proposals", undefined, cookie);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  return (
    <Suspense fallback={<ProposalsSkeleton />}>
      <ProposalsClient proposals={data.proposals ?? []} />
    </Suspense>
  );
}
