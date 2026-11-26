"use client";

import { useEffect } from "react";

/** Registers the offline service worker without rendering any UI. */
export function SwRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Caching is optional — never break the app if registration fails.
      });
  }, []);

  return null;
}
