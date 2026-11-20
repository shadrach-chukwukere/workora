import type { NextConfig } from "next";

/** Browser requests stay same-origin; this is the upstream they are proxied to. */
const apiOrigin = (process.env.API_URL || "https://workora-backend-x5il.onrender.com").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
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
