import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/components/layout/session-guard";
import { QueryProvider } from "@/components/layout/query-provider";

export default async function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const account = await requireSession({ requiredRole: "freelancer" });
  return (
    <QueryProvider>
      <DashboardShell
        role="freelancer"
        account={{ userId: account.userId, role: "freelancer", userName: account.name, email: account.email, image: account.image }}
      >
        {children}
      </DashboardShell>
    </QueryProvider>
  );
}
