"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
 id: string;
 label: string;
 count?: number;
}

export function Tabs({
 value,
 items,
 onChange,
 ariaLabel,
 className,
}: {
 value: string;
 items: TabItem[];
 onChange: (id: string) => void;
 ariaLabel: string;
 className?: string;
}) {
 return (
 <div role="tablist" aria-label={ariaLabel} className={cn("flex gap-1 overflow-x-auto border-b border-neutral-200", className)}>
 {items.map((t) => {
 const active = t.id === value;
 return (
 <button
 key={t.id}
 type="button"
 role="tab"
 aria-selected={active}
 onClick={() => onChange(t.id)}
 className={cn(
 "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
 active ? "border-brand-600 text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
 )}
 >
 {t.label}
 {typeof t.count === "number" ? (
 <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] leading-3.5 font-medium", active ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-500")}>
 {t.count}
 </span>
 ) : null}
 </button>
 );
 })}
 </div>
 );
}
