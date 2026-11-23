import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB for avatars/covers
const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for identity docs
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Server-side upload handler for Vercel Blob.
 * The file goes through the Next.js server first, then to Vercel Blob.
 * Returns the public blob URL so the client can store it in the DB and
 * render it on the site via Next.js <Image>.
 *
 * Query params:
 *   filename   - original file name (sanitized server-side)
 *   folder     - storage folder prefix (default "uploads")
 *   access     - "public" (default) or "private" (identity documents)
 *   scope      - "image" (5 MB) or "document" (10 MB, PDF allowed)
 *
 * Limits: 4.5 MB per request (Vercel serverless limit). For larger files,
 * use client-side direct uploads instead.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const folder = searchParams.get("folder") || "uploads";
    const access = (searchParams.get("access") ?? "public") as "public" | "private";
    const scope = searchParams.get("scope") ?? "image";

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const maxSize = scope === "document" ? MAX_DOCUMENT_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
    const allowedTypes = scope === "document" ? ALLOWED_DOCUMENT_TYPES : ALLOWED_IMAGE_TYPES;

    if (!allowedTypes.some((t) => contentType.includes(t))) {
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

    // Sanitize filename and add a unique suffix so uploads don't collide
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${folder}/${Date.now()}-${safeName}`;

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
