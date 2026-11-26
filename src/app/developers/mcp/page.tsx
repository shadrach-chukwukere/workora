import type { Metadata } from "next";
import Link from "next/link";
import { Icon, ArrowRight02Icon, ShieldCheckIcon } from "@/lib/icons";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Connect Workora to Your AI Assistant",
  description:
    "Connect ChatGPT, Claude and other MCP-compatible assistants to your Workora marketplace account using the remote Workora MCP server.",
};

const MCP_ENDPOINT = "https://workora.com/api/mcp";

const TOOLS = [
  ["search_jobs", "Search open jobs by keyword, category, skill, budget and experience.", "Public"],
  ["get_job_details", "Get public job details, skills, budget, deadline and client company.", "Public"],
  ["search_freelancers", "Search public freelancer profiles by skill, title, location, availability and rating.", "Public"],
  ["get_freelancer_profile", "Get a public profile with overview, skills, portfolio, experience and reviews.", "Public"],
  ["get_freelancer_portfolio", "List a freelancer's public portfolio work.", "Public"],
  ["get_signup_url", "Return the real Workora sign-up URL for a human to open.", "Public"],
  ["get_recommended_projects", "Get jobs matched to your own freelancer skills.", "projects:read"],
  ["get_client_projects", "List your own client projects, including drafts.", "jobs:read"],
  ["get_my_profile", "Read your own Workora profile.", "profile:read"],
  ["get_my_proposals", "List your submitted proposals.", "proposals:read"],
  ["get_my_applications", "Workora calls proposals applications; same private list.", "proposals:read"],
  ["get_my_messages", "Read messages in a conversation you already participate in.", "messages:read"],
  ["get_my_contracts", "List contracts you are a party to, with milestone summaries.", "contracts:read"],
  ["get_my_notifications", "Read your notifications.", "notifications:read"],
  ["get_my_connections", "Read your followers or following.", "connections:read"],
  ["get_my_invitations", "List project invitations you received.", "invitations:read"],
  ["get_account_summary", "Summarize your marketplace activity without financial totals.", "profile:read"],
  ["update_profile", "Update only the public profile fields you supply.", "profile:write"],
  ["create_job_draft", "Save a job as a draft without publishing it.", "jobs:write"],
  ["publish_job", "Publish an existing draft after explicit confirmation.", "jobs:write"],
  ["invite_freelancer", "Invite a freelancer to a project after explicit confirmation.", "jobs:write"],
  ["create_proposal_draft", "Prepare a preview; Workora has no stored proposal drafts.", "proposals:write"],
  ["submit_proposal", "Submit a prepared proposal after explicit confirmation.", "proposals:write"],
  ["review_application", "Shortlist, reject or accept a proposal on your project after confirmation.", "jobs:write"],
  ["respond_to_invitation", "Accept or decline an invitation after explicit confirmation.", "invitations:write"],
  ["send_message", "Send a message in an existing conversation after explicit confirmation.", "messages:write"],
] as const;

const SCOPES = [
  ["freelancers:read", "Search freelancers and view public profiles"],
  ["projects:read", "Search projects and view public project details"],
  ["profile:read", "Read your own profile and account summary"],
  ["profile:write", "Update your own public profile fields"],
  ["messages:read", "Read conversations you participate in"],
  ["messages:write", "Send messages in existing conversations"],
  ["proposals:read", "Read your submitted proposals"],
  ["proposals:write", "Prepare and submit your proposals"],
  ["jobs:read", "Read your projects"],
  ["jobs:write", "Create job drafts and publish your projects"],
  ["invitations:read", "Read project invitations"],
  ["invitations:write", "Accept or decline invitations"],
  ["contracts:read", "Read contracts you are a party to"],
  ["notifications:read", "Read your notifications"],
  ["connections:read", "Read your connections"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-100 py-10 sm:py-12">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">{title}</h2>
      <div className="mt-4 max-w-4xl space-y-4 text-sm leading-relaxed text-neutral-600 sm:text-[15px]">{children}</div>
    </section>
  );
}

