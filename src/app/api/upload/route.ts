import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApiBase } from "@/lib/api-base";

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB for avatars/covers
const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for identity docs
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Fixed storage folder — callers cannot choose where files land.
const FIXED_FOLDER = "workora-uploads";

// Simple in-memory rate limit: 10 uploads per minute per IP.
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = uploadRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadRateLimit.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

/** Magic-byte signatures for allowed file types. */
const MAGIC_BYTES: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  "image/webp": Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
  "application/pdf": Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
};

function detectMimeType(bytes: Buffer): string | null {
  for (const [mime, signature] of Object.entries(MAGIC_BYTES)) {
    if (bytes.length >= signature.length && bytes.subarray(0, signature.length).equals(signature)) {
      return mime;
    }
  }
  return null;
}

/** Verify the caller has an active Better Auth session. */
async function requireSession(request: Request): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookie) {
    return { ok: false, status: 401, body: { error: "Authentication required" } };
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip)) {
    return { ok: false, status: 429, body: { error: "Too many uploads. Try again later." } };
  }

  try {
    const res = await fetch(`${serverApiBase}/api/auth/get-session`, {
      headers: { cookie, origin: new URL(request.url).origin },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, status: 401, body: { error: "Authentication required" } };
    }
    const session = (await res.json()) as { user?: { id: string } } | null;
    if (!session?.user) {
      return { ok: false, status: 401, body: { error: "Authentication required" } };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 401, body: { error: "Authentication required" } };
  }
}

/**
 * Server-side upload handler for Vercel Blob.
 * Requires an authenticated session. The folder is fixed server-side.
 * File type is validated by both Content-Type header and real file bytes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireSession(request);
  if (!session.ok) {
    return NextResponse.json(session.body, { status: session.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const access = (searchParams.get("access") ?? "public") as "public" | "private";
    const scope = searchParams.get("scope") ?? "image";

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const maxSize = scope === "document" ? MAX_DOCUMENT_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
    const allowedTypes = scope === "document" ? ALLOWED_DOCUMENT_TYPES : ALLOWED_IMAGE_TYPES;

    // Exact match on Content-Type — no `.includes()` on a caller-controlled header.
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        {
          error: scope === "document"
            ? "Only JPEG, PNG, WebP or PDF documents are allowed"
            : "Only JPEG, PNG and WebP images are allowed",
        },
        { status: 400 },
      );
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max ${maxSize / 1024 / 1024} MB` },
        { status: 413 },
      );
    }

    // Verify the file's real bytes match the declared type (blocks mime spoofing).
    const detected = detectMimeType(Buffer.from(body));
    if (!detected || !allowedTypes.includes(detected)) {
      return NextResponse.json(
        { error: "File contents do not match the declared type" },
        { status: 400 },
      );
    }

    // Sanitize filename and use a fixed folder — callers cannot choose the folder.
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${FIXED_FOLDER}/${Date.now()}-${safeName}`;

    const blob = await put(uniqueName, body as unknown as Blob, {
      access,
      contentType,
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      size: body.byteLength,
      contentType,
    });
  } catch (error) {
    console.error("Blob upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}