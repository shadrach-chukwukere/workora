import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating-stars";
import { ContactLinks } from "@/components/profile/contact-links";
import { ConnectButton } from "@/components/profile/connect-button";
import { getSessionAccount } from "@/components/layout/session-guard";
import { apiServerOr } from "@/lib/api-data";
import type { ContactDetails } from "@/lib/contact";
import type { ConnectionStatus } from "@/lib/connections";
import { ArrowLeft02Icon, Building01Icon, Calendar03Icon, Icon } from "@/lib/icons";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora-phi.vercel.app").replace(/\/+$/, "");

interface PublicClientResponse {
  client: {
    id: string;
    name: string;
    image: string | null;
    company_name: string | null;
    company_size: string | null;
    industry: string | null;
    about: string | null;
    rating_avg: string | number | null;
    rating_count: number;
    projects_count: number;
    created_at: string;
    phone: string | null;
    github_url: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    instagram_url: string | null;
    website_url: string | null;
    portfolio_url: string | null;
  };
  connections: { followersCount: number; followingCount: number };
}

async function getClient(id: string): Promise<PublicClientResponse | null> {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null;
  return apiServerOr<PublicClientResponse | null>(
    `/api/v1/clients/${encodeURIComponent(id)}`,
    null,
    true,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) return { title: "Client not found" };
  const client = data.client;
  const displayName = client.company_name || client.name;
  const description =
    client.about?.trim().slice(0, 160) || `Public client profile for ${client.name} on Workora.`;
  return {
    title: `${displayName} · Client profile`,
    description,
    alternates: { canonical: `/clients/${encodeURIComponent(id)}` },
    openGraph: {
      type: "profile",
      url: `/clients/${encodeURIComponent(id)}`,
      title: `${displayName} on Workora`,
      description,
      siteName: "Workora",
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} on Workora`,
      description,
    },
  };
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) notFound();
  const { client, connections } = data;

  const account = await getSessionAccount();
  const isSelf = account?.userId === client.id;
  const connectionStatus =
    account && !isSelf
      ? await apiServerOr<ConnectionStatus | null>(
          `/api/v1/connections/${encodeURIComponent(client.id)}/status`,
          null,
        )
      : null;

  const displayName = client.company_name || client.name;
  const memberSince = client.created_at ? new Date(client.created_at).getUTCFullYear() : null;
  const contact: ContactDetails = {
    email: null,
    phone: client.phone,
    github_url: client.github_url,
    linkedin_url: client.linkedin_url,
    twitter_url: client.twitter_url,
    instagram_url: client.instagram_url,
    website_url: client.website_url,
    portfolio_url: client.portfolio_url,
  };

  const profileUrl = `${baseUrl}/clients/${encodeURIComponent(id)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: displayName,
    url: profileUrl,
    ...(client.image ? { image: client.image } : {}),
    ...(client.about?.trim() ? { description: client.about.trim() } : {}),
  };

  return (
    <div className="container-page py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <a href="#main-content" className="skip-link" />
      <Link
        href="/find-work"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-800"
      >
        <Icon icon={ArrowLeft02Icon} size={14} strokeWidth={1.8} />
        Browse work
      </Link>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={client.image ?? undefined} name={displayName} size="3xl" alt="" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              {displayName}
            </h1>
            {client.company_name && client.company_name !== client.name ? (
              <p className="mt-1 text-sm text-neutral-500">{client.name}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-500">
              {client.industry ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={Building01Icon} size={14} strokeWidth={1.8} className="text-neutral-400" />
                  {client.industry}
                </span>
              ) : null}
              {client.company_size ? <span>{client.company_size} people</span> : null}
              {memberSince ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={Calendar03Icon} size={14} strokeWidth={1.8} className="text-neutral-400" />
                  Client since {memberSince}
                </span>
              ) : null}
            </div>
            <div className="mt-4">
              <RatingStars value={Number(client.rating_avg ?? 0)} count={client.rating_count} size="md" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <main id="main-content" className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-neutral-900">About {displayName}</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
              {client.about?.trim() || `${displayName} hasn’t added an About yet.`}
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Hiring activity</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-neutral-50 p-4">
                <dt className="text-xs text-neutral-500">Projects posted</dt>
                <dd className="mt-1 text-xl font-semibold text-neutral-900 tabular-nums">{client.projects_count}</dd>
              </div>
              <div className="rounded-lg bg-neutral-50 p-4">
                <dt className="text-xs text-neutral-500">Client rating</dt>
                <dd className="mt-1 text-xl font-semibold text-neutral-900 tabular-nums">
                  {client.rating_avg === null ? "New" : Number(client.rating_avg).toFixed(2)}
                </dd>
              </div>
            </dl>
          </section>
        </main>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Follow this client</h2>
            <div className="mt-3">
              <ConnectButton
                targetId={client.id}
                targetName={displayName}
                viewerId={account?.userId ?? null}
                isSelf={isSelf}
                initialConnected={connectionStatus?.connected ?? false}
                initialFollowersCount={connectionStatus?.followersCount ?? connections.followersCount}
                initialFollowingCount={connectionStatus?.followingCount ?? connections.followingCount}
                fullWidth
              />
            </div>
          </section>
          <ContactLinks contact={contact} />
          <section className="rounded-xl border border-brand-100 bg-brand-50/50 p-6">
            <h2 className="text-sm font-semibold text-brand-900">Working with this client</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-900">
              Milestones are funded before work starts and released only when the client approves.
              Workora never moves funds without an approval or a decided dispute.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
