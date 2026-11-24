import yoti from "yoti";
import { env } from "../config/env.js";
import { AppError } from "../plugins/error-handler.js";

/**
 * Yoti IDV integration. This module is intentionally backend-only: the browser
 * receives an iframe URL and session token, never the SDK or the private key.
 */
const YOTI_IDV_IFRAME_URL = "https://api.yoti.com/idverify/v1/web/index.html";

export type YotiMediaCategory = "identity_document" | "selfie" | "supporting_document";

export interface YotiSessionInfo {
  sessionId: string;
  clientSessionToken: string;
  iframeUrl: string;
  expiresIn: number;
}

export interface YotiVerificationSummary {
  state: string;
  checks: Array<{ type: string; state: string; recommendation: string | null }>;
  media: Array<{ id: string; category: YotiMediaCategory; type: string }>;
}

export function isYotiConfigured(): boolean {
  return Boolean(env.YOTI_SDK_ID.trim() && normalizePem(env.YOTI_API_KEY));
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function getClient(): yoti.IDVClient {
  const sdkId = env.YOTI_SDK_ID.trim();
  const pem = normalizePem(env.YOTI_API_KEY);
  if (!sdkId || !pem) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Yoti identity verification is not configured");
  }
  return new yoti.IDVClient(sdkId, pem);
}

/** Create an IDV session that captures an ID document and a face image. */
export async function createYotiSession(userId: string): Promise<YotiSessionInfo> {
  const client = getClient();
  const spec = new yoti.SessionSpecificationBuilder()
    .withClientSessionTokenTtl(600)
    .withResourcesTtl(90000)
    .withUserTrackingId(userId)
    .withRequestedCheck(
      new yoti.RequestedDocumentAuthenticityCheckBuilder()
        .withManualCheckFallback()
        .build(),
    )
    .withRequestedCheck(new yoti.RequestedThirdPartyIdentityCheckBuilder().build())
    .withRequestedCheck(new yoti.RequestedFaceComparisonCheckBuilder().withManualCheckNever().build())
    .withRequestedTask(
      new yoti.RequestedTextExtractionTaskBuilder()
        .withManualCheckFallback()
        .withChipDataDesired()
        .build(),
    )
    .withSdkConfig(
      new yoti.SdkConfigBuilder()
        .withAllowsCameraAndUpload()
        .withPrimaryColour("#0f766e")
        .withSecondaryColour("#FFFFFF")
        .withFontColour("#FFFFFF")
        .withLocale("en")
        .withSuccessUrl(`${env.WEB_APP_URL}/onboarding/verify?yoti=complete`)
        .withErrorUrl(`${env.WEB_APP_URL}/onboarding/verify?yoti=error`)
        .withAllowHandoff(true)
        .build(),
    )
    .withRequiredDocument(new yoti.RequiredIdDocumentBuilder().build())
    .build();

  const session = await client.createSession(spec);
  const sessionId = session.getSessionId();
  const clientSessionToken = session.getClientSessionToken();
  const url = new URL(YOTI_IDV_IFRAME_URL);
  url.searchParams.set("sessionID", sessionId);
  url.searchParams.set("sessionToken", clientSessionToken);

  return {
    sessionId,
    clientSessionToken,
    iframeUrl: url.toString(),
    expiresIn: session.getClientSessionTokenTtl(),
  };
}

type RawResource = Record<string, unknown>;

function asArray(value: unknown): RawResource[] {
  return Array.isArray(value) ? value.filter((item): item is RawResource => Boolean(item) && typeof item === "object") : [];
}

function addMedia(
  target: YotiVerificationSummary["media"],
  seen: Set<string>,
  media: unknown,
  category: YotiMediaCategory,
) {
  if (!media || typeof media !== "object") return;
  const id = (media as RawResource).id;
  if (typeof id !== "string" || !id || seen.has(id)) return;
  seen.add(id);
  target.push({ id, category, type: typeof (media as RawResource).type === "string" ? String((media as RawResource).type) : category });
}

/** Collect all media Yoti produced so an admin can review every image/document. */
function extractMedia(raw: RawResource): YotiVerificationSummary["media"] {
  const media: YotiVerificationSummary["media"] = [];
  const seen = new Set<string>();
  const resources = (raw.resources ?? {}) as RawResource;

  for (const document of asArray(resources.id_documents)) {
    for (const page of asArray(document.pages)) addMedia(media, seen, page.media, "identity_document");
    addMedia(media, seen, (document.document_id_photo as RawResource | undefined)?.media, "identity_document");
    for (const task of asArray(document.tasks)) {
      for (const generated of asArray(task.generated_media)) addMedia(media, seen, generated, "identity_document");
    }
  }

  for (const document of asArray(resources.supplementary_documents)) {
    for (const page of asArray(document.pages)) addMedia(media, seen, page.media, "supporting_document");
  }

  for (const face of asArray(resources.face_capture)) {
    addMedia(media, seen, (face.image as RawResource | undefined)?.media, "selfie");
  }

  for (const liveness of asArray(resources.liveness_capture)) {
    for (const frame of asArray(liveness.frames)) addMedia(media, seen, frame.media, "selfie");
  }

  for (const check of asArray(raw.checks)) {
    for (const generated of asArray(check.generated_media)) addMedia(media, seen, generated, "supporting_document");
  }

  return media;
}

/** Fetch a completed session and summarize checks plus reviewable media. */
export async function fetchYotiVerification(sessionId: string): Promise<YotiVerificationSummary> {
  const session = await getClient().getSession(sessionId);
  const checks = session.getChecks().map((check) => {
    let recommendation: string | null = null;
    try {
      recommendation = check.getReport()?.getRecommendation()?.getValue() ?? null;
    } catch {
      // Some checks do not have a report until a manual review completes.
    }
    return {
      type: check.getType(),
      state: check.getState(),
      recommendation,
    };
  });

  return {
    state: session.getState(),
    checks,
    media: extractMedia(session.getRawResponse() as RawResource),
  };
}

/** Stream one Yoti media item through the backend SDK. */
export async function fetchYotiMedia(
  sessionId: string,
  mediaId: string,
): Promise<{ body: Buffer; mimeType: string } | null> {
  const media = await getClient().getMediaContent(sessionId, mediaId);
  if (!media) return null;
  return { body: Buffer.from(media.getContent()), mimeType: media.getMimeType() };
}
