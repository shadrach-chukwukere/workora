import { cn } from "@/lib/utils";

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
 return (
 <div className={cn("w-full overflow-x-auto rounded-xl border border-neutral-200 bg-white", className)}>
 {children}
 </div>
 );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
 return (
 <table className={cn("w-full min-w-[720px] border-collapse text-sm [&_tbody>tr:last-child>td]:border-b-0", className)}>
 {children}
 </table>
 );
}

export function THead({ children }: { children: React.ReactNode }) {
 return (
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/80">
 {children}
 </tr>
 </thead>
 );
}

export function TH({
 children,
 className,
 align = "left",
 width,
 onClick,
 sort,
}: {
 children?: React.ReactNode;
 className?: string;
 align?: "left" | "right" | "center";
 width?: string;
 onClick?: () => void;
 sort?: "asc" | "desc" | null;
}) {
 const style = cn(
 "px-4 py-2.5 text-xs font-medium text-neutral-500",
 align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
 onClick ? "cursor-pointer select-none hover:text-neutral-800" : "",
 className
 );
 return (
 <th scope="col" style={width ? { width } : undefined} className={style} onClick={onClick}>
 <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
 {children}
 {onClick ? (
 <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", sort ? "text-brand-600" : "text-neutral-400")} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
 <path d="M3 4.5h6" strokeLinecap="round" opacity={sort === "desc" ? 0 : 1} />
 <path d="M3 7.5h6" strokeLinecap="round" opacity={sort === "asc" ? 0 : 1} />
 <path d="M6 2.5l2 2H4l2-2z" fill="currentColor" stroke="none" opacity={sort === "asc" ? 1 : 0.4} />
 <path d="M6 9.5l2-2H4l2 2z" fill="currentColor" stroke="none" opacity={sort === "desc" ? 1 : 0.4} />
 </svg>
 ) : null}
 </span>
 </th>
 );
}

export function TD({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
 return (
 <td
 className={cn(
 "border-b border-neutral-100 px-4 py-3 align-middle text-neutral-700",
 align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
 className
 )}
 >
 {children}
 </td>
 );
}

export function TR({ children, className }: { children: React.ReactNode; className?: string }) {
 return <tr className={cn("group transition-colors hover:bg-neutral-50/70", className)}>{children}</tr>;
}
