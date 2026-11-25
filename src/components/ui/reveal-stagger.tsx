"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";

// Reveal stagger: Motion whileInView fade + rise for section children.
// Each child staggers based on its index. Reduced motion gets instant appear.

export function RevealStagger({
  children,
  tag = "div",
  className,
}: { children: React.ReactNode; tag?: "div" | "ul"; className?: string }) {
  const reduced = useReducedMotion();

  const staggerChildren = reduced
    ? children
    : React.Children.toArray(children).map((child, i) => (
        React.cloneElement(child as React.ReactElement, {
          key: child.key,
          ...(child.props as any),
        })
      ));

  return (
    <tag className={`
      grid gap-6 
      ${className}
    `}>
      {React.Children.toArray(children).map((child, i) => (
        <motion.div
          key={child.key}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.6,
            delay: i * 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </tag>
  );
}