"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, ArrowDown01Icon } from "@/lib/icons";

export interface NavDropdownItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
}

/** Smart custom dropdown for header nav links. Accessible: outside click, Escape, arrow keys. */
export function NavDropdown({
  label,
  items,
  active,
  align = "start",
}: {
  label: string;
  items: NavDropdownItem[];
  active?: boolean;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => linkRefs.current[0]?.focus());
    }
  }

  function onItemKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      linkRefs.current[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      linkRefs.current[(index - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} menu`}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900",
          active ? "text-neutral-900" : "text-neutral-600",
        )}
      >
        {label}
        <Icon icon={ArrowDown01Icon} size={14} strokeWidth={1.8} className={cn("shrink-0 opacity-60 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`${label} menu`}
          className={cn(
            "anim-pop absolute z-50 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-dropdown",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              ref={(el) => {
                linkRefs.current[index] = el;
              }}
              onClick={() => setOpen(false)}
              onKeyDown={(e) => onItemKeyDown(e, index)}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
            >
              {item.icon ? <span aria-hidden className="mt-0.5 shrink-0 text-brand-600">{item.icon}</span> : null}
              <span className="min-w-0">
                <span className="block font-medium text-neutral-800">{item.label}</span>
                {item.description ? <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{item.description}</span> : null}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
