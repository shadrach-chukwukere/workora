"use client";

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

  // Role-aware callbacks for the shared component
  const onContractClick = (contract: ContractItem) => {
    // Client views project detail
    router.push(`/project/${contract.project_id}`);
  };

  const onMilestoneSubmit = (contractId: string, milestoneId: string, title: string) => {
    // Client can submit milestones for funded ones
    router.push(`/project/${contractId}`);
  };

  const onMilestoneApprove = (contractId: string, milestoneId: string) => {
    // Client approves milestones
    // Could show a confirm dialog
  };

  const onMilestoneRequestRevision = (contractId: string, milestoneId: string, note: string) => {
    // Client can request revision
  };

  const onMilestoneFund = (contractId: string, milestoneId: string, amountMinor: number) => {
    // Client funds milestones
  };

  const onCancelContract = (contractId: string, reason: string) => {
    // Client cancels contract
  };

  return <ContractsClient
    initialContracts={enriched}
    onContractClick={onContractClick}
    onMilestoneSubmit={onMilestoneSubmit}
    onMilestoneApprove={onMilestoneApprove}
    onMilestoneRequestRevision={onMilestoneRequestRevision}
    onMilestoneFund={onMilestoneFund}
    onCancelContract={onCancelContract}
  />;
}