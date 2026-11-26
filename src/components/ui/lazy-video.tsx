"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Muted, looped background video that starts loading only after the page has
 * finished loading and the element is close to the viewport. A still poster is
 * shown until the first frame is ready, so the initial page load stays fast.
 */
export function LazyVideo({
  src,
  posterSrc,
  alt,
  className,
}: {
  src: string;
  posterSrc: string;
  alt: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Arm the observer only after the initial page load, and during idle time.
  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | undefined;

    function arm() {
      if (cancelled || !containerRef.current) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer?.disconnect();
          }
        },
        { rootMargin: "300px 0px" },
      );
      observer.observe(containerRef.current);
    }

    function afterLoad() {
      const idle = window.requestIdleCallback;
      if (idle) idle(arm, { timeout: 2000 });
      else window.setTimeout(arm, 250);
    }

    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", afterLoad);
      observer?.disconnect();
    };
  }, []);

  // Once mounted, play while visible and pause when scrolled away.
  useEffect(() => {
    if (!shouldLoad || !containerRef.current) return;
    const video = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100",
        className,
      )}
    >
      {/* Poster is a normal optimised image — instant paint, no video bytes yet */}
      <Image
        src={posterSrc}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        unoptimized
        className={cn(
          "object-cover transition-opacity duration-500",
          playing ? "opacity-0" : "opacity-100",
        )}
      />

      {shouldLoad ? (
        <video
          ref={videoRef}
          src={src}
          poster={posterSrc}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-label={alt}
          onCanPlay={() => {
            void videoRef.current?.play().catch(() => {});
          }}
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      <span className="sr-only">{alt}</span>
    </div>
  );
}

export default LazyVideo;
