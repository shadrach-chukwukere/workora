"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";

// Spotlight card: cursor-tracked spotlight border.
// A soft rectangular highlight follows the cursor within the card boundary.
// Honors reduced-motion: in reduced mode, the highlight stays centered or disappears.

export function SpotlightCard({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !cardRef.current) return;
    const el = cardRef.current;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, [reduced]);

  if (reduced) {
    return (
      <div className={`
        relative 
        overflow-hidden 
        border rounded-lg border-border 
        ${className}
      `}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      className={`
        relative 
        overflow-hidden 
        border rounded-lg border-border 
        ${className}
      `}
    >
      {/* Spotlight highlight: a pseudo-element that follows cursor */}
      <motion.div
        className={`
          absolute 
          inset-0 
          pointer-events-none 
          border-border 
          mask-border 
          mask-type: luminance 
          mask-image: 
            radial-gradient(
              ellipse at var(--mx%) var(--my%)
              from(rgba(255,255,255,.3)) 
              to(transparent)
            )
        `}
        style={{
          "--mx": `${mousePos.x}%`,
          "--my": `${mousePos.y}%`,
        }}
      />
      <motion.div
        className="relative z-10"
        style={{ willChange: "transform" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}