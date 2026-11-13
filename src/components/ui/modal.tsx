"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const SIZES = {
 sm: "max-w-sm",
 md: "max-w-lg",
 lg: "max-w-3xl",
 xl: "max-w-4xl",
} as const;

function lockScroll() {
 const prev = document.documentElement.style.overflow;
 document.documentElement.style.overflow = "hidden";
 return () => {
 document.documentElement.style.overflow = prev;
 };
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
 open,
 onClose,
 title,
 description,
 children,
 footer,
 size = "md",
 className,
}: {
 open: boolean;
 onClose: () => void;
 title: string;
 description?: string;
 children: React.ReactNode;
 footer?: React.ReactNode;
 size?: keyof typeof SIZES;
 className?: string;
}) {
 const [mounted, setMounted] = useState(false);
 const panelRef = useRef<HTMLDivElement>(null);
 const titleId = `modal-${useId()}`;

 useEffect(() => setMounted(true), []);

 useEffect(() => {
 if (!open || !mounted) return;
 const unlock = lockScroll();
 const panel = panelRef.current;
 const previousFocus = document.activeElement as HTMLElement | null;
 const focusables = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
 (focusables[0] ?? panel)?.focus();

 return () => {
 unlock();
 previousFocus?.focus?.();
 };
 }, [open, mounted]);

 if (!mounted) return null;
 if (!open) return null;

 function keyDown(e: React.KeyboardEvent) {
 if (e.key === "Escape") {
 e.stopPropagation();
 onClose();
 return;
 }
 if (e.key === "Tab" && panelRef.current) {
 const list = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
 if (list.length === 0) return;
 const first = list[0];
 const last = list[list.length - 1];
 if (e.shiftKey && document.activeElement === first) {
 e.preventDefault();
 last.focus();
 } else if (!e.shiftKey && document.activeElement === last) {
 e.preventDefault();
 first.focus();
 }
 }
 }

 return createPortal(
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onKeyDown={keyDown}>
 <div className="anim-overlay absolute inset-0 bg-neutral-950/40" aria-hidden onClick={onClose} />
 <div
 ref={panelRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby={titleId}
 tabIndex={-1}
 className={cn("anim-pop relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-overlay", SIZES[size], className)}
 >
 <header className="flex shrink-0 flex-col gap-1 border-b border-neutral-100 px-6 py-4">
 <h2 id={titleId} className="text-base font-semibold text-neutral-900">
 {title}
 </h2>
 {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
 </header>
 <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
 {footer ? <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-3.5">{footer}</footer> : null}
 </div>
 </div>,
 document.body
 );
}

export function ConfirmDialog({
 open,
 onClose,
 onConfirm,
 title,
 description,
 confirmLabel = "Confirm",
 cancelLabel = "Cancel",
 tone = "brand",
 loading,
}: {
 open: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 description: string;
 confirmLabel?: string;
 cancelLabel?: string;
 tone?: "brand" | "danger";
 loading?: boolean;
}) {
 return (
 <Modal open={open} onClose={onClose} title={title} size="sm">
 <p className="text-sm text-neutral-600">{description}</p>
 <div className="mt-6 flex justify-end gap-2">
 <button
 type="button"
 onClick={onClose}
 className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
 >
 {cancelLabel}
 </button>
 <button
 type="button"
 onClick={onConfirm}
 disabled={loading}
 className={cn(
 "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium text-white disabled:opacity-50",
 tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"
 )}
 >
 {loading ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent opacity-70" /> : null}
 {confirmLabel}
 </button>
 </div>
 </Modal>
 );
}
