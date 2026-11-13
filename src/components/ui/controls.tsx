"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
 value: T;
 label: string;
}

/** iOS-style segmented control for 2 - 4 mutually exclusive values. */
export function Segmented<T extends string>({
 value,
 options,
 onChange,
 ariaLabel,
 size = "md",
 className,
}: {
 value: T;
 options: SegmentedOption<T>[];
 onChange: (value: T) => void;
 ariaLabel: string;
 size?: "sm" | "md";
 className?: string;
}) {
 return (
 <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex items-center rounded-lg bg-neutral-100 p-0.5", className)}>
 {options.map((o) => {
 const active = o.value === value;
 return (
 <button
 key={o.value}
 type="button"
 role="radio"
 aria-checked={active}
 onClick={() => onChange(o.value)}
 className={cn(
 "rounded-md font-medium transition-colors",
 size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3 text-sm",
 active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
 )}
 >
 {o.label}
 </button>
 );
 })}
 </div>
 );
}

export function Switch({
 checked,
 onChange,
 label,
 ariaLabel,
 disabled,
}: {
 checked: boolean;
 onChange: (checked: boolean) => void;
 label?: string;
 ariaLabel: string;
 disabled?: boolean;
}) {
 const control = (
 <button
 type="button"
 role="switch"
 aria-checked={checked}
 aria-label={ariaLabel}
 disabled={disabled}
 onClick={() => onChange(!checked)}
 className={cn(
 "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
 checked ? "bg-brand-600" : "bg-neutral-200 hover:bg-neutral-300"
 )}
 >
 <span aria-hidden className={cn("absolute size-4 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-4.5 left-0.5" : "left-0.5")} />
 </button>
 );
 if (!label) return control;
 return (
 <button type="button" aria-hidden={false} onClick={() => !disabled && onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
 <span className="text-sm text-neutral-800">{label}</span>
 {control}
 </button>
 );
}
