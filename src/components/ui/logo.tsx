import Link from "next/link";
import { cn } from "@/lib/utils";

/** Workora mark: rounded brand square with a geometric W glyph. */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="28" height="28" rx={size >= 28 ? 8 : 6} fill="var(--color-brand-600)" />
      <path
        d="M6 9.5l3.4 9 3.5-7.2L14 17l1.1-5.7L18.6 18.5l3.4-9"
        stroke="white"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  href = "/",
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const markSize = size === "sm" ? 24 : size === "lg" ? 30 : 26;
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Workora home">
      <LogoMark size={markSize} />
      <span className={cn("font-semibold tracking-tight text-neutral-900", size === "sm" ? "text-[15px]" : "text-[17px]")}>Workora</span>
    </Link>
  );
}

/** Client monograms for the social-proof band: fictional companies, real marks. */
const MONO_COLORS = [
  { bg: "#f0f0fe", fg: "#4a41cf" },
  { bg: "#e4e3fd", fg: "#3e36a6" },
  { bg: "#efefef", fg: "#404040" },
  { bg: "#e8e8e8", fg: "#262626" },
  { bg: "#f0f0fe", fg: "#5a50e5" },
  { bg: "#dcdcdc", fg: "#171717" },
];

export function Monogram({ name, className, size = 22 }: { name: string; className?: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 33 + name.charCodeAt(i)) % 9973;
  const c = MONO_COLORS[hash % MONO_COLORS.length];
  const label = name
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex select-none items-center justify-center rounded-md font-semibold", className)}
      title={name}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.42 }}
    >
      {label}
    </span>
  );
}
