"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Icon,
  ArrowRight02Icon,
  Briefcase02Icon,
  Search01Icon,
  UserAccountIcon,
  type IconName,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

type SearchMode = "talent" | "work";

const MODES: {
  id: SearchMode;
  label: string;
  href: string;
  placeholder: string;
  icon: IconName;
}[] = [
  {
    id: "talent",
    label: "Find talent",
    href: "/find-talent",
    placeholder: "Try “React developer” or “brand designer”",
    icon: UserAccountIcon,
  },
  {
    id: "work",
    label: "Find work",
    href: "/find-work",
    placeholder: "Try “mobile app” or “logo design”",
    icon: Briefcase02Icon,
  },
];

const POPULAR: Record<SearchMode, { label: string; query: string }[]> = {
  talent: [
    { label: "React developers", query: "react" },
    { label: "UI/UX designers", query: "ui ux" },
    { label: "SEO specialists", query: "seo" },
  ],
  work: [
    { label: "Web development", query: "web development" },
    { label: "Brand design", query: "brand design" },
    { label: "Writing", query: "writing" },
  ],
};

export function HeroSearch() {
  const [mode, setMode] = useState<SearchMode>("talent");
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];

  return (
    <div className="mx-auto mt-9 w-full max-w-3xl text-left">
      <div
        role="group"
        aria-label="Choose what to search"
        className="mx-auto mb-3 flex w-fit gap-1 rounded-full border border-neutral-200 bg-white/80 p-1 shadow-sm backdrop-blur"
      >
        {MODES.map((item) => {
          const selected = item.id === mode;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(item.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
                selected
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              <Icon icon={item.icon} size={16} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <form
        action={active.href}
        method="get"
        role="search"
        className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_20px_50px_-30px_rgba(23,23,43,0.45)] transition-[border-color,box-shadow] focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <Icon icon={Search01Icon} size={20} strokeWidth={1.8} className="shrink-0 text-neutral-400" aria-hidden="true" />
            <label htmlFor="hero-search" className="sr-only">
              {mode === "talent" ? "Search freelancers by skill" : "Search projects by keyword"}
            </label>
            <input
              id="hero-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder={active.placeholder}
              className="h-12 w-full min-w-0 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
          >
            Search
            <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
        <span className="text-neutral-500">Popular:</span>
        {POPULAR[mode].map((item) => (
          <Link
            key={item.label}
            href={`${active.href}?q=${encodeURIComponent(item.query)}`}
            prefetch={false}
            className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-neutral-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
