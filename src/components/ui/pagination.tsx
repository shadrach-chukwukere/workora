"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
 if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
 const out: (number | "gap")[] = [1];
 const start = Math.max(2, page - 1);
 const end = Math.min(totalPages - 1, page + 1);
 if (start > 2) out.push("gap");
 for (let i = start; i <= end; i++) out.push(i);
 if (end < totalPages - 1) out.push("gap");
 out.push(totalPages);
 return out;
}

/** URL-state pagination - preserves other query params on the current route. */
export function Pagination({
 page,
 totalPages,
 className,
}: {
 page: number;
 totalPages: number;
 className?: string;
}) {
 const pathname = usePathname();
 const searchParams = useSearchParams();

 if (totalPages <= 1) return null;

 function hrefFor(p: number): string {
 const params = new URLSearchParams(searchParams.toString());
 params.set("page", String(p));
 return `${pathname}?${params.toString()}`;
 }

 const itemClass =
 "inline-flex size-8 items-center justify-center rounded-lg text-sm transition-colors";
 const numbers = pageNumbers(page, totalPages);

 return (
 <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
 {page > 1 ? (
 <Link href={hrefFor(page - 1)} className={cn(itemClass, "text-neutral-600 hover:bg-neutral-100")}>
 <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
 <path d="M10 3.5L5.5 8L10 12.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 <span className="sr-only">Previous page</span>
 </Link>
 ) : (
 <span className={cn(itemClass, "text-neutral-300")} aria-disabled>
 <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
 <path d="M10 3.5L5.5 8L10 12.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 <span className="sr-only">Previous page, unavailable</span>
 </span>
 )}
 {numbers.map((n, i) =>
 n === "gap" ? (
 <span key={`gap-${i}`} className="inline-flex size-8 items-center justify-center text-sm text-neutral-400" aria-hidden>
 …
 </span>
 ) : n === page ? (
 <span key={n} aria-current="page" className={cn(itemClass, "bg-brand-600 font-medium text-white")}>
 {n}
 </span>
 ) : (
 <Link key={n} href={hrefFor(n)} className={cn(itemClass, "text-neutral-700 hover:bg-neutral-100")}>
 {n}
 </Link>
 )
 )}
 {page < totalPages ? (
 <Link href={hrefFor(page + 1)} className={cn(itemClass, "text-neutral-600 hover:bg-neutral-100")}>
 <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
 <path d="M6 3.5L10.5 8L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 <span className="sr-only">Next page</span>
 </Link>
 ) : (
 <span className={cn(itemClass, "text-neutral-300")} aria-disabled>
 <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
 <path d="M6 3.5L10.5 8L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 <span className="sr-only">Next page, unavailable</span>
 </span>
 )}
 </nav>
 );
}
