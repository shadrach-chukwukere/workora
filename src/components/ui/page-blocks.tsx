import Link from "next/link";
import { cn } from "@/lib/utils";

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-500">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-neutral-800">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-neutral-900")}>
                  {item.label}
                </span>
              )}
              {!last ? (
                <svg viewBox="0 0 16 16" className="size-3.5 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                  <path d="M6 3.5L10.5 8L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1.5", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} className="mb-1" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          {description ? <p className="mt-0.5 max-w-2xl text-sm text-neutral-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
  className,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
        {icon ? <span aria-hidden className="text-neutral-400 [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">{value}</p>
        {delta ? (
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", delta.positive ? "text-emerald-700" : "text-rose-600")}>
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              {delta.positive ? <path d="M3.5 7.5L6 5l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M3.5 4.5L6 7l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
            {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
