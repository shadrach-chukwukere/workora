"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
 value: string;
 label: string;
}

/** Multi-value picker with inline chips and a searchable popover. Used for skills. */
export function ComboboxMulti({
 options,
 value,
 onChange,
 max = 12,
 placeholder = "Add skills…",
 ariaLabel,
 className,
}: {
 options: ComboboxOption[];
 value: string[];
 onChange: (value: string[]) => void;
 max?: number;
 placeholder?: string;
 ariaLabel: string;
 className?: string;
}) {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState("");
 const rootRef = useRef<HTMLDivElement>(null);
 const searchRef = useRef<HTMLInputElement>(null);

 const selectedSet = useMemo(() => new Set(value), [value]);
 const filtered = useMemo(() => {
 if (!query.trim()) return options;
 return options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
 }, [options, query]);

 const bubbleOptions = useMemo(
 () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as ComboboxOption[],
 [value, options]
 );

 useEffect(() => {
 if (!open) return;
 const onPointerDown = (e: PointerEvent) => {
 if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
 };
 document.addEventListener("pointerdown", onPointerDown);
 return () => document.removeEventListener("pointerdown", onPointerDown);
 }, [open]);

 function toggle(v: string) {
 if (selectedSet.has(v)) {
 onChange(value.filter((x) => x !== v));
 } else if (value.length < max) {
 onChange([...value, v]);
 }
 }

 const atCapacity = value.length >= max;

 return (
 <div ref={rootRef} className={cn("relative", className)}>
 <button
 type="button"
 aria-expanded={open}
 aria-haspopup="listbox"
 aria-label={ariaLabel}
 disabled={atCapacity && !open ? true : undefined}
 onClick={() => {
 if (!open) {
 setOpen(true);
 setQuery("");
 requestAnimationFrame(() => {
 searchRef.current?.focus();
 });
 }
 }}
 className={cn(
 "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
 open ? "border-brand-500" : "border-neutral-200 hover:border-neutral-300",
 atCapacity && !open && "opacity-90"
 )}
 >
 {bubbleOptions.length === 0 ? (
 <span className="px-1.5 text-sm text-neutral-400">{placeholder}</span>
 ) : (
 <>
 {bubbleOptions.slice(0, 6).map((o, i) => (
 <span key={o.value} className={cn("inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-2 text-xs font-medium text-brand-800", i > 2 && "hidden sm:inline-flex")}>
 {o.label}
 <span
 role="button"
 tabIndex={0}
 aria-label={`Remove ${o.label}`}
 onClick={(e) => {
 e.stopPropagation();
 toggle(o.value);
 }}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.stopPropagation();
 toggle(o.value);
 }
 }}
 className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full text-brand-600 hover:bg-brand-100"
 >
 <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2}>
 <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
 </svg>
 </span>
 </span>
 ))}
 {bubbleOptions.length > 3 ? <span className="px-1 text-xs text-neutral-500">+{bubbleOptions.length - 3}</span> : null}
 </>
 )}
 <svg viewBox="0 0 16 16" className="ml-auto size-4 shrink-0 self-center text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.6}>
 <path d="M12 6.5L8 10.5L4 6.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 </button>

 {open ? (
 <div className="anim-pop absolute z-40 mt-1.5 w-full rounded-lg border border-neutral-200 bg-white p-2 shadow-dropdown">
 <div className="relative flex items-center">
 <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-2.5 size-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
 <circle cx={9} cy={9} r={5.5} />
 <path d="M13.5 13.5L17 17" strokeLinecap="round" />
 </svg>
 <input
 ref={searchRef}
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "ArrowDown" && filtered.length) {
 e.preventDefault();
 e.currentTarget.form?.querySelector("li button");
 }
 if (e.key === "Escape") setOpen(false);
 if (e.key === "Enter" && query.trim() && !selectedSet.has(query.trim()) && !atCapacity) {
 const matchLabel = options.find((o) => o.label.toLowerCase() === query.trim().toLowerCase());
 toggle(matchLabel ? matchLabel.value : query.trim());
 }
 }}
 placeholder="Search or add a skill"
 className="h-9 w-full rounded-md border border-neutral-200 pl-8 pr-2 text-sm placeholder:text-neutral-400 focus:border-brand-500"
 />
 </div>
 <ul role="listbox" aria-multiselectable className="mt-2 max-h-60 overflow-y-auto">
 {filtered.map((o) => (
 <li key={o.value}>
 <button
 type="button"
 role="option"
 aria-selected={selectedSet.has(o.value)}
 disabled={atCapacity && !selectedSet.has(o.value)}
 onClick={() => toggle(o.value)}
 className={cn(
 "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-neutral-800 disabled:opacity-40 hover:bg-neutral-100",
 (selectedSet.has(o.value) || atCapacity) && "pr-2.5"
 )}
 >
 {o.label}
 {selectedSet.has(o.value) ? (
 <svg viewBox="0 0 16 16" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2}>
 <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 ) : atCapacity ? null : (
 <svg viewBox="0 0 16 16" className="size-4 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
 <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
 </svg>
 )}
 </button>
 </li>
 ))}
 {filtered.length === 0 ? (
 <li className="px-2.5 py-3 text-sm text-neutral-500">
 {query.trim() && !atCapacity ? 'Press Enter to add "' + query.trim() + '"' : "No matching skills"}
 </li>
 ) : null}
 </ul>
 <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
 <span>
 {value.length}/{max} selected
 </span>
 {value.length ? (
 <button type="button" onClick={() => onChange([])} className="font-medium text-neutral-700 hover:text-neutral-900">
 Clear all
 </button>
 ) : null}
 </div>
 </div>
 ) : null}
 </div>
 );
}
