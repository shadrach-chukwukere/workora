import { redirect } from "next/navigation";
import { apiServer, isAuthError, monthlyEarnings, sessionCookie } from "@/lib/api-server";
import { EarningsClient, type WithdrawalRow } from "./earnings-client";

interface MeResponse {
  user: {
    earnings_minor: number;
  };
}

interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount_minor: number;
  description: string;
  created_at: string;
}

interface TransactionsResponse {
  transactions: TransactionRow[];
  earnings: { pendingPayoutsMinor: number; availableBalanceMinor: number; lifetimeVolumeMinor: number };
}

export default async function FreelancerEarningsPage() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  let transactionsRes: TransactionsResponse;
  try {
    [me, transactionsRes] = await Promise.all([
      apiServer<MeResponse>("/api/v1/users/me", undefined, cookie),
      apiServer<TransactionsResponse>("/api/v1/payments/transactions?perPage=50", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  const transactions = transactionsRes.transactions ?? [];
  const monthlyNet = monthlyEarnings(transactions, new Date(), 13);
  const withdrawals: WithdrawalRow[] = transactions
    .filter((t) => t.type === "withdrawal")
    .map((t) => ({
      id: t.id,
      status: t.status,
      amount_minor: Number(t.amount_minor),
      description: t.description,
      created_at: t.created_at,
    }));

  return (
    <EarningsClient
      lifetimeEarningsMinor={Number(me.user.earnings_minor)}
      availableBalanceMinor={Number(transactionsRes.earnings.availableBalanceMinor)}
      monthlyNet={monthlyNet}
      withdrawals={withdrawals}
    />
  );
}
