"use client";

import { useState } from "react";
import { toast } from "sonner";
import { serverApiBase } from "@/lib/api-base";
import { Bookmark01Icon, Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Bookmark toggle for saving a freelancer to the client's shortlist.
 * Rendered only for signed-in clients; the parent supplies the initial state
 * from the shortlist ids endpoint so an already-saved talent looks saved.
 */
export function ShortlistButton({
  freelancerId,
  initiallyShortlisted = false,
  className,
}: {
  freelancerId: string;
  initiallyShortlisted?: boolean;
  className?: string;
}) {
  const [isShortlisted, setIsShortlisted] = useState(initiallyShortlisted);
  const [busy, setBusy] = useState(false);

  async function toggleShortlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        isShortlisted
          ? `${serverApiBase}/api/v1/users/me/shortlist/${encodeURIComponent(freelancerId)}`
          : `${serverApiBase}/api/v1/users/me/shortlist`,
        {
          method: isShortlisted ? "DELETE" : "POST",
          credentials: "include",
          headers: isShortlisted ? undefined : { "content-type": "application/json" },
          body: isShortlisted ? undefined : JSON.stringify({ freelancerId }),
        },
      );
      const data = await res.json();
      if (data.success) {
        const next = data.data?.shortlisted ?? !isShortlisted;
        setIsShortlisted(next);
        toast.success(data.message ?? (next ? "Saved to shortlist" : "Removed from shortlist"));
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
      aria-label={isShortlisted ? "Remove from shortlist" : "Save to shortlist"}
      title={isShortlisted ? "Remove from shortlist" : "Save to shortlist"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-50",
        isShortlisted
          ? "border-brand-300 bg-brand-500/25 text-brand-100"
          : "border-white/30 bg-white/10",
        className,
      )}
    >
      <Icon icon={Bookmark01Icon} size={15} strokeWidth={1.9} />
      <span className="sr-only">{isShortlisted ? "Saved to shortlist" : "Save to shortlist"}</span>
    </button>
  );
}
