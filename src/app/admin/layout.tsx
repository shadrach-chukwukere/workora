import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/components/layout/session-guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await requireSession({ requiredRole: "admin" });
  return (
    <DashboardShell
      role="admin"
      account={{ userId: account.userId, role: "admin", userName: account.name, email: account.email, image: account.image }}
    >
      {children}
    </DashboardShell>
  );
}
