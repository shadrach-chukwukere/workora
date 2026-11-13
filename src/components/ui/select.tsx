"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
 value: string;
 label: string;
 meta?: string;
}

export function Select({
 value,
 options,
 onChange,
 placeholder = "Select an option",
 ariaLabel,
 className,
 triggerClassName,
 align = "start",
 invalid,
 disabled,
}: {
 value: string | null;
 options: SelectOption[];
 onChange: (value: string) => void;
 placeholder?: string;
 ariaLabel: string;
 className?: string;
 triggerClassName?: string;
 align?: "start" | "end";
 invalid?: boolean;
 disabled?: boolean;
}) {
 const listboxId = useId();
 const [open, setOpen] = useState(false);
 const [activeIndex, setActiveIndex] = useState<number | null>(null);
 const listRef = useRef<(HTMLLIElement | null)[]>([]);
 const rootRef = useRef<HTMLDivElement>(null);
 const typeahead = useRef({ query: "", ts: 0 });

 const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

 useEffect(() => {
 if (!open) return;
 const onPointerDown = (e: PointerEvent) => {
 if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
 };
 document.addEventListener("pointerdown", onPointerDown);
 return () => document.removeEventListener("pointerdown", onPointerDown);
 }, [open]);

 useEffect(() => {
 if (open && activeIndex != null) listRef.current[activeIndex]?.scrollIntoView({ block: "nearest" });
 }, [open, activeIndex]);

 function openListbox() {
 if (disabled) return;
 const initialIdx = options.findIndex((o) => o.value === value);
 setActiveIndex(initialIdx === -1 ? 0 : initialIdx);
 setOpen(true);
 }

 function commit(ov: SelectOption) {
 onChange(ov.value);
 setOpen(false);
 }

 function onKeyDown(e: React.KeyboardEvent) {
 if (!open) {
 if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
 e.preventDefault();
 openListbox();
 }
 return;
 }
 if (e.key === "Escape") {
 e.preventDefault();
 setOpen(false);
 return;
 }
 if (e.key === "ArrowDown" || e.key === "ArrowUp") {
 e.preventDefault();
 const last = options.length - 1;
 setActiveIndex((i) => {
 const now = i == null ? 0 : e.key === "ArrowDown" ? Math.min(i + 1, last) : Math.max(i - 1, 0);
 return now;
 });
 return;
 }
 if (e.key === "Home") {
 e.preventDefault();
 setActiveIndex(0);
 return;
 }
 if (e.key === "End") {
 e.preventDefault();
 setActiveIndex(options.length - 1);
 return;
 }
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 if (activeIndex != null) commit(options[activeIndex]);
 return;
 }
 if (e.key.length === 1 && /[a-z0-9$]/i.test(e.key)) {
 const now = Date.now();
 const q = now - typeahead.current.ts < 800 ? typeahead.current.query + e.key.toLowerCase() : e.key.toLowerCase();
 typeahead.current = { query: q, ts: now };
 const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
 if (idx !== -1) setActiveIndex(idx);
 }
 }

 return (
 <div ref={rootRef} className={cn("relative", className)}>
 <button
 type="button"
 role="combobox"
 aria-expanded={open}
 aria-haspopup="listbox"
 aria-controls={open ? listboxId : undefined}
 aria-label={ariaLabel}
 aria-invalid={invalid || undefined}
 disabled={disabled}
 onClick={() => (open ? setOpen(false) : openListbox())}
 onKeyDown={onKeyDown}
 className={cn(
 "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm transition-colors",
 open ? "border-brand-500" : "border-neutral-200 hover:border-neutral-300",
 disabled && "cursor-auto bg-neutral-100 text-neutral-400",
 invalid ? "border-rose-400" : "",
 triggerClassName
 )}
 >
 <span className={cn("truncate", selected ? "text-neutral-900" : "text-neutral-400")}>
 {selected?.label ?? placeholder}
 </span>
 <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={1.6}>
 <path d="M4 6.5L8 10.5L12 6.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 </button>

 {open ? (
 <ul
 id={listboxId}
 role="listbox"
 aria-activedescendant={activeIndex != null ? `${listboxId}-${activeIndex}` : undefined}
 tabIndex={-1}
 className={cn(
 "anim-pop absolute z-40 mt-1.5 max-h-72 w-full min-w-44 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-dropdown",
 align === "end" ? "left-auto right-0" : "left-0"
 )}
 >
 {options.map((o, i) => (
 <li
 key={o.value}
 id={`${listboxId}-${i}`}
 role="option"
 aria-selected={o.value === value}
 ref={(el) => {
 listRef.current[i] = el;
 }}
 onMouseDown={(e) => e.preventDefault()}
 onMouseEnter={() => setActiveIndex(i)}
 onClick={() => commit(o)}
 className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm", i === activeIndex ? "bg-neutral-100" : "")}
 >
 <span className="flex min-w-0 flex-col">
 <span className={cn("truncate", o.value === value ? "font-medium text-brand-800" : "text-neutral-800")}>{o.label}</span>
 {o.meta ? <span className="truncate text-xs text-neutral-500">{o.meta}</span> : null}
 </span>
 {o.value === value ? (
 <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2}>
 <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 ) : null}
 </li>
 ))}
 </ul>
 ) : null}
 </div>
 );
}
