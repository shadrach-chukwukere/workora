import { cn } from "@/lib/utils";

export function Progress({
 value,
 max = 100,
 className,
 barClassName,
 formatLabel,
}: {
 value: number;
 max?: number;
 className?: string;
 barClassName?: string;
 formatLabel?: (percent: number) => string;
}) {
 const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
 return (
 <div
 role="progressbar"
 aria-valuenow={percent}
 aria-valuemin={0}
 aria-valuemax={100}
 aria-label={formatLabel ? formatLabel(percent) : undefined}
 className={cn("h-2 w-full overflow-hidden rounded-full bg-neutral-100", className)}
 >
 <div
 className={cn("h-full rounded-full bg-brand-600 transition-[width] duration-300", barClassName)}
 style={{ width: `${percent}%` }}
 />
 </div>
 );
}
