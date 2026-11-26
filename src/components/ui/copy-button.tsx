"use client";

import { toast } from "sonner";
import { CopyIcon, Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Small icon-only button that copies a value to the clipboard. */
export function CopyButton({
  value,
  label = "Copy to clipboard",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy — please select the text manually");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
        className,
      )}
    >
      <Icon icon={CopyIcon} size={15} strokeWidth={1.8} />
    </button>
  );
}

export default CopyButton;
