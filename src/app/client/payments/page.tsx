import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { PaymentsClient } from "./payments-client";

interface MethodsResponse {
  methods: { id: string; user_id: string; provider: string; provider_method_id: string | null; brand: string | null; last_four: string | null; exp_month: number | null; exp_year: number | null; is_default: boolean; created_at: string }[];
}

interface TransactionsResponse {
  transactions: { id: string; type: string; status: string; amount_minor: string | number; currency: string; description: string; created_at: string; contract_id: string | null }[];
}

interface ContractListItem {
  id: string;
  total_minor: string | number;
  status: "active" | "completed" | "cancelled" | "paused" | "disputed";
}

interface ContractsResponse {
  contracts: ContractListItem[];
}

interface MilestoneRow {
  amount_minor: string | number;
  status: string;
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientPaymentsPage() {
  const cookie = await sessionCookie();

  let methodsRes: MethodsResponse;
  let transactionsRes: TransactionsResponse;
  let contractsRes: ContractsResponse;
  try {
    [methodsRes, transactionsRes, contractsRes] = await Promise.all([
      apiServer<MethodsResponse>("/api/v1/payments/methods", undefined, cookie),
      apiServer<TransactionsResponse>("/api/v1/payments/transactions?limit=6", undefined, cookie),
      apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const contracts = contractsRes.contracts ?? [];
  const lifetimeSpendMinor = contracts.reduce((sum, c) => sum + Number(c.total_minor), 0);

  const activeContracts = contracts.filter((c) => c.status === "active" || c.status === "paused" || c.status === "disputed");
  let escrowTotalMinor = 0;
  try {
    const totals = await Promise.all(
      activeContracts.map(async (contract) => {
        const detail = await apiServer<{ contract: { milestones: MilestoneRow[] } }>(
          `/api/v1/contracts/${encodeURIComponent(contract.id)}`,
          undefined,
          cookie,
        );
        return (detail.contract.milestones ?? [])
          .filter((m) => m.status === "funded" || m.status === "in_review" || m.status === "approved")
          .reduce((sum, m) => sum + Number(m.amount_minor), 0);
      }),
    );
    escrowTotalMinor = totals.reduce((sum, n) => sum + n, 0);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const now = new Date();
  const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const fundedThisMonthMinor = (transactionsRes.transactions ?? [])
    .filter((t) => t.type === "payment" && t.status === "completed" && t.created_at.startsWith(monthPrefix))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount_minor)), 0);

  return (
    <PaymentsClient
      methods={methodsRes.methods ?? []}
      recentTransactions={transactionsRes.transactions ?? []}
      lifetimeSpendMinor={lifetimeSpendMinor}
      escrowTotalMinor={escrowTotalMinor}
      fundedThisMonthMinor={fundedThisMonthMinor}
      monthLabel={monthLabel}
    />
  );
}
