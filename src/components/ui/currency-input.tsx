"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon, Dollar01Icon } from "@/lib/icons";

export function CurrencyInput({
  value,
  onChange,
  label,
  hint,
  error,
  disabled,
  className,
  placeholder = "0.00",
}: {
  value: number | null | undefined; // dollars (e.g. 49.99)
  onChange: (dollars: number | null) => void;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState("");
  const isInitialized = useRef(false);

  // Sync external value to raw string on mount/change
  useEffect(() => {
    if (!isInitialized.current) {
      setRaw(value != null ? value.toFixed(2) : "");
      isInitialized.current = true;
    } else if (raw === "") {
      setRaw(value != null ? value.toFixed(2) : "");
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value.replace(/[^0-9.]/g, "");
      // Allow at most one decimal point, max 2 decimal places
      const parts = next.split(".");
      if (parts.length > 2) {
        setRaw(parts[0] + "." + parts.slice(1).join(""));
        return;
      }
      if (parts[1] && parts[1].length > 2) {
        setRaw(parts[0] + "." + parts[1].slice(0, 2));
        return;
      }
      setRaw(next);
      const parsed = next === "" || next === "." ? null : Number(next);
      if (parsed === null || Number.isNaN(parsed)) {
        onChange(null);
      } else {
        onChange(parsed);
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    if (raw === "" || raw === ".") {
      setRaw("");
      onChange(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setRaw(parsed.toFixed(2));
      onChange(parsed);
    }
  }, [raw, onChange]);

  const displayValue = raw === "" ? placeholder : raw;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
          <span className="ml-1 text-[11px] font-normal text-neutral-400 dark:text-neutral-500">USD</span>
        </label>
      )}
      <div className="relative">
        <span
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
        >
          <Icon icon={Dollar01Icon} size={14} strokeWidth={1.8} />
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            "h-10 w-full rounded-lg border pl-9 pr-3 text-sm transition-colors",
            disabled
              ? "bg-neutral-100 dark:bg-neutral-900/50 text-neutral-400 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800"
              : error
              ? "border-rose-400 text-rose-600 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "bg-white dark:bg-surface text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-neutral-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          )}
          placeholder={placeholder}
          inputMode="decimal"
        />
      </div>
      {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      {hint && !error && <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}
