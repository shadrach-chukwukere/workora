"use client";

import { useState } from "react";
import { toast } from "sonner";
import { serverApiBase } from "@/lib/api-base";
import { cn } from "@/lib/utils";

/** Client leaf for toggling a saved project. Keeps hooks out of the server page. */
export function SaveProjectButton({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${serverApiBase}/api/v1/projects/${projectId}/save`, {
        method: isSaved ? "DELETE" : "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setIsSaved(data.data?.saved ?? !isSaved);
        toast.success(data.message ?? (isSaved ? "Project removed from saved" : "Project saved"));
      } else {
        toast.error(data.message ?? "Could not update saved projects");
      }
    } catch {
      toast.error("Failed to save project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleSave}
      disabled={busy}
      aria-pressed={isSaved}
      className={cn(
        "inline-flex items-center text-xs font-medium transition-colors disabled:opacity-50",
        isSaved ? "text-neutral-500 hover:text-neutral-700" : "text-brand-600 hover:text-brand-800",
        className,
      )}
    >
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
