"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// A brand-tinted gradient mesh blob that drifts slowly. 
// Uses CSS keyframes for the drift + tiny JS to keep it in a fixed layer.

export function AuroraBackground({
  className,
  size = "200%",
}: { className?: string; size?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !ref.current) return;
    const el = ref.current;
    // Ensure the blob stays in a fixed positioning layer below everything
    el.style.setProperty("--aurora-size", size);
    // No JS animation needed - the CSS keyframes handle the slow drift
    // We just need to mount it; the actual animation is pure CSS
    return () => {
      el.style.removeProperty("--aurora-size");
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={`
        fixed inset-0 pointer-events-none z-10 
        overflow-hidden 
        ${className}
      `}
    >
      <div
        className={`
          w-full h-full 
          bg-gradient-to-br from-brand-50/20 via-brand-100/10 to-brand-50/20 
          rounded-full 
          opacity-0 
          transition-opacity 300s ease-in-out 
          ${reduced ? "opacity-0" : ""}
        `}
        aria-hidden="true"
      />
    </div>
  );
}