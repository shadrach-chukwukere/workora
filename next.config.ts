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
    const api = process.env.API_URL ?? "http://localhost:3010";
    return {
      beforeFiles: [
        // The Next app proxies to the Fastify API so browser-side auth is same-origin
        { source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` },
        { source: "/api/auth/:path*", destination: `${api}/api/auth/:path*` },
      ],
    };
  },
};

export default nextConfig;
