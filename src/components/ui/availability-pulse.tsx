"use client";

import { useReducedMotion } from "motion/react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";

// Availability pulse: a restrained expanding ring dot beside rate.
// Semantic status prop (available/away/busy), with a pulse that respects 
// reduced-motion (collapses to a static dot).

export function AvailabilityPulse({
  status = "available",
  className,
}: { status: "available" | "away" | "busy"; className?: string }) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setExpanded((p) => !p), 2000);
    return () => clearInterval(id);
  }, [reduced]);

  const statusColors = {
    available: "green",
    away: "amber",
    busy: "red",
  };

  const statusLabels = {
    available: "Available",
    away: "Away",
    busy: "Busy",
  };

  return (
    <motion.div
      className={`
        inline-flex 
        items-center 
        gap-1 
        text-sm 
        font-medium 
        ${reduced ? "transition-none" : "transition-colors 200ms"}
        ${className}
      `}
    >
      {/* The pulse ring */}
      <motion.span
        className={`
          w-2 h-2 
          rounded-full 
          bg-${statusColors[status]}/20 
          border-2 border-${statusColors[status]}
          ${reduced ? "transition-none" : "scale-100 transition-transform 200ms ease-in-out"}
          ${expanded ? "scale-140" : "scale-100"}
        `}
        aria-hidden="true"
      />
      <span className="text-${statusColors[status]}/80">{statusLabels[status]}</span>
    </motion.div>
  );
}