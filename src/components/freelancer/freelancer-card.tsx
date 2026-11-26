import Link from "next/link";
import type { PublicFreelancer } from "@/lib/api-data";
import { formatMoney, formatNumber } from "@/lib/format";
import { Icon, StarIcon, Tick02Icon, UserMultiple02Icon, Briefcase02Icon } from "@/lib/icons";
import { ShortlistButton } from "@/components/freelancer/shortlist-button";
import { cn } from "@/lib/utils";

const AVAILABILITY_STYLE: Record<string, { label: string; dot: string }> = {
  available: { label: "Open", dot: "bg-emerald-400" },
  limited: { label: "Limited", dot: "bg-amber-400" },
  unavailable: { label: "Booked", dot: "bg-neutral-300" },
};

/**
 * "Player card" style freelancer tile: a full-height portrait photo with a
 * dark blended scrim at the bottom carrying the details, and a star rating
 * badge pinned to the top-right as n/5.
 */
export function FreelancerCard({ freelancer }: { freelancer: PublicFreelancer }) {
  const rating = freelancer.rating_avg != null ? Number(freelancer.rating_avg) : null;
  const hasRating = rating != null && Number.isFinite(rating);
  const availability = AVAILABILITY_STYLE[freelancer.availability] ?? AVAILABILITY_STYLE.unavailable;
  const imageSrc = freelancer.image ?? `https://i.pravatar.cc/600?u=${encodeURIComponent(freelancer.id)}`;

  return (
    <li>
      <Link
        href={`/freelancers/${freelancer.id}`}
        className="group relative block h-[380px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.35)] sm:h-[420px]"
      >
        {/* Full-height portrait; blends into the card, slightly more than half visible */}
        <img
          src={imageSrc}
          alt={freelancer.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />

        {/* Soft top wash so the image melts into the surface */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/25 to-transparent" aria-hidden="true" />

        {/* Dark blended scrim carrying the details at the bottom */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent"
          aria-hidden="true"
        />

        {/* Star rating pinned top-right as n/5 */}
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
          <Icon icon={StarIcon} size={13} strokeWidth={2} className="text-amber-400" />
          {hasRating ? `${rating!.toFixed(1)}/5` : "New"}
        </div>

        {/* Availability pill top-left */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          <span aria-hidden className={cn("size-1.5 rounded-full", availability.dot)} />
          {availability.label}
        </div>

        {/* Shortlist button over the image, top-right below the rating */}
        <div className="absolute right-3 top-12 z-10">
          <ShortlistButton
            freelancerId={freelancer.id}
            className="rounded-full border border-white/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-900 shadow-sm hover:bg-white/90"
          />
        </div>

        {/* Details live in the dark scrim at the bottom, responsive by column */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="flex items-center gap-1.5 truncate text-lg font-semibold tracking-tight">
            <span className="truncate">{freelancer.name}</span>
            {freelancer.verified_identity ? (
              <Icon icon={Tick02Icon} size={16} strokeWidth={2.2} className="shrink-0 text-brand-300" aria-label="Identity verified" />
            ) : null}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/75">{freelancer.headline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/15 pt-3 text-xs text-white/70">
            <span className="text-sm font-semibold text-white">
              {freelancer.hourly_rate_minor != null
                ? `${formatMoney(freelancer.hourly_rate_minor / 100)}/hr`
                : "Rate on request"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={UserMultiple02Icon} size={13} strokeWidth={1.8} className="text-white/60" />
              {formatNumber(freelancer.followers_count ?? 0)} followers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Briefcase02Icon} size={13} strokeWidth={1.8} className="text-white/60" />
              {formatNumber(freelancer.completed_count)} jobs
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
