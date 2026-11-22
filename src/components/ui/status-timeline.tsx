import { cn } from "@/lib/utils";
import { Icon, ArrowRight02Icon, CheckmarkCircle02Icon, Alert02Icon, StarIcon } from "@/lib/icons";

type MilestoneStatus = "upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid";

export const MILESTONE_STATUSES: {
  id: MilestoneStatus;
  label: string;
  tone: "neutral" | "brand" | "warning" | "success" | "danger";
  icon: React.ReactNode;
}[] = [
  { id: "upcoming", label: "Upcoming", tone: "neutral", icon: <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} /> },
  { id: "funded", label: "Funded", tone: "brand", icon: <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.8} className="text-brand-600" /> },
  { id: "in_review", label: "In review", tone: "warning", icon: <Icon icon={Alert02Icon} size={14} strokeWidth={1.8} className="text-amber-600" /> },
  { id: "revision", label: "Revision", tone: "danger", icon: <Icon icon={Alert02Icon} size={14} strokeWidth={1.8} className="text-rose-600" /> },
  { id: "approved", label: "Approved", tone: "success", icon: <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.8} className="text-emerald-600" /> },
  { id: "paid", label: "Paid", tone: "success", icon: <Icon icon={StarIcon} size={14} strokeWidth={1.8} className="text-emerald-600" /> },
];

interface StatusTimelineProps {
  milestones: { id: string; title: string; status: MilestoneStatus; dueDate: string | null; amount: number }[];
  currentStep?: number;
  compact?: boolean;
  className?: string;
}

export function StatusTimeline({ milestones, currentStep, compact = false, className }: StatusTimelineProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Connector line */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 -translate-x-1/2 top-0 bottom-[60px] w-px bg-neutral-200 dark:bg-neutral-800",
          compact ? "hidden" : ""
        )}
      />

      <div className={cn("relative", compact ? "flex flex-col gap-3" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3")}>
        {milestones.map((milestone, index) => {
          const isLast = index === milestones.length - 1;
          const isActive = currentStep !== undefined ? index === currentStep : milestone.status !== "upcoming";
          const isCompleted = ["approved", "paid"].includes(milestone.status);
          const meta = MILESTONE_STATUSES.find((m) => m.id === milestone.status) ?? MILESTONE_STATUSES[0];

          return (
            <div key={milestone.id} className={cn("flex flex-col gap-2", compact && "flex-row items-center gap-4")}>
              {/* Step marker */}
              <div className={cn(
                "relative z-10 shrink-0",
                compact ? "mt-0.5" : "mt-0"
              )}>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-medium text-xs shadow-sm transition-all",
                    isCompleted
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : isActive
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-white border-neutral-300 text-neutral-400"
                  )}
                >
                  <span className="pointer-events-none">{meta.icon}</span>
                </span>
              </div>

              {/* Milestone content */}
              <div className={cn("flex-1 min-w-0", compact ? "mt-0" : "mt-2")}>
                <h3 className={cn(
                  "text-sm font-semibold leading-tight",
                  isCompleted ? "text-emerald-800" : isActive ? "text-brand-800" : "text-neutral-900"
                )}>
                  {milestone.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {milestone.dueDate ? `Due ${new Date(milestone.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", {
                      neutral: "bg-neutral-300",
                      brand: "bg-brand-500",
                      warning: "bg-amber-500",
                      success: "bg-emerald-500",
                      danger: "bg-rose-500",
                    }[meta.tone])}
                  />
                  {meta.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-neutral-900 tabular-nums">
                  ${milestone.amount.toLocaleString()}
                </span>
              </div>

              {/* Connector to next (compact mode only) */}
              {compact && !isLast && (
                <span
                  aria-hidden
                  className="mt-2.5 h-px w-full bg-neutral-200 dark:bg-neutral-800 shrink-0"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
