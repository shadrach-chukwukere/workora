import Image from "next/image";
import Link from "next/link";
import { Icon, Location01Icon, Pen01Icon, ShieldCheckIcon } from "@/lib/icons";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * LinkedIn-style identity header: a cover banner with a circular profile photo
 * overlapping its bottom edge, followed by name, headline, location,
 * connections and actions.
 *
 * Deliberately static — no floating or looping motion on the profile photo.
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
    <section className={cn("w-full max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm", className)}>
      {/* Cover banner */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-brand-50 via-brand-100/70 to-sky-50 sm:h-40 lg:h-44">
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
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-neutral-50 sm:right-4 sm:top-4 sm:size-9"
          >
            <Icon icon={Pen01Icon} size={16} strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        {/* Circular photo overlapping the cover — no animation */}
        <div className="relative -mt-10 sm:-mt-14">
          <div className="inline-flex size-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-semibold text-brand-800 ring-4 ring-white sm:size-28 sm:text-2xl">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={`${name}'s profile photo`}
                width={128}
                height={128}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <span aria-hidden>{initials(name)}</span>
            )}
          </div>
        </div>

        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:mt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl lg:text-3xl">
              <span className="min-w-0 break-words">{name}</span>
              {verified ? (
                <span title="Identity verified" className="inline-flex shrink-0 text-brand-600">
                  <Icon icon={ShieldCheckIcon} size={18} strokeWidth={1.8} />
                  <span className="sr-only">Identity verified</span>
                </span>
              ) : null}
            </h1>
            {headline ? (
              <p className="mt-1 max-w-2xl break-words text-sm leading-snug text-neutral-700 sm:text-[15px]">{headline}</p>
            ) : null}
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 sm:text-[13px]">
              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon icon={Location01Icon} size={14} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
                  <span className="min-w-0 break-words">{location}</span>
                </span>
              ) : null}
              {connectionsLabel ? (
                <span className="whitespace-nowrap font-semibold text-brand-700">{connectionsLabel}</span>
              ) : null}
              {meta}
            </div>
          </div>
          {isSelf && editHref ? (
            <Link
              href={editHref}
              aria-label="Edit profile"
              title="Edit profile"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            >
              <Icon icon={Pen01Icon} size={16} strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>

        {actions ? (
          <div className={cn("mt-4 flex flex-wrap items-center gap-2", actionsClassName)}>{actions}</div>
        ) : null}
        {children ? <div className="mt-4 border-t border-neutral-100 pt-4">{children}</div> : null}
      </div>
    </section>
  );
}
