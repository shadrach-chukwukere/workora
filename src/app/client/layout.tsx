import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/components/layout/session-guard";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const account = await requireSession({ requiredRole: "client" });
  return (
    <DashboardShell
      role="client"
      account={{ userId: account.userId, role: "client", userName: account.name, email: account.email, image: account.image }}
    >
      {children}
    </DashboardShell>
  );
}
