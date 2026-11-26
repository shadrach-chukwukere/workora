import type { Metadata } from "next";
import { requireSession } from "@/components/layout/session-guard";
import { PageHeader } from "@/components/ui/page-blocks";
import { IntegrationsClient } from "@/app/settings/integrations/integrations-client";

export const metadata: Metadata = {
  title: "AI Integrations",
  description: "Connect your Workora account to ChatGPT, Claude and other MCP-compatible assistants.",
};

export default async function AISettingsPage() {
  await requireSession();

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        title="AI Integrations"
        description="Connect your Workora account to AI assistants and manage how they interact with your marketplace account."
        breadcrumbs={[{ label: "Settings" }, { label: "AI Integrations" }]}
      />
      <div className="mt-6">
        <IntegrationsClient />
      </div>
    </div>
  );
}