export default function McpDocumentationPage() {
  return (
    <main id="main-content" className="container-page py-10 sm:py-14">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">Workora developers</span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          Connect Workora to Your AI Assistant
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">
          Workora exposes its marketplace through a remote Model Context Protocol (MCP) server. Connect your own
          Workora account to ChatGPT, Claude or another MCP-compatible assistant and work with real talent, projects,
          proposals and contracts directly in the conversation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/settings/integrations" className="btn-primary">
            Manage your AI connections
            <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
          </Link>
          <Link href="/find-talent" className="btn-secondary">
            Explore the marketplace
          </Link>
        </div>
      </div>

      <Section title="Endpoint">
        <p>Use this URL when a client asks for a remote MCP server URL:</p>
        <code className="block break-all rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          {MCP_ENDPOINT}
        </code>
        <p>
          Transport: Streamable HTTP. Discovery: OAuth 2.0 Authorization Server Metadata and OAuth 2.0 Protected
          Resource Metadata at the standard <code className="font-mono text-xs">/.well-known/</code> paths on this domain.
        </p>
      </Section>

      <Section title="What you can do">
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "Search vetted freelancers and read their public profiles",
            "Search open projects and see matched recommendations",
            "Prepare job drafts and publish them when you approve",
            "Invite freelancers to your projects",
            "Review your proposals, invitations, contracts and notifications",
          ].map((item) => (
            <li key={item} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-neutral-700">
              {item}
            </li>
          ))}
        </ul>
        <p>
          All results come from the live Workora database. Nothing is mocked. Actions with real-world consequences
          always require a second, explicit confirmation from you. Workora never sends money or performs payments
          through MCP.
        </p>
      </Section>

      <Section title="Connect ChatGPT">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open ChatGPT Plugins and choose Add custom MCP server.</li>
          <li>Enter the endpoint above. Review the third-party risk notice before continuing.</li>
          <li>Create the plugin, then install it in your workspace.</li>
          <li>When prompted, sign in to Workora and review the requested permissions on the authorization screen.</li>
          <li>Approve to finish the connection. ChatGPT can then discover and call the tools you granted.</li>
        </ol>
        <p>
          ChatGPT supports URL-based client identity documents. Workora also supports public dynamic client
          registration for clients that need it. Client IDs are bound to this authorization server and cannot be reused
          elsewhere.
        </p>
      </Section>

      <Section title="Connect Claude">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open Claude connector settings and choose Add custom connector.</li>
          <li>Enter the remote MCP server URL above and the connector name.</li>
          <li>Start a new conversation and connect the connector.</li>
          <li>Sign in to Workora, review the permissions and approve.</li>
        </ol>
        <p>
          Workora is not officially listed in either platform&apos;s public directory. These are custom connector
          instructions for your own workspace.
        </p>
      </Section>

      <Section title="How authorization works">
        <p>
          Workora uses your existing account and sessions — there is no second password or separate account system. The
          authorization flow uses OAuth 2.1 with PKCE: the assistant opens Workora, you sign in if needed, you review
          the requested scopes, then Workora returns an authorization code to the assistant. Access tokens are short
          lived; refresh tokens rotate on every use and a replay revokes the whole token family. You can revoke any
          connection at any time in <Link className="text-brand-700 hover:underline" href="/settings/integrations">AI Integrations</Link>.
        </p>
        <p>
          Tokens are scoped per assistant and per user. One user can never read another user&apos;s private profiles,
          proposals, contracts, notifications or messages through MCP.
        </p>
      </Section>

      <Section title="Available tools">
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-neutral-900">Tool</th>
                <th className="px-4 py-3 font-semibold text-neutral-900">What it does</th>
                <th className="px-4 py-3 font-semibold text-neutral-900">Permission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {TOOLS.map(([name, description, scope]) => (
                <tr key={name}>
                  <td className="px-4 py-3 font-mono text-xs text-brand-800">{name}</td>
                  <td className="px-4 py-3 text-neutral-600">{description}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Permission scopes">
        <div className="grid gap-2 sm:grid-cols-2">
          {SCOPES.map(([scope, description]) => (
            <div key={scope} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <p className="font-mono text-xs font-medium text-brand-800">{scope}</p>
              <p className="mt-1 text-xs text-neutral-600">{description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Security and privacy">
        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
          <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-700" />
          <div className="space-y-2 text-sm leading-relaxed text-neutral-700">
            <p>
              Marketplace content is treated as untrusted data. Tool results cannot override Workora permissions or
              business rules. Every private operation is checked against the signed-in user and the granted scope.
            </p>
            <p>
              Passwords, payment credentials, private message bodies and internal database IDs for another user are never
              exposed through MCP. Tokens are stored only as hashes and are never shown in the dashboard.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Troubleshooting">
        <ul className="list-disc space-y-2 pl-5">
          <li>If the assistant reports a missing tool, reconnect and approve the relevant permission scope again.</li>
          <li>If a write call returns a confirmation token, repeat the same call with that token to authorize the action.</li>
          <li>Connecting again creates a fresh token family; revoking a connection immediately invalidates every token issued to that assistant.</li>
          <li>Public discovery tools do not require a connection. Private tools require a valid Workora access token.</li>
          <li>Confirm the endpoint is exactly <code className="font-mono text-xs">{MCP_ENDPOINT}</code> over HTTPS.</li>
        </ul>
      </Section>
    </main>
  );
}
