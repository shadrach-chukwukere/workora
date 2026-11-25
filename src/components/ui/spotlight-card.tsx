"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

// Spotlight card: cursor-tracked spotlight border.
// A soft radial highlight follows the cursor within the card boundary.
// Honors reduced-motion: in reduced mode, no tracking highlight is rendered.

export function SpotlightCard({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
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

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden rounded-xl border border-neutral-200 bg-white ${className ?? ""}`}
    >
      {!reduced ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(420px circle at ${mousePos.x}% ${mousePos.y}%, rgba(90, 80, 229, 0.08), transparent 60%)`,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 p-6">{children}</div>
    </div>
  );
}
