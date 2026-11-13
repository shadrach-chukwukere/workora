import { redirect } from "next/navigation";
import { apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import { ContractsClient, type ContractItem, type MilestoneRow } from "./contracts-client";

interface ContractsResponse {
  contracts: ContractItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export default async function FreelancerContractsPage() {
  const cookie = await sessionCookie();

  let data: ContractsResponse;
  try {
    data = await apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  const contracts = data.contracts ?? [];
  let enriched = contracts;
  try {
    enriched = await Promise.all(
      contracts.map(async (contract) => {
        if (contract.status !== "active" && contract.status !== "paused" && contract.status !== "disputed") {
          return contract;
        }
        const detail = await apiServer<{ contract: { milestones: MilestoneRow[] } }>(
          `/api/v1/contracts/${encodeURIComponent(contract.id)}`,
          undefined,
          cookie,
        );
        return { ...contract, milestoneRows: detail.contract.milestones ?? [] };
      }),
    );
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  return <ContractsClient initialContracts={enriched} />;
}
