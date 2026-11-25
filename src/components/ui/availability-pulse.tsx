"use client";

import { useReducedMotion, motion } from "motion/react";
import { useState, useEffect } from "react";

// Availability pulse: a restrained expanding ring dot.
// Accepts the public profile's actual status values (available / limited / unavailable).
// Reduced motion collapses the pulse to a static dot.

type PulseStatus = "available" | "limited" | "unavailable" | "away" | "busy";

const STATUS_STYLE: Record<PulseStatus, { dot: string; ring: string; label: string }> = {
  available: { dot: "bg-emerald-500", ring: "bg-emerald-500/25", label: "Available now" },
  limited: { dot: "bg-amber-500", ring: "bg-amber-500/25", label: "Limited availability" },
  unavailable: { dot: "bg-neutral-400", ring: "bg-neutral-400/25", label: "Fully booked" },
  away: { dot: "bg-amber-500", ring: "bg-amber-500/25", label: "Away" },
  busy: { dot: "bg-rose-500", ring: "bg-rose-500/25", label: "Busy" },
};

export function AvailabilityPulse({
  status = "available",
  className,
}: { status?: PulseStatus; className?: string }) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setExpanded((p) => !p), 2000);
    return () => clearInterval(id);
  }, [reduced]);

  const style = STATUS_STYLE[status] ?? STATUS_STYLE.available;

  return (
    <div className={`inline-flex items-center gap-2 text-sm font-medium text-neutral-700 ${className ?? ""}`}>
      <span className="relative inline-flex size-2.5 items-center justify-center" aria-hidden="true">
        {!reduced ? (
          <motion.span
            className={`absolute inset-0 rounded-full ${style.ring}`}
            animate={{ scale: expanded ? 1.6 : 1, opacity: expanded ? 0 : 0.8 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        ) : null}
        <span className={`relative size-2 rounded-full ${style.dot}`} />
      </span>
      <span>{style.label}</span>
    </div>
  );
}
