"use client";

import { Briefcase02Icon, Icon, WorkIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type MarketplaceRole = "freelancer" | "client";

/** Shared role picker for sign-up and post-OAuth onboarding. */
export function RoleChoiceCards({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: MarketplaceRole | null;
  onSelect: (role: MarketplaceRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RoleCard
        icon={<Icon icon={WorkIcon as any} size={22} strokeWidth={1.8} />}
        title="I am a freelancer"
        body="Post your portfolio, send proposals and get paid into milestones."
        selected={selected === "freelancer"}
        disabled={disabled}
        onClick={() => onSelect("freelancer")}
      />
      <RoleCard
        icon={<Icon icon={Briefcase02Icon as any} size={22} strokeWidth={1.8} />}
        title="I am hiring"
        body="Post a brief, review proposals and fund milestones when work lands."
        selected={selected === "client"}
        disabled={disabled}
        onClick={() => onSelect("client")}
      />
    </div>
  );
}

function RoleCard({
  icon,
  title,
  body,
  selected,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors disabled:pointer-events-none disabled:opacity-60",
        selected
          ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
          : "border-neutral-200 bg-white hover:border-neutral-300",
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">{icon}</span>
      <span className="text-[15px] font-semibold text-neutral-900">{title}</span>
      <span className="text-sm leading-relaxed text-neutral-600">{body}</span>
    </button>
  );
}
