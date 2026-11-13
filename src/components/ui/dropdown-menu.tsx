"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  type?: "item" | "separator" | "label";
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  hint?: string;
  disabled?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  align = "end",
  label,
  className,
}: {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectable = items.filter((i) => i.type === "item");

  function focusItem(index: number) {
    if (index >= 0 && index < itemRefs.current.length) itemRefs.current[index]?.focus();
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <span
        className="inline-flex"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
      >
        {trigger}
      </span>

      {open ? (
        <div role="menu" aria-label={label} className={cn("anim-pop absolute z-40 mt-1 min-w-[180px] max-w-[260px] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-dropdown", align === "end" ? "right-0" : "left-0")}>
          {items.map((item, idx) => {
            if (item.type === "separator") return <div key={idx} role="presentation" className="my-1 h-px bg-neutral-100" />;
            if (item.type === "label")
              return (
                <p key={idx} className="px-3 pb-1 pt-2 text-xs font-medium text-neutral-400">
                  {item.label}
                </p>
              );
            const selectIdx = selectable.indexOf(item);
            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                ref={(el) => {
                  itemRefs.current[selectIdx] = el;
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusItem((selectIdx + 1) % selectable.length);
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    focusItem((selectIdx - 1 + selectable.length) % selectable.length);
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    setOpen(false);
                  }
                }}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-40",
                  item.danger ? "text-rose-700 hover:bg-rose-50" : "text-neutral-800 hover:bg-neutral-50 hover:text-neutral-900"
                )}
              >
                {item.icon ? <span aria-hidden className={cn("shrink-0 [&_svg]:size-4", item.danger ? "text-rose-600" : "text-neutral-500")}>{item.icon}</span> : null}
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
                {item.hint ? <span className="text-xs text-neutral-400">{item.hint}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
