import Link from "next/link";
import type { PublicFreelancer } from "@/lib/api-data";
import { formatNumber } from "@/lib/format";
import { Icon, StarIcon, Tick02Icon, UserMultiple02Icon, Briefcase02Icon } from "@/lib/icons";
import { ShortlistButton } from "@/components/freelancer/shortlist-button";
import { cn } from "@/lib/utils";

const AVAILABILITY_STYLE: Record<string, { label: string; dot: string }> = {
  available: { label: "Open", dot: "bg-emerald-400" },
  limited: { label: "Limited", dot: "bg-amber-400" },
  unavailable: { label: "Booked", dot: "bg-neutral-300" },
};

/**
 * Compact "player card" freelancer tile: a portrait photo with a light blended
 * scrim at the bottom carrying the details, a star badge and an availability
 * pill at the top, and a bookmark toggle beside the stats.
 */
export function FreelancerCard({
  freelancer,
  canShortlist = false,
  initiallyShortlisted = false,
}: {
  freelancer: PublicFreelancer;
  canShortlist?: boolean;
  initiallyShortlisted?: boolean;
}) {
  const rating = freelancer.rating_avg != null ? Number(freelancer.rating_avg) : null;
  const hasRating = rating != null && Number.isFinite(rating);
  const availability = AVAILABILITY_STYLE[freelancer.availability] ?? AVAILABILITY_STYLE.unavailable;
  const imageSrc = freelancer.image ?? `https://i.pravatar.cc/600?u=${encodeURIComponent(freelancer.id)}`;

  return (
    <li>
      <Link
        href={`/freelancers/${freelancer.id}`}
        className="group relative block min-h-[220px] h-[280px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgba(0,0,0,0.35)] sm:h-[300px] md:h-[320px]"
      >
        {/* Full-height portrait; blends into the card, slightly more than half visible */}
        <img
          src={imageSrc}
          alt={freelancer.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />

        {/* Soft top wash so the image melts into the surface */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/20 to-transparent" aria-hidden="true" />

        {/* Lighter blended scrim carrying the details at the bottom */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-neutral-950/85 via-neutral-950/45 to-transparent"
          aria-hidden="true"
        />

        {/* Star rating pinned top-right as n/5 */}
        <div className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          <Icon icon={StarIcon} size={12} strokeWidth={2} className="text-amber-400" />
          {hasRating ? `${rating!.toFixed(1)}/5` : "New"}
        </div>

        {/* Availability pill top-left */}
        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
          <span aria-hidden className={cn("size-1.5 rounded-full", availability.dot)} />
          {availability.label}
        </div>

        {/* Details live in the scrim at the bottom */}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="flex items-center gap-1.5 truncate text-base font-semibold tracking-tight sm:text-lg">
            <span className="truncate">{freelancer.name}</span>
            {freelancer.verified_identity ? (
              <Icon icon={Tick02Icon} size={15} strokeWidth={2.2} className="shrink-0 text-brand-300" aria-label="Identity verified" />
            ) : null}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/75">{freelancer.headline}</p>

          <div className="mt-3 flex items-center gap-x-3 gap-y-2 border-t border-white/20 pt-2.5 text-[11px] text-white/75">
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={UserMultiple02Icon} size={13} strokeWidth={1.8} className="text-white/60" />
              {formatNumber(freelancer.followers_count ?? 0)} followers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Briefcase02Icon} size={13} strokeWidth={1.8} className="text-white/60" />
              {formatNumber(freelancer.completed_count)} jobs
            </span>
            {canShortlist ? (
              <span className="ml-auto">
                <ShortlistButton
                  freelancerId={freelancer.id}
                  initiallyShortlisted={initiallyShortlisted}
                />
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
