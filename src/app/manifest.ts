import type { MetadataRoute } from "next";

/** Web App Manifest — makes Workora installable as a standalone app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Workora — Talent meets opportunity",
    short_name: "Workora",
    description:
      "Find vetted freelancers or your next project. Workora keeps proposals, contracts, messages and milestone payments in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#5a50e5",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Find talent",
        short_name: "Find talent",
        url: "/find-talent",
      },
      {
        name: "Browse projects",
        short_name: "Projects",
        url: "/find-work",
      },
    ],
  };
}
