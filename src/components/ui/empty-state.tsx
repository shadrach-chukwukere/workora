import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const emptyVariants = cva("flex flex-col items-center justify-center text-center", {
 variants: {
 variant: {
 surface: "rounded-xl border border-neutral-200 bg-white",
 dashed: "rounded-xl border border-dashed border-neutral-300",
 plain: "",
 },
 },
 defaultVariants: {
 variant: "surface",
 },
});

export function EmptyState({
 icon,
 title,
 description,
 action,
 secondaryAction,
 variant,
 className,
 compact,
}: {
 icon?: React.ReactNode;
 title: string;
 description?: string;
 action?: React.ReactNode;
 secondaryAction?: React.ReactNode;
 className?: string;
 compact?: boolean;
} & VariantProps<typeof emptyVariants>) {
 return (
 <div className={cn(emptyVariants({ variant }), "px-6", compact ? "py-8" : "py-16", className)}>
 {icon ? (
 <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
 {icon}
 </span>
 ) : null}
 <p className="font-medium text-neutral-900">{title}</p>
 {description ? <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p> : null}
 {action || secondaryAction ? (
 <div className="mt-5 flex items-center justify-center gap-2">
 {action}
 {secondaryAction}
 </div>
 ) : null}
 </div>
 );
}
