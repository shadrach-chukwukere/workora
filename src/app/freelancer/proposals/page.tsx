import { redirect } from "next/navigation";
import { apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import { ProposalsClient, type ProposalItem } from "./proposals-client";

interface ProposalsResponse {
  proposals: ProposalItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export default async function FreelancerProposalsPage() {
  const cookie = await sessionCookie();

  let data: ProposalsResponse;
  try {
    data = await apiServer<ProposalsResponse>("/api/v1/proposals/me?perPage=50", undefined, cookie);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  return <ProposalsClient initialProposals={data.proposals ?? []} />;
}
