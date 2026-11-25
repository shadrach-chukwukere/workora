"use client";

import { Children, isValidElement } from "react";
import { motion, useReducedMotion } from "motion/react";

// Reveal stagger: Motion whileInView fade + rise for section children.
// Each child staggers based on its index. Reduced motion gets an instant appearance.
// Renders a plain div wrapper. Use it around a list of section elements.

export function RevealStagger({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const items = Children.toArray(children);

  return (
    <div className={className ?? ""}>
      {items.map((child, i) => (
        <motion.div
          key={isValidElement(child) ? (child.key ?? i) : i}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: reduced ? 0 : 0.6,
            delay: reduced ? 0 : i * 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
