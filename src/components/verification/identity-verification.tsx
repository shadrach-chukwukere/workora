"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/form";
import {
  Alert02Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  File01Icon,
  Image02Icon,
  SentIcon,
  ShieldCheckIcon,
  StampIcon,
} from "@/lib/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { safeNextPath, workspacePathForRole } from "@/lib/workspace";
import type { Role } from "@/lib/types";

type VerificationStatus = "pending" | "info_requested" | "approved" | "rejected";
type DocumentCategory = "identity_document" | "selfie" | "supporting_document";
type DocumentType = "passport" | "drivers-license" | "national-id" | "other";

interface UploadedDocument {
  category: DocumentCategory;
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface VerificationRequestItem {
  id: string;
  status: VerificationStatus;
  document_type: string;
  method: "manual" | "yoti";
  provider: string;
  yoti_state: string | null;
  submitted_at: string;
  decided_at: string | null;
  notes: string | null;
}

interface YotiSession {
  requestId: string;
  sessionId: string;
  iframeUrl: string;
  expiresIn: number;
}

interface IdentityVerificationCardProps {
  onVerified?: () => void;
  next?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: "national-id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "drivers-license", label: "Driver’s license" },
  { value: "other", label: "Other government ID" },
];

const STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Under admin review",
  info_requested: "More information needed",
  approved: "Approved",
  rejected: "Needs attention",
};

class ApiFailure extends Error {
  constructor(
    message: string,
    public code = "BAD_REQUEST",
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; message?: string; error?: { code?: string } }
    | null;
  if (!res.ok || !body?.success) {
    throw new ApiFailure(body?.message ?? "Request failed. Please try again.", body?.error?.code);
  }
  return body.data as T;
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: use a JPG, PNG, WebP or PDF file`);
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: files must be under 10 MB`);
  }
}

