"use client";

import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Pen01Icon } from "@/lib/icons";
import { useBlobUpload } from "@/components/upload/blob-upload";
import { cn } from "@/lib/utils";

interface ProfileMediaPickerProps {
  id: string;
  variant: "avatar" | "banner";
  value: string | null;
  onChange: (url: string) => void;
  name?: string;
  className?: string;
}

/**
 * Image-only media picker. No URL field is exposed to the user: the pencil
 * button in the top-right corner opens the file picker, uploads straight to
 * Vercel Blob and shows a spinner while the upload is in flight so a second
 * upload cannot be started.
 *
 * Before an image exists, a colourful placeholder with text is shown. Once an
 * image is uploaded the real picture replaces it completely.
 */
export function ProfileMediaPicker({
  id,
  variant,
  value,
  onChange,
  name,
  className,
}: ProfileMediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useBlobUpload({
    accept: "image/jpeg, image/png, image/webp",
    maxSizeMB: 5,
    onUploaded: onChange,
  });

  const isBanner = variant === "banner";
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm",
          isBanner ? "h-36 sm:h-44" : "size-24",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : isBanner ? (
          <div className="relative flex size-full flex-col items-center justify-center bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-500 px-4 text-center">
            <span className="pointer-events-none absolute -right-8 -top-12 size-40 rounded-full bg-white/15" />
            <span className="pointer-events-none absolute -bottom-16 left-10 size-44 rounded-full bg-white/10" />
            <span className="relative text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Your banner
            </span>
            <span className="relative mt-1 text-[11px] text-white/75">
              Click the pencil to add a cover photo
            </span>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700 text-white">
            <span className="text-xl font-bold tracking-wide">
              {initials || "YOU"}
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/75">
              Photo
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file).catch(() => undefined);
          }}
        />

        <button
          type="button"
          disabled={uploading}
          aria-label={uploading ? "Uploading image" : "Change image"}
          title={uploading ? "Uploading…" : "Change image"}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full border border-white/70 bg-white/95 text-brand-700 shadow-md backdrop-blur transition",
            uploading
              ? "cursor-wait opacity-80"
              : "hover:bg-white hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          )}
        >
          {uploading ? (
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <HugeiconsIcon icon={Pen01Icon} size={15} strokeWidth={2} />
          )}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
