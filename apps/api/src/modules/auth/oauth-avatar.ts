import { put } from "@vercel/blob";
import { env } from "../../config/env.js";

/**
 * Mirrors a social provider's profile image into our own Vercel Blob store so
 * that `users.image` always points at a URL we control. Provider URLs (Google's
 * signed lh3 URLs, GitHub avatars) can expire or change, which would leave
 * broken avatars later on.
 *
 * Called from Better Auth's `user.create.before` hook, so the blob URL is what
 * actually gets persisted in the DB — sessions and public profiles then
 * resolve with our own URL automatically.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const KNOWN_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

function extensionFromUrl(url: URL): string | null {
  try {
    const lastSegment = url.pathname.split("/").pop() ?? "";
    const ext = lastSegment.includes(".") ? lastSegment.split(".").pop()!.toLowerCase() : "";
    if (!KNOWN_EXTENSIONS.has(ext)) return null;
    return ext === "jpeg" ? "jpg" : ext;
  } catch {
    return null;
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export interface MirrorAvatarInput {
  id?: string | null;
  email?: string | null;
  imageUrl: string | null | undefined;
}

/**
 * Downloads the provider image and stores it in Vercel Blob.
 * Returns the public blob URL, or `null` when mirroring is unavailable or
 * fails — in that case the caller keeps the original provider URL as fallback.
 */
export async function mirrorProviderAvatarToBlob(input: MirrorAvatarInput): Promise<string | null> {
  const token = env.BLOB_READ_WRITE_TOKEN.trim();
  if (!token || !input.imageUrl) return null;

  let source: URL;
  try {
    source = new URL(input.imageUrl);
  } catch {
    return null;
  }

  // Only allow public HTTP(S) URLs — never data: or internal URLs.
  if (source.protocol !== "https:" && source.protocol !== "http:") return null;

  try {
    const response = await fetch(source, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Workora-Avatar-Sync/1.0" },
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim()
      .toLowerCase() ?? "";
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? extensionFromUrl(source);
    if (!extension) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) return null;

    // Prefer the user id; fall back to a sanitised email local-part if an
    // adapter hasn't generated one yet at the point this hook runs.
    const ownerKey =
      safeSegment(input.id ?? "") ||
      safeSegment((input.email ?? "").split("@")[0] ?? "") ||
      "unknown";

    const blob = await put(
      `avatars/${ownerKey}/avatar.${extension}`,
      Buffer.from(bytes),
      {
        access: "public",
        contentType,
        addRandomSuffix: false,
        token,
      },
    );

    return blob.url;
  } catch (cause) {
    console.warn("[oauth-avatar] could not mirror provider avatar", {
      email: input.email,
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}