function statusTone(status: VerificationStatus): "warning" | "brand" | "success" | "danger" {
  if (status === "pending") return "warning";
  if (status === "info_requested") return "brand";
  if (status === "approved") return "success";
  return "danger";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function readStoredYotiSession(requestId: string): YotiSession | null {
  try {
    const raw = window.localStorage.getItem(`workora:yoti:${requestId}`);
    return raw ? (JSON.parse(raw) as YotiSession) : null;
  } catch {
    return null;
  }
}

function storeYotiSession(session: YotiSession): void {
  try {
    window.localStorage.setItem(`workora:yoti:${session.requestId}`, JSON.stringify(session));
  } catch {
    // Private browsing may block storage; the iframe still works for this page.
  }
}

export function IdentityVerificationCard({ onVerified, next }: IdentityVerificationCardProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [verified, setVerified] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [role, setRole] = useState<Role>("freelancer");
  const [yotiAvailable, setYotiAvailable] = useState(false);
  const [method, setMethod] = useState<"manual" | "yoti">("manual");
  const [documentType, setDocumentType] = useState<DocumentType>("national-id");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [yotiSession, setYotiSession] = useState<YotiSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [yotiNotice, setYotiNotice] = useState<string | null>(null);
  const notifiedVerified = useRef(false);
  const importedYoti = useRef(false);

  const destination = safeNextPath(next);

  const load = useCallback(async () => {
    try {
      // Read the feature flag first so a paused flow never touches Yoti or
      // private storage and cannot surface missing-key errors to the user.
      const me = await api<{
        user: { verified?: boolean; account_type?: Role; verificationRequired?: boolean };
      }>("/api/v1/users/me");
      const required = me.user.verificationRequired === true;
      setVerificationRequired(required);
      setVerified(me.user.verified === true);
      if (me.user.account_type) setRole(me.user.account_type);
      if (!required) {
        setRequests([]);
        setYotiAvailable(false);
        return;
      }

      const [status, list] = await Promise.all([
        api<{ available: boolean; verificationRequired?: boolean }>("/api/v1/verification-requests/yoti/status"),
        api<{ requests: VerificationRequestItem[] }>("/api/v1/verification-requests/me"),
      ]);
      setYotiAvailable(status.available);
      setRequests(list.requests);
      const latest = list.requests[0];
      setYotiSession(latest?.method === "yoti" && latest.status === "pending" ? readStoredYotiSession(latest.id) : null);
      if (me.user.verified === true && !notifiedVerified.current) {
        notifiedVerified.current = true;
        onVerified?.();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t load verification status");
    } finally {
      setLoading(false);
    }
  }, [onVerified]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = requests[0];
  const isInfoRequested = latest?.status === "info_requested";
  const isPending = latest?.status === "pending";
  const isRejected = latest?.status === "rejected";
  const needsSubmission = !latest || isRejected || isInfoRequested;

  useEffect(() => {
    if (loading || !verificationRequired || importedYoti.current) return;
    const params = new URLSearchParams(window.location.search);
    const yotiResult = params.get("yoti");
    if (yotiResult === "error") {
      setYotiNotice("Yoti could not complete the session. You can try again or use manual review.");
      importedYoti.current = true;
      return;
    }
    if (yotiResult !== "complete" || !latest || latest.method !== "yoti") return;

    const stored = readStoredYotiSession(latest.id);
    setYotiSession(stored);
    importedYoti.current = true;
    setBusy("yoti-complete");
    void api(`/api/v1/verification-requests/${latest.id}/yoti/complete`, { method: "POST" })
      .then(() => {
        toast.success("Yoti results imported — admin review is still required");
        return load();
      })
      .catch((error: unknown) => {
        setYotiNotice(error instanceof Error ? error.message : "Yoti results are not ready yet");
      })
      .finally(() => setBusy(null));
  }, [loading, latest, load]);

  async function upload(file: File, category: DocumentCategory): Promise<UploadedDocument> {
    validateFile(file);
    return api<{ document: UploadedDocument }>("/api/v1/verification-requests/uploads", {
      method: "POST",
      body: JSON.stringify({
        category,
        fileName: file.name,
        mimeType: file.type,
        contentBase64: await toBase64(file),
      }),
    }).then((body) => body.document);
  }

  async function submitManual(): Promise<void> {
    if (!identityFile || !selfieFile) {
      toast.error("Add an identity document and a clear selfie");
      return;
    }
    setBusy("manual");
    try {
      const documents: UploadedDocument[] = [];
      documents.push(await upload(identityFile, "identity_document"));
      documents.push(await upload(selfieFile, "selfie"));
      for (const file of supportingFiles) {
        documents.push(await upload(file, "supporting_document"));
      }

      if (isInfoRequested && latest) {
        await api(`/api/v1/verification-requests/${latest.id}/documents`, {
          method: "POST",
          body: JSON.stringify({ documents }),
        });
        toast.success("Documents resubmitted for review");
      } else {
        await api("/api/v1/verification-requests", {
          method: "POST",
          body: JSON.stringify({ method: "manual", documentType, documents, ...(destination ? { next: destination } : {}) }),
        });
        toast.success("Verification submitted for admin review");
      }
      setIdentityFile(null);
      setSelfieFile(null);
      setSupportingFiles([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t submit your documents");
    } finally {
      setBusy(null);
    }
  }

  async function startYoti(): Promise<void> {
    setBusy("yoti");
    try {
      const result = await api<{
        request: VerificationRequestItem;
        yoti: { sessionId: string; clientSessionToken: string; iframeUrl: string; expiresIn: number };
      }>("/api/v1/verification-requests", {
        method: "POST",
        body: JSON.stringify({
          method: "yoti",
          documentType: "yoti",
          ...(destination ? { next: destination } : {}),
        }),
      });
      const session: YotiSession = {
        requestId: result.request.id,
        sessionId: result.yoti.sessionId,
        iframeUrl: result.yoti.iframeUrl,
        expiresIn: result.yoti.expiresIn,
      };
      storeYotiSession(session);
      setYotiSession(session);
      setYotiNotice(null);
      await load();
      toast.success("Yoti session ready — complete it in the window below");
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "SERVICE_UNAVAILABLE") {
        setMethod("manual");
        toast.error("Yoti isn’t configured yet. Use the manual review option instead.");
      } else {
        toast.error(error instanceof Error ? error.message : "Couldn’t start Yoti");
      }
    } finally {
      setBusy(null);
    }
  }

  async function importYotiResults(): Promise<void> {
    if (!yotiSession) return;
    setBusy("yoti-complete");
    try {
      await api(`/api/v1/verification-requests/${yotiSession.requestId}/yoti/complete`, { method: "POST" });
      toast.success("Yoti results imported — an admin will make the final decision");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yoti results aren’t ready yet");
    } finally {
      setBusy(null);
    }
  }

  function continueAfterVerification() {
    router.push(destination ?? workspacePathForRole(role));
    router.refresh();
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm" aria-busy="true">
        <p className="text-sm text-neutral-600">Loading verification status…</p>
      </section>
    );
  }

  if (!verificationRequired) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm" id="identity-verification">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
            <HugeiconsIcon icon={ShieldCheckIcon} size={24} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Identity verification is paused</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
              Verification is temporarily turned off while we finish setting up our identity provider. You can use the
              marketplace normally — no documents or action are needed right now.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (verified) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-emerald-950">Identity verified</h2>
              <Badge tone="success">Verified</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-emerald-900">
              An admin approved your identity documents. You can now post projects, send proposals and use the rest of
              the marketplace.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" size="md" onClick={continueAfterVerification}>
                {destination ? "Continue" : "Go to my workspace"}
                <HugeiconsIcon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} />
              </Button>
              {!destination ? (
                <Button type="button" size="md" variant="secondary" href="/freelancer/settings">
                  Manage verification
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm" id="identity-verification">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ShieldCheckIcon} size={20} strokeWidth={1.8} className="text-brand-700" />
            <h2 className="text-lg font-semibold text-neutral-900">Verify your identity</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Workora reviews every photo and document by hand before marking an account as verified. Use Yoti where
            available, or upload a government ID and selfie for manual review.
          </p>
        </div>
        {latest ? <Badge tone={statusTone(latest.status)}>{STATUS_LABELS[latest.status]}</Badge> : null}
      </div>

      {yotiNotice ? (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <p>{yotiNotice}</p>
        </div>
      ) : null}

      {isPending ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <HugeiconsIcon icon={Clock01Icon} size={20} strokeWidth={1.8} className="mt-0.5 text-amber-700" />
            <div>
              <p className="font-medium text-amber-950">Your submission is with our review team</p>
              <p className="mt-1 text-sm text-amber-900">
                Submitted {formatDate(latest!.submitted_at)}. We’ll email you when a decision is made. No action is
                needed right now.
              </p>
            </div>
          </div>

          {latest?.method === "yoti" ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-neutral-900">Yoti session</p>
              {yotiSession ? (
                <>
                  <iframe
                    title="Yoti identity verification"
                    src={yotiSession.iframeUrl}
                    className="mt-3 h-[540px] w-full rounded-xl border border-neutral-200 bg-white"
                    allow="camera; microphone"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button type="button" size="md" variant="secondary" loading={busy === "yoti-complete"} onClick={() => void importYotiResults()}>
                      I’ve finished with Yoti — import results
                    </Button>
                    <span className="text-xs text-neutral-500">Yoti results are imported for review, never auto-approved.</span>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">
                  Session <span className="font-mono text-xs">{latest.yoti_state ?? "active"}</span>. If you closed the
                  Yoti window, refresh this page to restore it, or wait for the review team.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {isInfoRequested && latest ? (
        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
          <p className="font-medium">Our reviewer asked for more information</p>
          <p className="mt-1 whitespace-pre-wrap text-sky-900">{latest.notes ?? "Please upload a clearer identity document and selfie."}</p>
        </div>
      ) : null}

      {isRejected && latest ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <p className="font-medium">This submission was not approved</p>
          <p className="mt-1 whitespace-pre-wrap text-rose-900">{latest.notes ?? "Please submit new documents."}</p>
          <p className="mt-2 text-rose-800">You can submit a fresh request below with clearer photos.</p>
        </div>
      ) : null}

      {needsSubmission ? (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Verification method">
            <Button
              type="button"
              size="sm"
              variant={method === "manual" ? "primary" : "secondary"}
              onClick={() => setMethod("manual")}
            >
              Manual review
            </Button>
            <Button
              type="button"
              size="sm"
              variant={method === "yoti" ? "primary" : "secondary"}
              disabled={!yotiAvailable}
              onClick={() => setMethod("yoti")}
              title={yotiAvailable ? "Use Yoti identity verification" : "Yoti is not configured yet"}
            >
              Use Yoti
            </Button>
          </div>

          {method === "yoti" && yotiAvailable ? (
            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-sm text-neutral-700">
                Yoti checks your identity document and face in a secure window. Our team still reviews the result before
                approval.
              </p>
              <div className="mt-4">
                <Button type="button" size="md" loading={busy === "yoti"} onClick={() => void startYoti()}>
                  Start Yoti verification
                  <HugeiconsIcon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} />
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitManual();
              }}
            >
              <Field label="Document type" required>
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-500"
                >
                  {DOCUMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Identity document" required hint="JPG, PNG, WebP or PDF · up to 10 MB">
                  <label
                    className={cn(
                      "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-600 hover:border-brand-400",
                      identityFile && "border-emerald-300 bg-emerald-50 text-emerald-800",
                    )}
                  >
                    <HugeiconsIcon icon={File01Icon} size={22} strokeWidth={1.7} />
                    <span className="font-medium">{identityFile ? identityFile.name : "Choose a photo or scan"}</span>
                    <span className="text-xs text-neutral-500">All four corners visible</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept={ALLOWED_TYPES.join(",")}
                      onChange={(event) => setIdentityFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </Field>

                <Field label="Selfie" required hint="Face the camera in good light">
                  <label
                    className={cn(
                      "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-600 hover:border-brand-400",
                      selfieFile && "border-emerald-300 bg-emerald-50 text-emerald-800",
                    )}
                  >
                    <HugeiconsIcon icon={Image02Icon} size={22} strokeWidth={1.7} />
                    <span className="font-medium">{selfieFile ? selfieFile.name : "Choose a clear selfie"}</span>
                    <span className="text-xs text-neutral-500">No filters or hats</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </Field>
              </div>

              <Field label="Supporting document (optional)" hint="Up to three extra files, e.g. a second ID or proof of address">
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-600 hover:border-brand-400">
                  <HugeiconsIcon icon={StampIcon} size={22} strokeWidth={1.7} />
                  <span className="font-medium">
                    {supportingFiles.length ? `${supportingFiles.length} file${supportingFiles.length === 1 ? "" : "s"} selected` : "Add supporting files"}
                  </span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={(event) => setSupportingFiles(Array.from(event.target.files ?? []).slice(0, 3))}
                  />
                </label>
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                <p className="max-w-md text-xs text-neutral-500">
                  Files are stored privately and shown only to authorized reviewers. Verification is required before
                  posting projects or sending proposals.
                </p>
                <Button type="submit" size="md" loading={busy === "manual"}>
                  <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.8} />
                  {isInfoRequested ? "Resend for review" : "Submit for review"}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
