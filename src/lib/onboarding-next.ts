"use client";

/**
 * Locate a `next` value from the current query string. Client components do
 * not receive server searchParams, so this keeps sign-in links and forms
 * aligned with the server-side onboarding guard.
 */
export function nextFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}
