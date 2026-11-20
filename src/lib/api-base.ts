/**
 * Absolute origin for server-side calls to the Fastify API.
 *
 * `NEXT_PUBLIC_API_URL` is intentionally empty in the browser so Next.js
 * rewrites keep auth cookies same-origin. Node's fetch cannot use relative
 * URLs, so Server Components, server actions, and route guards must use the
 * server-only `API_URL` instead.
 */
const configured = process.env.API_URL?.trim();
const publicConfigured = process.env.NEXT_PUBLIC_API_URL?.trim();

export const serverApiBase =
  configured ||
  (publicConfigured && /^https?:\/\//i.test(publicConfigured) ? publicConfigured : "") ||
  "https://workora-backend-x5il.onrender.com";
