"use client";

import { useReducedMotion } from "motion/react";
import { motion } from "motion/react";

// Floating avatar with a gentle float and soft ring glow.
// Honors reduced-motion preference; in reduced mode, the float becomes static.

export function FloatingAvatar({
  src,
  alt,
  className,
}: { src: string; alt: string; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={`
        relative 
        w-24 h-24 
        shrink-0 
        items-center justify-center 
        rounded-full 
        overflow-hidden 
        border-2 border-white/20 
        ${reduced ? "transition-none" : "transition-transform ease-in-out 3s repeat-yoyo"}
        ${className}
      `}
      initial={{ y: 0 }}
      animate={{ y: reduced ? 0 : -10 }}
      transition={{ 
        duration: 1.5, 
        repeat: Infinity, 
        yoyo: true, 
        ease: "sine.inOut" 
      }}
    >
      <img
        src={src}
        alt={alt}
        className={`
          w-full h-full 
          object-cover 
          transition-opacity 200ms 
          ${reduced ? "opacity-100" : "opacity-100"}
        `}
        loading="lazy"
      />
    </motion.div>
  );
}