import { cn } from "@/lib/utils";

export function RatingStars({
 value,
 count,
 size = "sm",
 showValue = true,
 className,
}: {
 value: number;
 count?: number;
 size?: "sm" | "md" | "lg";
 showValue?: boolean;
 className?: string;
}) {
 const dims = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
 const textSize = { sm: "text-xs", md: "text-sm", lg: "text-sm" }[size];
 return (
 <span className={cn("inline-flex items-center gap-1", className)}>
 <span aria-hidden className="inline-flex items-center gap-px">
 {Array.from({ length: 5 }).map((_, i) => (
 <svg key={i} viewBox="0 0 20 20" className={cn(dims, i < Math.round(value) ? "text-amber-400" : "text-neutral-300")} fill="currentColor">
 <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
 </svg>
 ))}
 </span>
 {showValue ? (
 <>
 <span className={cn("font-medium text-neutral-900", textSize)}>{value.toFixed(2)}</span>
 {typeof count === "number" ? <span className={cn("text-neutral-500", textSize)}>({count})</span> : null}
 </>
 ) : null}
 <span className="sr-only">{`Rated ${value.toFixed(2)} out of 5${count ? `, ${count} reviews` : ""}`}</span>
 </span>
 );
}
