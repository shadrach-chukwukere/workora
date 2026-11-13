import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/components/layout/session-guard";

export default async function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const account = await requireSession({ requiredRole: "freelancer" });
  return (
    <DashboardShell
      role="freelancer"
      account={{ userId: account.userId, role: "freelancer", userName: account.name, email: account.email, image: account.image }}
    >
      {children}
    </DashboardShell>
  );
}
