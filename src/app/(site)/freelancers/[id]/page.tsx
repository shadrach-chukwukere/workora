import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileHeader } from "@/components/ui/profile-header";
import { RatingStars } from "@/components/ui/rating-stars";
import { ShareProfileButton } from "@/components/share-profile-button";
import { ConnectButton } from "@/components/profile/connect-button";
import { getSessionAccount } from "@/components/layout/session-guard";
import {
  ArrowLeft02Icon,
  ArrowUpRight02Icon,
  Clock01Icon,
  Icon,
  ShieldCheckIcon,
  StarIcon,
} from "@/lib/icons";
import { apiServerOr } from "@/lib/api-data";
import { formatMoney, formatNumber } from "@/lib/format";
import { ContactLinks } from "@/components/profile/contact-links";
import { AvailabilityPulse } from "@/components/ui/availability-pulse";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { ContactDetails } from "@/lib/contact";
import type { ConnectionStatus } from "@/lib/connections";

interface PublicProfile {
  user: { id: string; name: string; image: string | null; banner_url: string | null; created_at: string };
  profile: {
    headline: string;
    about: string;
    location: string | null;
    hourly_rate_minor: number | null;
    availability: "available" | "limited" | "unavailable";
    response_time_hours: number;
    experience_level: "entry" | "intermediate" | "expert" | null;
    verified_identity: boolean;
    rating_avg: number | null;
    rating_count: number;
    completed_count: number;
  };
  contact: ContactDetails;
  connections: { followersCount: number; followingCount: number };
  skills: { slug: string; name: string }[];
  portfolio: {
    id: string;
    title: string;
    description: string;
    role: string | null;
    year: number | null;
    project_url: string | null;
    image_url: string | null;
  }[];
  experience: {
    id: string;
    company: string;
    role: string;
    start_date: string;
    end_date: string | null;
    description: string;
  }[];
  education: { id: string; school: string; degree: string; field: string | null; start_year: number; end_year: number | null }[];
  certifications: { id: string; name: string; issuer: string | null; year: number | null }[];
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string | null;
}

