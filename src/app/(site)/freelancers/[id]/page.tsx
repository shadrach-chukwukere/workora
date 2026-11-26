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
import { normalizeExternalUrl } from "@/lib/urls";
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

  const rating = profile.rating_avg === null ? null : Number(profile.rating_avg);
  const hasAbout = Boolean(profile.about?.trim());
  const hasSkills = skills.length > 0;
  const hasPortfolio = portfolio.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasCertifications = certifications.length > 0;
  const hasReviews = reviews.length > 0;

  return (
    <div className="container-page max-w-full py-8 sm:py-12 lg:py-16">
      <a href="#main-content" className="skip-link" />
      <Link href="/find-talent" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-800 mb-4 sm:mb-6 block">
        <Icon icon={ArrowLeft02Icon} size={14} strokeWidth={1.8} />
        Browse talent
      </Link>

      {/* ===== IDENTITY HEADER ===== */}
      <ProfileHeader
        className="mt-4 sm:mt-6"
        name={user.name}
        headline={profile.headline}
        location={profile.location}
        avatarSrc={user.image}
        bannerSrc={user.banner_url}
        verified={profile.verified_identity}
        connectionsLabel={`${formatNumber(connections.followersCount)} followers · ${formatNumber(connections.followingCount)} following`}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Icon icon={Clock01Icon} size={14} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
              Member since {memberSince}
            </span>
            {profile.experience_level ? <span className="whitespace-nowrap">{levelLabel} level</span> : null}
          </>
        }
        actions={
          isSelf ? (
            <Button href="/freelancer/settings" size="md" variant="secondary" className="w-full sm:w-auto">
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
                showCounts={false}
              />
              <Button href="/client/post-project" size="md" className="w-full sm:w-auto">
                Invite to project
              </Button>
              <ShareProfileButton className="w-full sm:w-auto" />
            </>
          )
        }
      />

      {/* ===== STATS ROW ===== */}
      <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4">
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 sm:p-4 text-center">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Avg. rating</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {rating?.toFixed(2) ?? "New"}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">{profile.rating_count} reviews</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 sm:p-4 text-center">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Completed projects</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">{profile.completed_count}</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 sm:p-4 text-center">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Followers</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">{formatNumber(connections.followersCount)}</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 sm:p-4 text-center">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Response time</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {profile.response_time_hours ?? "—"}h avg
          </p>
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="mt-8 sm:mt-10 grid min-w-0 gap-8 sm:gap-10 lg:grid-cols-4 lg:gap-10">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-3">
          {/* About */}
          {hasAbout || hasSkills ? (
            <SpotlightCard>
              <h2 className="text-sm font-semibold text-neutral-900">About {user.name.split(" ")[0]}</h2>
              {hasAbout ? (
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
                  {profile.about?.trim()}
                </p>
              ) : (
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
                  {user.name.split(" ")[0]} hasn’t added an About yet.
                </p>
              )}
              {hasSkills ? (
                <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill.slug} tone="neutral" className="px-2.5 py-1.5 text-sm">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </SpotlightCard>
          ) : null}

          {/* Portfolio */}
          {hasPortfolio ? (
            <SpotlightCard>
              <h2 className="text-sm font-semibold text-neutral-900">Selected work</h2>
              <ul className="mt-4 grid gap-4 sm:gap-5">
                {portfolio.map((item) => {
                  const projectUrl = normalizeExternalUrl(item.project_url);
                  return (
                    <li key={item.id} className="group overflow-hidden rounded-lg border border-neutral-200 bg-white">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="aspect-[4/3] w-full object-cover object-center"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-neutral-900 sm:text-base">{item.title}</p>
                          {projectUrl ? (
                            <a
                              href={projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${item.title} externally`}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                            >
                              <Icon icon={ArrowUpRight02Icon} size={15} strokeWidth={1.8} />
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500 sm:text-sm">{item.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-medium text-neutral-500 sm:text-xs">{item.role ?? ""}</span>
                          <span className="shrink-0 text-[11px] text-neutral-400 sm:text-xs">{item.year ?? ""}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SpotlightCard>
          ) : null}

          {/* Experience */}
          {hasExperience ? (
            <SpotlightCard>
              <h2 className="text-sm font-semibold text-neutral-900">Experience</h2>
              <ol className="mt-4 divide-y divide-neutral-100">
                {experience.map((role) => (
                  <li key={role.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:py-5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-900 sm:text-base">{role.role}</p>
                      <p className="text-xs text-neutral-500 sm:text-sm">{role.company}</p>
                      {role.description ? <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 sm:text-sm">{role.description}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400 sm:text-sm">
                      {new Date(role.start_date).getFullYear()} - {role.end_date ? new Date(role.end_date).getFullYear() : "Present"}
                    </p>
                  </li>
                ))}
              </ol>
            </SpotlightCard>
          ) : null}

          {/* Client reviews */}
          {hasReviews ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-neutral-900">Client reviews</h2>
              <ul className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-neutral-100 pb-4 sm:pb-5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <RatingStars value={review.rating} count={0} size="sm" showValue={false} />
                      <span className="text-xs text-neutral-400 sm:text-sm">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    {review.comment ? <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{review.comment}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Sidebar column */}
        <aside className="flex min-w-0 flex-col gap-8 sm:gap-10 lg:col-span-1">
          {/* Profile facts */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Details</h2>
            <dl className="mt-3 space-y-2.5 sm:space-y-3 text-[13px] sm:text-sm">
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
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Availability</dt>
                <dd className="font-medium text-neutral-900">
                  <AvailabilityPulse status={profile.availability} className="shrink-0" />
                  {profile.availability.charAt(0).toUpperCase() + profile.availability.slice(1)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Contact details and social links */}
          <ContactLinks contact={contact} />

          {/* Payment honesty */}
          <section className="rounded-xl border border-brand-100 bg-brand-50/50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} className="text-brand-600" />
              How payment works
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
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