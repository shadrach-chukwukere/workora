"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon, Share01Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Copies the current URL to the clipboard and confirms with a toast. */
export function ShareProfileButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Profile link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link", { description: "Copy the address bar URL instead." });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy profile link"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50",
        className,
      )}
    >
      <Icon icon={Share01Icon} size={15} strokeWidth={1.8} />
      <span className="hidden sm:inline">{copied ? "Copied" : "Share profile"}</span>
      <span className="sm:hidden">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
