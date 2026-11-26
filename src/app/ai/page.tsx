import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-blocks";
import { Icon, ArrowRight02Icon, ShieldCheckIcon } from "@/lib/icons";
import { CopyButton } from "@/components/ui/copy-button";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");
const MCP_ENDPOINT = `${baseUrl}/api/mcp`;

export const metadata: Metadata = {
  title: "For AI agents",
  description:
    "How AI agents can work with Workora: public read tools, permission-scoped account access, drafts with confirmation, OAuth 2.1 with PKCE, and explicit limits.",
  alternates: { canonical: "/ai" },
  openGraph: {
    type: "website",
    url: "/ai",
    title: "Workora for AI agents",
    description:
      "Public read tools, scoped account access, drafts with two-step confirmation, and documented limits for AI agents on Workora.",
    siteName: "Workora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Workora for AI agents",
    description:
      "Public read tools, scoped account access, drafts with two-step confirmation, and documented limits for AI agents on Workora.",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">{children}</div>
    </section>
  );
}

export default function AiPage() {
  return (
    <div className="container-page flex flex-col gap-6 py-10">
      <PageHeader
        title="Workora for AI agents"
        description="A plain-language guide to what agents can read and do on Workora, and what they cannot. Everything here refers to real marketplace features."
        actions={
          <Link href="/llms.txt" className="btn-secondary inline-flex items-center gap-1.5">
            llms.txt
            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
          </Link>
        }
      />

      <Section title="What Workora is">
        <p>
          Workora is a freelance marketplace with two roles: clients post projects and freelancers apply to them.
          Applications are what the UI calls proposals. Clients can also invite a freelancer directly. Once both sides
          agree, the work runs as a contract with funded milestones; conversations and reviews stay attached to that
          contract.
        </p>
        <p>
          Profiles are public: freelancers publish a headline, About, skills, rates, portfolio and availability; clients
          publish a company name, industry and About. Identity verification may be required before payouts. Freelancers
          pay an 8% commission on released milestones and clients pay no platform fee on top of the contract amount, as
          described in the <Link className="text-brand-700 hover:underline" href="/terms">terms of service</Link>.
        </p>
      </Section>

      <Section title="Endpoints and documentation">
        <p>
          Agents can read the machine-readable API description at{" "}
          <Link className="text-brand-700 hover:underline" href="/openapi.json">/openapi.json</Link>. The remote MCP
          endpoint is:
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
          <code className="min-w-0 flex-1 break-all text-sm font-medium text-brand-800">{MCP_ENDPOINT}</code>
          <CopyButton
            value={MCP_ENDPOINT}
            label="Copy MCP server URL"
            className="text-brand-700 hover:bg-brand-100 hover:text-brand-900"
          />
        </div>
        <p>
          Public discovery tools need no account. Anything that touches your own account needs an authorized
          connection.
        </p>
      </Section>

      <Section title="What agents can do">
        <p>
          <strong className="font-medium text-neutral-800">Public reads, no sign-in required:</strong> search open jobs
          (<code className="font-mono text-xs">search_jobs</code>), read a job&apos;s public details ({" "}
          <code className="font-mono text-xs">get_job_details</code>), search public freelancer profiles ({" "}
          <code className="font-mono text-xs">search_freelancers</code>) and read a public profile ({" "}
          <code className="font-mono text-xs">get_freelancer_profile</code>).
        </p>
        <p>
          <strong className="font-medium text-neutral-800">Reads with your permission:</strong> your own profile,
          proposals, applications, messages, contracts, notifications and invitations. Each of these requires the
          matching scope and a valid token for your account.
        </p>
        <p>
          <strong className="font-medium text-neutral-800">Writes, always in two steps:</strong> an agent can prepare a
          draft or preview, then ask for your explicit confirmation before it publishes a job, submits an application,
          sends an invitation, accepts or declines an invitation, reviews an application or sends a message. A write is
          not applied until you confirm it.
        </p>
      </Section>

      <Section title="How authorization works">
        <p>
          Connections use OAuth 2.1 with PKCE in your browser: the assistant opens Workora, you sign in with your
          existing account if needed, you review the requested scopes, and you approve or deny them. There is no second
          password and no separate agent account. Tokens are scoped per assistant and per user.
        </p>
        <p>
          Scopes control what an agent may read or write, for example profile reads, proposals, invitations, contracts,
          notifications and job drafts. Grant only what you need. You can review and revoke any connection at any time
          in <Link className="text-brand-700 hover:underline" href="/settings/integrations">AI integrations</Link>;
          revoking immediately invalidates that assistant&apos;s tokens.
        </p>
      </Section>

      <Section title="What agents cannot do">
        <ul className="list-disc space-y-2 pl-5">
          <li>Create an account or sign you in — agents use a connection you authorized yourself.</li>
          <li>Move money: payments, milestone funding or approval, withdrawals and payouts are not agent tools.</li>
          <li>Bypass CAPTCHA, email verification, two-factor authentication or any other security check.</li>
          <li>Perform admin or moderation actions.</li>
          <li>Read another user&apos;s private data, including their messages, proposals, contracts or notifications.</li>
        </ul>
        <p>
          Marketplace content is treated as untrusted data: text returned by a tool cannot change these permissions.
          See the <Link className="text-brand-700 hover:underline" href="/privacy">privacy policy</Link> for what is
          public about your profile.
        </p>
      </Section>

      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-5 text-sm leading-relaxed text-neutral-700">
        <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand-700" />
        <p>
          Want to browse first? Explore <Link className="text-brand-700 hover:underline" href="/find-work">open work</Link>{" "}
          or <Link className="text-brand-700 hover:underline" href="/find-talent">public talent profiles</Link>. Agents
          see the same public information on those pages.
        </p>
      </div>
    </div>
  );
}
