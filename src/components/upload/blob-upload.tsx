"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface UseBlobUploadProps {
  onUploaded: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function useBlobUpload({
  onUploaded,
  accept = "image/jpeg, image/png, image/webp",
  maxSizeMB = 5,
  disabled = false,
}: UseBlobUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (disabled) return;
      setError(null);
      setUploading(true);

      try {
        const maxBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
          throw new Error(
            `File too large. Max ${maxSizeMB} MB (${Math.round(
              file.size / 1024 / 1024,
            )} MB provided).`,
          );
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            body: file,
          },
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Upload failed (${res.status})`);
        }

        const data = (await res.json()) as { url: string };
        onUploaded(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [disabled, maxSizeMB, onUploaded],
  );

  return { uploading, error, upload };
}

interface BlobUploadProps extends UseBlobUploadProps {
  children: ({ upload, uploading, error }: { upload: (file: File) => Promise<void>; uploading: boolean; error: string | null }) => React.ReactNode;
}

export function BlobUpload({ children, ...props }: BlobUploadProps) {
  const uploadHook = useBlobUpload(props);
  return children(uploadHook);
}
