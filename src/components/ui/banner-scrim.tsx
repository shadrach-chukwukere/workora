"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// A pointer-events-none scrim layer that sits above the banner image.
// Provides a vertical gradient for text legibility, with an optional aurora wash.
// This is purely additive — it wraps the existing banner <img> or <div>.

export function BannerScrim({
  className,
  hasAurora = false,
}: { className?: string; hasAurora?: boolean }) {
  const reduced = useReducedMotion();

  return (
    <div
      className={`
        pointer-events-none 
        overflow-hidden 
        absolute inset-0 
        bg-gradient-to-b from-black/24 via-black/12 to-black/24 
        ${reduced ? "bg-black/16" : ""}
        ${className}
      `}
    >
      {hasAurora && (
        <div
          className={`
            pointer-events-none 
            absolute inset-0 
            opacity-0 
            transition-opacity 300s ease-in-out 
            ${reduced ? "opacity-0" : "opacity-100"}
          `}
          aria-hidden="true"
        >
          {/* Aurora wash: subtle radial gradient that slowly shifts */}
          <div className="absolute inset-0 rounded-full filter blur-3xl" />
        </div>
      )}
    </div>
  );
}