import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const SIZES = {
 xs: "size-6 text-[9px]",
 sm: "size-8 text-[11px]",
 md: "size-10 text-[13px]",
 lg: "size-12 text-sm",
 xl: "size-16 text-lg",
 "2xl": "size-20 text-xl",
 "3xl": "size-28 text-3xl",
} as const;

const FALLBACK_TONES = [
 "bg-neutral-200 text-neutral-700",
 "bg-brand-100 text-brand-800",
 "bg-emerald-100 text-emerald-800",
 "bg-amber-100 text-amber-800",
 "bg-rose-100 text-rose-700",
 "bg-sky-100 text-sky-800",
];

function toneFor(name: string): string {
 let hash = 0;
 for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
 return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

export function Avatar({
 src,
 name,
 size = "md",
 className,
 alt,
}: {
 src?: string | null;
 name: string;
 size?: keyof typeof SIZES;
 className?: string;
 alt?: string;
}) {
 return (
 <span
 className={cn(
 "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
 SIZES[size],
 toneFor(name),
 className
 )}
 >
 {src ? (
 <Image
 src={src}
 alt={alt ?? `${name}'s profile photo`}
 fill
 sizes="96px"
 className="size-full object-cover"
 />
 ) : (
 <span aria-hidden>{initials(name)}</span>
 )}
 </span>
 );
}
