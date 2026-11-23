import type { NextConfig } from "next";

/** Browser requests stay same-origin; this is the upstream they are proxied to. */
const apiOrigin = (process.env.API_URL || "https://workora-backend-x5il.onrender.com").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // SocialProofBadge hero avatars (unsplash)
      { protocol: "https", hostname: "images.unsplash.com" },
      // Vercel Blob public URLs (avatars, banners, project covers, identity docs).
      // Wildcard covers the generated store hostname in any region.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.blob.vercel-storage.com" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
    ],
    // Prefer AVIF/WebP, quality 85, and small device sizes to cut transfer.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Preconnect to the API origin so the first backend request is faster.
          {
            key: "Link",
            value: `<${apiOrigin}>; rel=preconnect; crossorigin`,
          },
          // DNS-prefetch for the image host used by the hero social proof badge.
          {
            key: "Link",
            value: `<https://images.unsplash.com>; rel=dns-prefetch`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Always proxy to Render backend so browser-side auth is same-origin.
        // NEXT_PUBLIC_API_URL must be empty on Vercel so frontend fetch calls
        // are relative (same-origin cookies); Next.js rewrites them to Render.
        { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
        { source: "/api/auth/:path*", destination: `${apiOrigin}/api/auth/:path*` },
      ],
    };
  },
};

export default nextConfig;
