/**
 * Normalise a user-supplied external URL.
 *
 * People often type a bare domain (e.g. `my-app.vercel.app`). Left as-is it
 * becomes a relative link on the current page, so we add `https://` and reject
 * anything that is not a real http(s) address.
 */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return candidate;
  } catch {
    return null;
  }
}
