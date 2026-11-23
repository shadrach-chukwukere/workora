import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Server-side upload handler for Vercel Blob.
 * The file goes through the Next.js server first, then to Vercel Blob.
 * Returns the public blob URL so the client can store it in the DB and
 * render it on the site via Next.js <Image>.
 *
 * Limits: 4.5 MB per request (Vercel serverless limit). For larger files,
 * use client-side direct uploads instead.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const folder = searchParams.get("folder") || "uploads";

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!ALLOWED_TYPES.some((t) => contentType.includes(t))) {
      return NextResponse.json(
        { error: "Only JPEG, PNG and WebP images are allowed" },
        { status: 400 },
      );
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 },
      );
    }

    // Sanitize filename and add a unique suffix so uploads don't collide
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${folder}/${Date.now()}-${safeName}`;

    const blob = await put(uniqueName, body as unknown as Blob, {
      access: "public",
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
