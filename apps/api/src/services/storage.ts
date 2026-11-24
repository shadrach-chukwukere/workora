import { HeadObjectCommand, S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { get, head, put } from "@vercel/blob";
import { env } from "../config/env.js";
import { AppError } from "../plugins/error-handler.js";
import crypto from "node:crypto";

const storageConfig = [
  env.S3_ENDPOINT,
  env.S3_BUCKET,
  env.S3_ACCESS_KEY_ID,
  env.S3_SECRET_ACCESS_KEY,
];
const storageConfigured = storageConfig.every(Boolean);
const storagePartiallyConfigured = storageConfig.some(Boolean) && !storageConfigured;

if (storagePartiallyConfigured) {
  throw new Error("S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY");
}

export const s3 = storageConfigured
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    })
  : null;

export type UploadScope = "verification" | "deliverable" | "portfolio" | "avatar" | "message";

const ALLOWED_MIME: Record<UploadScope, string[]> = {
  verification: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  deliverable:  ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip", "text/plain"],
  portfolio:    ["image/jpeg", "image/png", "image/webp"],
  avatar:       ["image/jpeg", "image/png", "image/webp"],
  message:      ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

const MAX_BYTES: Record<UploadScope, number> = {
  verification: 10 * 1024 * 1024,  // 10 MB
  deliverable:  50 * 1024 * 1024,  // 50 MB
  portfolio:    5  * 1024 * 1024,  //  5 MB
  avatar:       2  * 1024 * 1024,  //  2 MB
  message:      10 * 1024 * 1024,  // 10 MB
};

export interface PresignResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

/** Generate a presigned PUT URL the browser uploads directly to. Falls back to null when S3 is not configured. */
export async function presignUpload(
  scope: UploadScope,
  userId: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PresignResult | null> {
  if (!s3 || !env.S3_BUCKET) return null;

  const allowed = ALLOWED_MIME[scope];
  if (!allowed.includes(mimeType)) {
    throw new AppError(400, "VALIDATION_ERROR", `MIME type ${mimeType} is not allowed for scope ${scope}`);
  }
  if (sizeBytes > MAX_BYTES[scope]) {
    throw new AppError(400, "VALIDATION_ERROR", `File size exceeds the ${MAX_BYTES[scope]} byte limit for scope ${scope}`);
  }

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const key = `${scope}/${userId}/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });

  const expiresIn = 300; // 5 minutes
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  const fileUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;

  return { uploadUrl, fileUrl: scope === "verification" ? "" : fileUrl, key, expiresIn };
}

export async function presignDownload(key: string): Promise<{ downloadUrl: string; expiresIn: number } | null> {
  if (!s3 || !env.S3_BUCKET) return null;

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ResponseContentType: "application/octet-stream",
    ResponseContentDisposition: 'attachment; filename="verification-document"',
  });
  const expiresIn = 300;
  const downloadUrl = await getSignedUrl(s3, command, { expiresIn });
  return { downloadUrl, expiresIn };
}

export type VerificationDocumentCategory = "identity_document" | "selfie" | "supporting_document";

const CATEGORY_MIME: Record<VerificationDocumentCategory, string[]> = {
  identity_document: ALLOWED_MIME.verification,
  selfie: ["image/jpeg", "image/png", "image/webp"],
  supporting_document: ALLOWED_MIME.verification,
};

function assertAllowedDocument(category: VerificationDocumentCategory, mimeType: string, sizeBytes: number) {
  if (!CATEGORY_MIME[category].includes(mimeType)) {
    throw new AppError(400, "VALIDATION_ERROR", `A ${category.replaceAll("_", " ")} must be a JPEG, PNG, WebP or PDF where supported`);
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_BYTES.verification) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document is empty or exceeds the 10 MB limit");
  }
}

function isBlobUrl(key: string): boolean {
  if (!/^https?:\/\//i.test(key)) return false;
  try {
    return new URL(key).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function assertOwnVerificationPath(userId: string, key: string) {
  const path = isBlobUrl(key) ? new URL(key).pathname.replace(/^\//, "") : key;
  if (!path.startsWith(`verification/${userId}/`) || path.includes("..") || path.includes("\\")) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document must use your private upload key");
  }
}

/** Store a private verification file. Prefer Vercel Blob; S3 remains supported. */
export async function storeVerificationUpload(
  userId: string,
  category: VerificationDocumentCategory,
  fileName: string,
  mimeType: string,
  body: Buffer,
): Promise<{ key: string; pathname: string; mimeType: string; sizeBytes: number; storage: "blob" | "s3" }> {
  assertAllowedDocument(category, mimeType, body.byteLength);

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "document";
  const pathname = `verification/${userId}/${category}/${crypto.randomUUID()}-${safeName}`;

  if (env.BLOB_READ_WRITE_TOKEN.trim()) {
    const blob = await put(pathname, new Uint8Array(body), {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN.trim(),
    });
    return { key: blob.url, pathname: blob.pathname, mimeType, sizeBytes: body.byteLength, storage: "blob" };
  }

  if (s3 && env.S3_BUCKET) {
    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: pathname,
      Body: body,
      ContentType: mimeType,
    }));
    return { key: pathname, pathname, mimeType, sizeBytes: body.byteLength, storage: "s3" };
  }

  throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
}

/** Verify that a submitted key belongs to the user and exists in private storage. */
export async function assertVerificationUpload(userId: string, key: string): Promise<void> {
  assertOwnVerificationPath(userId, key);

  if (isBlobUrl(key)) {
    if (!env.BLOB_READ_WRITE_TOKEN.trim()) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
    }
    const metadata = await head(key, { token: env.BLOB_READ_WRITE_TOKEN.trim() });
    assertOwnVerificationPath(userId, metadata.pathname);
    if (!metadata.size || metadata.size > MAX_BYTES.verification) {
      throw new AppError(400, "VALIDATION_ERROR", "Verification document is empty or exceeds the 10 MB limit");
    }
    if (!metadata.contentType || !ALLOWED_MIME.verification.includes(metadata.contentType)) {
      throw new AppError(400, "VALIDATION_ERROR", "Verification document must be a JPEG, PNG, WebP or PDF");
    }
    return;
  }

  if (!s3 || !env.S3_BUCKET) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
  }
  const uploaded = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  assertOwnVerificationPath(userId, key);
  if (!uploaded.ContentLength || uploaded.ContentLength > MAX_BYTES.verification) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document is empty or exceeds the 10 MB limit");
  }
  if (!uploaded.ContentType || !ALLOWED_MIME.verification.includes(uploaded.ContentType)) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document must be a JPEG, PNG, WebP or PDF");
  }
}

/** Read a private verification file so the admin API can stream it back. */
export async function readPrivateDocument(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (isBlobUrl(key)) {
    if (!env.BLOB_READ_WRITE_TOKEN.trim()) return null;
    const result = await get(key, { access: "private", token: env.BLOB_READ_WRITE_TOKEN.trim() });
    if (!result || result.statusCode !== 200) return null;
    const body = Buffer.from(await new Response(result.stream).arrayBuffer());
    return { body, contentType: result.blob.contentType || "application/octet-stream" };
  }

  if (!s3 || !env.S3_BUCKET) return null;
  const object = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  if (!object.Body) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return {
    body: Buffer.concat(chunks),
    contentType: object.ContentType || "application/octet-stream",
  };
}
