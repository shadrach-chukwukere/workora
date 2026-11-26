"use client";

import { useEffect } from "react";

const GTM_SRC = "https://www.googletagmanager.com/gtm.js?id=GTM-TQ3Q7HWR";

/**
 * Loads GTM after the page is fully loaded and the browser is idle. Unlike
 * next/script's lazyOnload, this does not emit a <link rel="preload"> in the
 * initial HTML, so the 178 KiB container never competes with first paint.
 */
export function AnalyticsLoader() {
  useEffect(() => {
    let cancelled = false;

    function inject() {
      if (cancelled || document.getElementById("workora-gtm")) return;
      const script = document.createElement("script");
      script.id = "workora-gtm";
      script.async = true;
      script.src = GTM_SRC;
      document.head.appendChild(script);
    }

    function schedule() {
      const idle = window.requestIdleCallback;
      if (idle) idle(inject, { timeout: 3000 });
      else window.setTimeout(inject, 1500);
    }

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
    };
  }, []);

  return null;
}
