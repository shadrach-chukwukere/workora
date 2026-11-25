"use client";

import { motion, useReducedMotion } from "motion/react";

// Gradient headline wrapper: single-accent animated gradient text.
// Renders a div wrapper (so children can supply their own heading level).
// Reduced motion degrades to a plain static gradient with no entrance animation.

export function GradientHeadline({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className ?? ""}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={
        reduced
          ? undefined
          : {
              backgroundImage: "linear-gradient(180deg, #171717 0%, #4a41cf 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }
      }
    >
      {children}
    </motion.div>
  );
}
