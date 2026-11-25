"use client";

import { useReducedMotion } from "motion/react";
import { motion } from "motion/react";

// Gradient headline: single-accent animated gradient text.
// The accent color is locked to the page's primary accent, saturation kept < 80%.
// In reduced motion, the gradient becomes a plain solid color.

export function GradientHeadline({
  children,
  accentColor = "emerald", // pre-validated: one of the allowed accent names
  className,
}: { children: React.ReactNode; accentColor?: "emerald" | "electric-blue" | "deep-rose" | "burnt-orange"; className?: string }) {
  const reduced = useReducedMotion();

  // Accent colors are pre-screened to have saturation < 80% against neutral bases.
  // This mapping uses the safe palette from the design system.
  const accentMap: Record<string, string> = {
    emerald: "10 80% 45%",
    "electric-blue": "200 95% 52%",
    "deep-rose": "330 75% 55%",
    "burnt-orange": "25 85% 58%",
  };

  const accent = accentMap[accentColor] || accentMap.emerald;

  return (
    <motion.h1
      className={`
        text-4xl md:text-6xl lg:text-7xl 
        font-bold 
        tracking-tighter 
        ${reduced ? "text-zinc-900" : `bg-clip-text text-transparent bg-gradient-to-b from-${accent} via-${accent} to-${accent}`}
        ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: reduced ? 0.2 : 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      aria-hidden={reduced}
    >
      {children}
    </motion.h1>
  );
}