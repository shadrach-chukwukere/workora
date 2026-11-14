import type { NextConfig } from "next";

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
        { source: "/api/v1/:path*", destination: "https://workora-backend-x5il.onrender.com/api/v1/:path*" },
        { source: "/api/auth/:path*", destination: "https://workora-backend-x5il.onrender.com/api/auth/:path*" },
      ],
    };
  },
};

export default nextConfig;
