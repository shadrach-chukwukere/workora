"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SwRegistrar = dynamic(
  () => import("@/components/pwa/sw-registrar").then((mod) => mod.SwRegistrar),
  { ssr: false },
);

const WebMcpTools = dynamic(
  () => import("@/components/agent/webmcp-tools").then((mod) => mod.WebMcpTools),
  { ssr: false },
);

/** Root-only effects that are not needed for first paint. */
export function DeferredRootEffects() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function schedule() {
      const idle = window.requestIdleCallback;
      if (idle) idle(() => { if (!cancelled) setReady(true); }, { timeout: 2500 });
      else window.setTimeout(() => { if (!cancelled) setReady(true); }, 1500);
    }

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
    };
  }, []);

  if (!ready) return null;
  return (
    <>
      <SwRegistrar />
      <WebMcpTools />
    </>
  );
}
