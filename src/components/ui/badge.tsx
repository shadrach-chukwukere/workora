import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
 "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
 {
 variants: {
 tone: {
 neutral: "bg-neutral-100 text-neutral-700",
 brand: "bg-brand-100 text-brand-800",
 success: "bg-emerald-100 text-emerald-800",
 warning: "bg-amber-100 text-amber-800",
 danger: "bg-rose-100 text-rose-700",
 outline: "border border-neutral-200 text-neutral-600",
 },
 },
 defaultVariants: {
 tone: "neutral",
 },
 }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
 /** Optional semantic dot. Only use where the dot conveys real state (e.g. live status). */
 dot?: "success" | "warning" | "danger" | "brand";
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
 return (
 <span className={cn(badgeVariants({ tone }), className)} {...props}>
 {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dotTone[dot])} /> : null}
 {children}
 </span>
 );
}

const dotTone = {
 success: "bg-emerald-500",
 warning: "bg-amber-500",
 danger: "bg-rose-500",
 brand: "bg-brand-500",
} as const;

/** Maps a domain status through a meta table into a Badge. */
export function StatusBadge<S extends string>({
 status,
 meta,
 className,
}: {
 status: S;
 meta: Record<S, { label: string; tone?: VariantProps<typeof badgeVariants>["tone"] }>;
 className?: string;
}) {
 const entry = meta[status] ?? { label: status, tone: "neutral" as const };
 return (
 <Badge tone={entry.tone ?? "neutral"} className={className}>
 {entry.label}
 </Badge>
 );
}
