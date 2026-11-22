import { HeadObjectCommand, S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export async function assertVerificationUpload(userId: string, key: string): Promise<void> {
  if (!s3 || !env.S3_BUCKET) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Private document storage is not configured");
  }
  if (!key.startsWith(`verification/${userId}/`) || key.includes("..") || key.includes("\\")) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document must use your private upload key");
  }
  const uploaded = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  if (!uploaded.ContentLength || uploaded.ContentLength > MAX_BYTES.verification) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document is empty or exceeds the 10 MB limit");
  }
  if (!uploaded.ContentType || !ALLOWED_MIME.verification.includes(uploaded.ContentType)) {
    throw new AppError(400, "VALIDATION_ERROR", "Verification document must be a JPEG, PNG, WebP or PDF");
  }
}
