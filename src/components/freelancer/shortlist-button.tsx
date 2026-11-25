"use client";

import { useState } from "react";
import { toast } from "sonner";
import { serverApiBase } from "@/lib/api-base";
import { cn } from "@/lib/utils";

/** Client leaf for toggling a freelancer in the client's shortlist. */
export function ShortlistButton({
  freelancerId,
  className,
}: {
  freelancerId: string;
  className?: string;
}) {
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleShortlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${serverApiBase}/api/v1/users/me/shortlist`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ freelancerId }),
      });
      const data = await res.json();
      if (data.success) {
        const next = data.data?.shortlisted ?? !isShortlisted;
        setIsShortlisted(next);
        toast[next ? "success" : "error"](
          data.message ?? (next ? "Added to shortlist" : "Removed from shortlist"),
        );
      } else {
        toast.error(data.message ?? "Could not update shortlist");
      }
    } catch {
      toast.error("Failed to update shortlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleShortlist}
      disabled={busy}
      aria-pressed={isShortlisted}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
        isShortlisted
          ? "text-neutral-500 hover:text-neutral-700"
          : "text-brand-600 hover:bg-brand-50 hover:text-brand-800",
        className,
      )}
    >
      {isShortlisted ? "Shortlisted" : "Shortlist"}
    </button>
  );
}
