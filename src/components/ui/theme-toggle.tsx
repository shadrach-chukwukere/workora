"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, resolvedTheme } = useTheme();

  const labels: Record<string, string> = {
    light: "Switch to dark mode",
    dark: "Switch to system mode",
    system: "Switch to light mode",
  };

  const icons: Record<string, React.ReactNode> = {
    light: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    dark: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
      </svg>
    ),
    system: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={labels[theme]}
      title={labels[theme]}
      className={cn("data-[theme=dark]:bg-brand-600 data-[theme=dark]:text-white data-[theme=dark]:border-transparent", className)}
      data-theme={theme}
    >
      {icons[theme]}
      <span className="sr-only">{labels[theme]}</span>
      {resolvedTheme === "dark" ? (
        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Dark</span>
      ) : null}
    </Button>
  );
}
