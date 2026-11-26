import type { NextConfig } from "next";

/** Browser requests stay same-origin; this is the upstream they are proxied to. */
const apiOrigin = (process.env.API_URL || "https://workora-backend-x5il.onrender.com").replace(/\/+$/, "");
const isDev = process.env.NODE_ENV === "development";

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
          // GTM loads after hydration; warm the connection so it stays off the critical path.
          {
            key: "Link",
            value: `<https://www.googletagmanager.com>; rel=preconnect`,
          },
          // Isolate the top-level window from cross-origin documents while still
          // allowing popups opened by sign-in and payment providers.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          // Clickjacking protection.
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME-type sniffing.
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Referrer policy.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Content Security Policy.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // The API origin is reached via same-origin rewrites, never as a script
              // source. Dropping it from script-src removes an allowlist bypass path.
              // React only needs unsafe-eval in development for enhanced error stacks.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.google-analytics.com`,
              `connect-src 'self' ${apiOrigin} https://api.paystack.co https://*.vercel-storage.com https://www.googletagmanager.com https://www.google-analytics.com`,
              `img-src 'self' data: https:`,
              `style-src 'self' 'unsafe-inline'`,
              "font-src 'self'",
              "object-src 'none'",
              `frame-ancestors 'none'`,
              "base-uri 'self'",
              "form-action 'self'",
              // Avoid upgrading localhost's http assets while developing.
              ...(isDev ? [] : ["upgrade-insecure-requests"]),
            ].join("; "),
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
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
        // Public OpenAPI document generated from the shared operation schemas.
        { source: "/openapi.json", destination: `${apiOrigin}/api/v1/openapi.json` },
        // OAuth 2.1 / RFC 9728 discovery and protocol endpoints (web origin = issuer).
        { source: "/.well-known/oauth-authorization-server", destination: `${apiOrigin}/api/v1/oauth/metadata` },
        { source: "/.well-known/oauth-protected-resource", destination: `${apiOrigin}/api/v1/oauth/protected-resource` },
        { source: "/.well-known/oauth-protected-resource/api/mcp", destination: `${apiOrigin}/api/v1/oauth/protected-resource` },
        { source: "/.well-known/oauth-protected-resource/mcp", destination: `${apiOrigin}/api/v1/oauth/protected-resource` },
        { source: "/api/oauth/:path*", destination: `${apiOrigin}/api/v1/oauth/:path*` },
        // Legacy documentation links resolve internally; no user-facing connection UI exists.
        { source: "/developers/mcp", destination: "/ai" },
      ],
    };
  },
};

export default nextConfig;
