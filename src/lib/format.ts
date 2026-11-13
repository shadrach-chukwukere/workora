import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/** $4,250 · $62.50 (two decimals only when the value has them) */
export function formatMoney(value: number, opts?: { decimals?: boolean }): string {
 const hasCents = !Number.isInteger(value);
 return new Intl.NumberFormat("en-US", {
 style: "currency",
 currency: "USD",
 minimumFractionDigits: opts?.decimals || hasCents ? 2 : 0,
 maximumFractionDigits: opts?.decimals || hasCents ? 2 : 0,
 }).format(value);
}

/** 4,283 · 12,964 */
export function formatNumber(value: number): string {
 return new Intl.NumberFormat("en-US").format(value);
}

/** 4.2k · 12.9k - for dense stat contexts */
export function formatCompact(value: number): string {
 return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number): string {
 return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

/** "Mar 4, 2026" */
export function formatDate(iso: string): string {
 const d = parseISO(iso);
 return isValid(d) ? format(d, "MMM d, yyyy") : iso;
}

/** "Mar 4" for dense table columns */
export function formatDateShort(iso: string): string {
 const d = parseISO(iso);
 return isValid(d) ? format(d, "MMM d") : iso;
}

/** "3 days ago" - relative time for feeds */
export function formatRelative(iso: string): string {
 const d = parseISO(iso);
 if (!isValid(d)) return iso;
 return `${formatDistanceToNowStrict(d, { addSuffix: false })} ago`;
}

/** "Mar 4, 2026 · 14:20" for message timestamps */
export function formatDateTime(iso: string): string {
 const d = parseISO(iso);
 return isValid(d) ? format(d, "MMM d, yyyy · HH:mm") : iso;
}

/** "AM" → "Am" · "in_progress" → "In progress" */
export function labelize(value: string): string {
 return value
 .split(/[_\s-]+/)
 .filter(Boolean)
 .map((word) => (/^\d/.test(word) ? word : word[0].charAt(0).toUpperCase() + word.slice(1)))
 .join(" ");
}

/** "Amara Okafor" → "AO" */
export function initials(name: string): string {
 return name
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((part) => part[0]?.toUpperCase() ?? "")
 .join("");
}

export function pluralize(count: number, singular: string, plural?: string): string {
 return `${formatNumber(count)} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
