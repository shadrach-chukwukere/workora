import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");

// Private, authenticated, or agent-only areas must never be crawled.
const disallowed = [
  "/dashboard/",
  "/admin/",
  "/client/",
  "/freelancer/",
  "/settings/",
  "/api/",
  "/auth/",
  "/onboarding/",
  "/workspace/",
  "/connections/",
  "/invoice/",
  "/notifications/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: ["OAI-SearchBot", "ChatGPT-User", "Claude-User", "Googlebot"],
        allow: "/",
        disallow: disallowed,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