export default async function FreelancerPublicProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uuidOk = /^[0-9a-fA-F-]{36}$/.test(id);
  const data = uuidOk
    ? await apiServerOr<PublicProfile | null>(`/api/v1/freelancers/${encodeURIComponent(id)}`, null, true)
    : null;
  if (!data) notFound();

  const reviewsEnvelope = await apiServerOr<{ reviews: ReviewItem[]; averageRating?: number | null; total?: number }>(
    `/api/v1/users/${encodeURIComponent(id)}/reviews?perPage=3`,
    { reviews: [], total: 0 },
    true,
  );
  const reviews = reviewsEnvelope.reviews ?? [];
  const { user, profile, contact, connections, skills, portfolio, experience, education, certifications } = data;

  const account = await getSessionAccount();
  const isSelf = account?.userId === user.id;
  const connectionStatus =
    account && !isSelf
      ? await apiServerOr<ConnectionStatus | null>(
          `/api/v1/connections/${encodeURIComponent(user.id)}/status`,
          null,
        )
      : null;
  const hourly = profile.hourly_rate_minor != null ? profile.hourly_rate_minor / 100 : null;
  const memberSince = new Date(user.created_at).getUTCFullYear();
  const levelLabel = profile.experience_level === "expert" ? "Expert" : profile.experience_level === "intermediate" ? "Intermediate" : "Entry";

  return (
    <div className="container-page py-8">
      <a href="#main-content" className="skip-link" />
      <Link href="/find-talent" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-800">
        <Icon icon={ArrowLeft02Icon} size={14} strokeWidth={1.8} />
        Browse talent
      </Link>

      {/* LinkedIn-style identity header: cover banner + overlapping circular photo. */}
      <ProfileHeader
        className="mt-4"
        name={user.name}
        headline={profile.headline}
        location={profile.location}
        avatarSrc={user.image}
        bannerSrc={user.banner_url}
        verified={profile.verified_identity}
        connectionsLabel={`${formatNumber(connections.followersCount)} followers · ${formatNumber(connections.followingCount)} following`}
        isSelf={isSelf}
        editHref="/freelancer/settings"
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Clock01Icon} size={14} strokeWidth={1.8} className="text-neutral-400" />
              Member since {memberSince}
            </span>
            {profile.experience_level ? <span>{levelLabel} level</span> : null}
          </>
        }
        actions={
          isSelf ? (
            <Button href="/freelancer/settings" size="md" variant="secondary">
              Edit profile
            </Button>
          ) : (
            <>
              <ConnectButton
                targetId={user.id}
                targetName={user.name}
                viewerId={account?.userId ?? null}
                isSelf={isSelf}
                initialConnected={connectionStatus?.connected ?? false}
                initialFollowersCount={connectionStatus?.followersCount ?? connections.followersCount}
                initialFollowingCount={connectionStatus?.followingCount ?? connections.followingCount}
              />
              <Button href="/client/post-project" size="md">
                Invite to project
              </Button>
              <ShareProfileButton />
            </>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-neutral-600">
          <RatingStars value={profile.rating_avg ?? 0} count={profile.rating_count} size="md" />
          <span>
            <span className="font-semibold text-neutral-900">{profile.completed_count}</span> projects completed
          </span>
          <span>
            <span className="font-semibold text-neutral-900">~{profile.response_time_hours}h</span> response
          </span>
          {hourly != null ? (
            <span>
              <span className="font-semibold text-neutral-900">{formatMoney(hourly)}/hr</span>
            </span>
          ) : null}
          <AvailabilityPulse status={profile.availability} />
        </div>
      </ProfileHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* About */}
          <SpotlightCard>
            <h2 className="text-sm font-semibold text-neutral-900">About {user.name.split(" ")[0]}</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
              {profile.about?.trim()
                ? profile.about
                : `${user.name.split(" ")[0]} hasn’t added an About yet.`}
            </p>
            {skills.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill.slug} tone="neutral">
                    {skill.name}
                  </Badge>
                ))}
              </div>
            ) : null}
        </SpotlightCard>

          {/* Portfolio */}
          {portfolio.length > 0 ? (
            <SpotlightCard>
              <h2 className="text-sm font-semibold text-neutral-900">Selected work</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {portfolio.map((item) => (
                  <li key={item.id} className="group overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-neutral-900">{item.title}</p>
                        {item.project_url ? (
                          <a
                            href={item.project_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${item.title} externally`}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                          >
                            <Icon icon={ArrowUpRight02Icon} size={15} strokeWidth={1.8} />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{item.description}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-medium text-neutral-500">{item.role ?? ""}</span>
                        <span className="shrink-0 text-[11px] text-neutral-400">{item.year ?? ""}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          ) : null}

          {/* Experience */}
          {experience.length > 0 ? (
            <SpotlightCard>
              <h2 className="text-sm font-semibold text-neutral-900">Experience</h2>
              <ol className="mt-4 divide-y divide-neutral-100">
                {experience.map((role) => (
                  <li key={role.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-900">{role.role}</p>
                      <p className="text-xs text-neutral-500">{role.company}</p>
                      {role.description ? <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{role.description}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400">
                      {new Date(role.start_date).getFullYear()} - {role.end_date ? new Date(role.end_date).getFullYear() : "Present"}
                    </p>
                  </li>
                ))}
              </ol>
            </SpotlightCard>
          ) : null}

          {/* Education + certifications */}
          <div className="grid gap-6 sm:grid-cols-2">
            {education.length > 0 ? (
              <SpotlightCard>
                <h2 className="text-sm font-semibold text-neutral-900">Education</h2>
                <ul className="mt-3 space-y-3">
                  {education.map((edu) => (
                    <li key={edu.id}>
                      <p className="text-[13px] font-medium text-neutral-900">{edu.school}</p>
                      <p className="text-xs text-neutral-500">
                        {edu.degree}{edu.field ? `, ${edu.field}` : ""}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {edu.start_year} - {edu.end_year ?? ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            ) : null}
            {certifications.length > 0 ? (
              <SpotlightCard>
                <h2 className="text-sm font-semibold text-neutral-900">Certifications</h2>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {certifications.map((cert) => (
                    <li key={cert.id}>
                      <Badge tone="outline">{cert.name}</Badge>
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            ) : null}
          </div>

          {/* Client reviews */}
          {reviews.length > 0 ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-neutral-900">Client reviews</h2>
              <ul className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <RatingStars value={review.rating} count={0} size="sm" showValue={false} />
                      <span className="text-xs text-neutral-400">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    {review.comment ? <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{review.comment}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Sidebar column */}
        <aside className="flex flex-col gap-6">
          {/* Profile facts */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Details</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {profile.experience_level ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Experience</dt>
                  <dd className="font-medium text-neutral-900">{levelLabel}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Completed projects</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{profile.completed_count}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Client reviews</dt>
                <dd className="inline-flex items-center gap-1 font-medium text-neutral-900 tabular-nums">
                  <Icon icon={StarIcon} size={13} strokeWidth={2} className="text-amber-500" />
                  {profile.rating_count}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Avg. rating</dt>
                <dd className="font-medium text-neutral-900">{profile.rating_avg != null ? profile.rating_avg.toFixed(2) : "New"}</dd>
              </div>
            </dl>
          </section>

          {/* Contact details and social links */}
          <ContactLinks contact={contact} />

          {/* Payment honesty */}
          <section className="rounded-xl border border-brand-100 bg-brand-50/50 p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} className="text-brand-600" />
              How payment works
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600">
              Clients fund each milestone before it starts. Funds are held by our payment provider and released only
              when the client approves the deliverable. Workora never advertises escrow as a promise of quality; it is a
              promise about money.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
