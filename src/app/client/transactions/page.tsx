import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { TransactionsClient, type ContractRef, type TransactionRow } from "./transactions-client";

interface TransactionsResponse {
  transactions: TransactionRow[];
}

interface ContractListItem {
  id: string;
  counterpart?: { id: string; name: string | null } | null;
  viewer_role?: "client" | "freelancer";
}

interface ContractsResponse {
  contracts: ContractListItem[];
  pagination: { total: number };
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientTransactionsPage() {
  const cookie = await sessionCookie();

  let transactionsRes: TransactionsResponse;
  let contractsRes: ContractsResponse;
  try {
    [transactionsRes, contractsRes] = await Promise.all([
      apiServer<TransactionsResponse>("/api/v1/payments/transactions?perPage=50", undefined, cookie),
      apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const contractRefs: ContractRef[] = (contractsRes.contracts ?? [])
    .filter((c) => c.viewer_role !== "freelancer")
    .map((c) => ({ id: c.id, counterpartName: c.counterpart?.name ?? null }));

  return (
    <TransactionsClient
      transactions={transactionsRes.transactions ?? []}
      contractRefs={contractRefs}
      totalContracts={contractsRes.pagination?.total ?? contractRefs.length}
    />
  );
}
