import Link from "next/link";
import { Icon, ArrowRight02Icon } from "@/lib/icons";

/**
 * Workora-branded announcement strip for the AI integrations launch.
 * Uses the existing brand palette (never borrowed marketplace gradients).
 */
export function AiMcpBanner() {
  return (
    <div className="container-page pt-6 sm:pt-8">
      <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex shrink-0 items-center rounded-md bg-brand-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            New
          </span>
          <p className="text-sm font-medium text-neutral-900 sm:text-[15px]">
            Hire experts directly inside
          </p>
          <span className="text-sm font-semibold text-brand-800">Claude</span>
          <span className="text-brand-300">or</span>
          <span className="text-sm font-semibold text-brand-800">ChatGPT</span>
          <span className="hidden text-sm text-neutral-600 sm:inline">
            — connect your Workora account to your AI assistant.
          </span>
        </div>
        <Link
          href="/developers/mcp"
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-sm font-semibold text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline"
        >
          Connect Workora to your AI tool
          <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}
