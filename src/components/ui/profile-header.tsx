import Image from "next/image";
import Link from "next/link";
import { Icon, Location01Icon, Pen01Icon, ShieldCheckIcon } from "@/lib/icons";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Premium identity header: a cover banner with a circular profile photo
 * overlapping its bottom edge, followed by name, headline, location,
 * connections and actions.
 *
 * Responsive by design:
 * - Mobile: avatar sits below the cover, stacked vertically with actions full-width
 * - Tablet+: avatar overlaps cover, actions sit side-by-side with identity
 */
export function ProfileHeader({
  name,
  headline,
  location,
  avatarSrc,
  bannerSrc,
  verified = false,
  connectionsLabel,
  meta,
  actions,
  actionsClassName,
  children,
  isSelf = false,
  editHref,
  className,
}: {
  name: string;
  headline?: string | null;
  location?: string | null;
  avatarSrc?: string | null;
  bannerSrc?: string | null;
  verified?: boolean;
  connectionsLabel?: string | null;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  actionsClassName?: string;
  children?: React.ReactNode;
  isSelf?: boolean;
  editHref?: string;
  className?: string;
}) {
  return (
    <section className={cn("w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm", className)}>
      {/* Cover banner */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-brand-50 via-brand-100/70 to-sky-50 sm:h-40 lg:h-48">
        {bannerSrc ? (
          <Image
            src={bannerSrc}
            alt=""
            fill
            sizes="100vw"
            className="size-full object-cover object-center"
            unoptimized
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" aria-hidden="true" />
        {isSelf && editHref ? (
          <Link
            href={editHref}
            aria-label="Edit cover photo"
            title="Edit cover photo"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-neutral-50 sm:right-4 sm:top-4 sm:size-10"
          >
            <Icon icon={Pen01Icon} size={17} strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8">
        {/* Circular photo overlapping the cover */}
        <div className="relative -mt-10 sm:-mt-14 lg:-mt-16">
          <div className="inline-flex size-24 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-semibold text-brand-800 ring-6 ring-white sm:size-32 sm:text-3xl lg:size-40 lg:text-4xl">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={`${name}'s profile photo`}
                width={160}
                height={160}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <span aria-hidden>{initials(name)}</span>
            )}
          </div>
        </div>

        {/* Identity block — name, headline, location, connections, meta */}
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:mt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 lg:gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl lg:text-3xl">
              <span className="min-w-0 break-words">{name}</span>
              {verified ? (
                <span title="Identity verified" className="inline-flex shrink-0 items-center gap-1 text-brand-600 sm:text-sm">
                  <Icon icon={ShieldCheckIcon} size={16} strokeWidth={1.8} />
                  Verified
                </span>
              ) : null}
            </h1>
            {headline ? (
              <p className="mt-1 max-w-2xl break-words text-sm leading-snug text-neutral-700 sm:text-[15px] lg:text-base">{headline}</p>
            ) : null}
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-500 sm:text-[13px]">
              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon icon={Location01Icon} size={14} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
                  <span className="min-w-0 break-words">{location}</span>
                </span>
              ) : null}
              {connectionsLabel ? (
                <span className="whitespace-nowrap font-semibold text-brand-700 text-xs sm:text-sm">{connectionsLabel}</span>
              ) : null}
              {meta}
            </div>
          </div>
          {isSelf && editHref ? (
            <Link
              href={editHref}
              aria-label="Edit profile"
              title="Edit profile"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 sm:size-11"
            >
              <Icon icon={Pen01Icon} size={17} strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>

        {/* Actions — full width on mobile, inline on desktop */}
        {actions ? (
          <div className={cn("mt-5 flex flex-wrap items-center justify-center gap-2 sm:mt-6 sm:justify-start sm:gap-3", actionsClassName)}>
            {actions}
          </div>
        ) : null}
        {children ? <div className="mt-5 border-t border-neutral-100 pt-5 sm:mt-8 sm:pt-6">{children}</div> : null}
      </div>
    </section>
  );
}