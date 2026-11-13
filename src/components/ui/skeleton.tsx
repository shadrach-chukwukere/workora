import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva("animate-pulse rounded-lg bg-neutral-200/70", {
 variants: {
 shape: {
 text: "h-3.5",
 title: "h-5",
 block: "h-auto w-full",
 circle: "rounded-full",
 },
 },
 defaultVariants: {
 shape: "text",
 },
});

export function Skeleton({ className, shape, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof skeletonVariants>) {
 return <div aria-hidden className={cn(skeletonVariants({ shape }), className)} {...props} />;
}

/** Standard page-level loading state: header + content blocks. */
export function SkeletonPage() {
 return (
 <div className="flex flex-col gap-6">
 <div className="flex items-end justify-between gap-4">
 <div className="flex flex-col gap-2">
 <Skeleton className="h-6 w-56" />
 <Skeleton className="h-4 w-80" />
 </div>
 <Skeleton className="h-9 w-32" />
 </div>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-24 rounded-xl" />
 ))}
 </div>
 <Skeleton className="h-72 rounded-xl" />
 </div>
 );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
 return (
 <div className="grid gap-3" aria-hidden>
 {Array.from({ length: count }).map((_, i) => (
 <Skeleton key={i} className="h-28 rounded-xl" />
 ))}
 </div>
 );
}
