import { redirect } from "next/navigation";

/** Convenience alias for the shared AI integrations settings page. */
export default function DashboardIntegrationsRedirect() {
  redirect("/settings/integrations");
}
