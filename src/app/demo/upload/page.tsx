"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BlobUpload } from "@/components/upload/blob-upload";
import { Avatar } from "@/components/ui/avatar";

export default function DemoUploadPage() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  return (
    <div className="container-page py-12 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Upload to Vercel Blob
        </h1>
        <p className="mt-2 text-neutral-500">
          Upload a file, receive a public URL you can store in your database
          and render on your site.
        </p>
      </div>

      {/* Avatar upload demo */}
      <section className="border border-neutral-200 rounded-xl p-6 bg-neutral-50/40">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-4">
          Avatar upload
        </h2>
        <BlobUpload
          accept="image/jpeg, image/png, image/webp"
          maxSizeMB={5}
          onUploaded={(url) => {
            setAvatarUrl(url);
            setUploadedUrls((prev) => [...prev, url]);
          }}
        >
          {({ upload, uploading, error }) => (
            <div className="flex flex-col items-center gap-4">
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <Button
                  disabled={uploading}
                  className="w-full md:w-auto"
                >
                  {uploading ? "Uploading..." : "Choose avatar image"}
                </Button>
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                  }}
                />
              </label>
              {error && (
                <p className="text-sm text-rose-600">{error}</p>
              )}
              {avatarUrl && (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar src={avatarUrl} name="User" size="lg" />
                  </div>
                  <p className="text-xs text-neutral-500 truncate max-w-[200px]">
                    {avatarUrl}
                  </p>
                </div>
              )}
            </div>
          )}
        </BlobUpload>
      </section>

      {/* Uploaded URLs list */}
      {uploadedUrls.length > 0 && (
        <section className="border border-neutral-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Uploaded files
          </h2>
          <ul className="space-y-2">
            {uploadedUrls.map((url, i) => (
              <li key={i} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-white">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline break-all"
                >
                  {url}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUploadedUrls(uploadedUrls.filter((_, j) => j !== i));
                    if (avatarUrl === url) setAvatarUrl(null);
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
