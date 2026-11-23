"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { StampIcon, AlertTriangleIcon, CheckCircleIcon, PlusSignIcon, SendIcon } from "@/lib/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface VerificationRequestItem {
  id: string;
  status: "pending" | "info_requested" | "approved" | "rejected";
  document_type: string;
  submitted_at: string;
  notes: string | null;
  document_name: string | null;
}

interface IdentityVerificationCardProps {
  onVerified?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const DOCUMENT_TYPES = [
  { value: "national-id", label: "National ID", icon: "ID" },
  { value: "passport", label: "Passport", icon: "PP" },
  { value: "drivers-license", label: "Driver's License", icon: "DL" },
  { value: "other", label: "Other Government ID", icon: "ID" },
] as const;

export function IdentityVerificationCard({ onVerified }: IdentityVerificationCardProps = {}) {
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [documentType, setDocumentType] = useState<"national-id" | "passport" | "drivers-license" | "other">("national-id");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadRequests() {
    try {
      const res = await fetch("/api/v1/verification-requests/me", { credentials: "include", cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setLoading(false);
        return;
      }
      const data = await res.json() as { success?: boolean; data?: { requests: VerificationRequestItem[] } };
      if (data.success && data.data) {
        setRequests(data.data.requests);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load verification status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const latest = requests[0];
  const canSubmit = !latest || latest.status === "rejected";
  const canResubmit = latest?.status === "info_requested";
  const isVerified = latest?.status === "approved";

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError("Only JPEG, PNG, WebP or PDF documents are allowed.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum 10 MB.");
      return;
    }
    setFile(selectedFile);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  async function submitDocument() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const presignResponse = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/octet-stream" },
        body: file,
      });
      if (!presignResponse.ok) {
        const err = await presignResponse.json().catch(() => ({}));
        throw new Error(err.error || "Document upload failed. Try again.");
      }
      const upload = (await presignResponse.json()) as { url: string; pathname: string; size: number; contentType: string };

      const path = canResubmit
        ? `/api/v1/verification-requests/${encodeURIComponent(latest!.id)}/document`
        : "/api/v1/verification-requests";
      const requestResponse = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(canSubmit ? { documentType } : {}),
          documentKey: upload.pathname,
          documentName: file.name,
          documentUrl: upload.url,
        }),
      });
      if (!requestResponse.ok) {
        const err = await requestResponse.json().catch(() => ({}));
        throw new Error(err.message || "Could not submit verification request.");
      }

      setFile(null);
      setError(null);
      toast.success(canResubmit ? "Document resubmitted for review" : "Identity verification submitted", {
        description: "Our team will review your document privately.",
      });
      await loadRequests();
      if (isVerified) onVerified?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not submit your document";
      setError(message);
      toast.error("Verification submission failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <section className="mt-6 max-w-3xl rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Identity verification</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Upload an identity document for private admin review. Documents are
            stored privately and are not shown on your public profile.
          </p>
        </div>
        {isVerified ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            <span className="size-3 shrink-0"><CheckCircleIcon /></span>
            Verified
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Checking verification status…</p>
      ) : latest && !canSubmit && !canResubmit ? (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-neutral-800 capitalize">
            {latest.status.replace("_", " ")}
          </p>
          {latest.notes ? (
            <p className="mt-1 text-sm text-neutral-600">{latest.notes}</p>
          ) : null}
          {latest.status === "approved" ? (
            <p className="mt-1 text-xs text-emerald-700">Your identity is verified.</p>
          ) : null}
        </div>
      ) : null}

      {!loading && (canSubmit || canResubmit) && (
        <div className="mt-6 space-y-4">
          {canSubmit ? (
            <Field label="Document type" required>
              <select
                id="verification-document-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {/* Modern drag-and-drop upload zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
              dragActive
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : file
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
            )}
          >
            <input
              ref={fileInputRef}
              id="verification-document-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <label
              htmlFor="verification-document-file"
              className="cursor-pointer flex flex-col items-center gap-3 select-none"
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              <div
                className={cn(
                  "inline-flex size-16 shrink-0 items-center justify-center rounded-full transition-colors",
                  dragActive
                    ? "bg-brand-100 text-brand-600"
                    : file
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200",
                )}
              >
                <HugeiconsIcon icon={SendIcon} size={22} strokeWidth={2} />
              </div>
              <div>
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-neutral-500">
                      {Math.round(file.size / 1024)} KB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-neutral-900">
                      Drag & drop your document here
                    </p>
                    <p className="text-xs text-neutral-500">
                      or click to browse
                    </p>
                    <p className="mt-1 text-[10px] text-neutral-400 uppercase tracking-wider">
                      JPEG, PNG, WebP or PDF · Max 10 MB
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon size={16} className="mt-0.5 text-rose-600" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end sm:justify-start">
            <Button
              size="md"
              disabled={!file || busy}
              loading={busy}
              onClick={() => void submitDocument()}
            >
              {busy ? "Uploading…" : canResubmit ? "Resubmit document" : "Submit for verification"}
            </Button>
          </div>
        </div>
      )}

      {!loading && error && !canSubmit && !canResubmit ? (
        <p className="mt-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
