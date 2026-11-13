import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { ContractsClient, type ContractItem, type MilestoneRow } from "./contracts-client";

interface ContractsResponse {
  contracts: ContractItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientContractsPage() {
  const cookie = await sessionCookie();

  let data: ContractsResponse;
  try {
    data = await apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const mine = (data.contracts ?? []).filter((c) => c.viewer_role === "client" || c.viewer_role === undefined);

  let enriched = mine;
  try {
    enriched = await Promise.all(
      mine.map(async (contract) => {
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
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  return <ContractsClient initialContracts={enriched} />;
}
