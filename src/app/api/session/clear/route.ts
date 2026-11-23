/**
 * Last-resort cookie cleanup for sign-out.
 *
 * Better Auth's own `/api/auth/sign-out` normally clears the session cookie.
 * This endpoint makes sign-out deterministic if that request fails or if a
 * stale cookie copy remains on the web origin. It only expires known auth
 * cookies; it cannot create or read a session.
 */

const COOKIE_BASES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.dont_remember",
  "better-auth.account_data",
  "better-auth.last_used_login_method",
] as const;

/** Better Auth may split large cookies into `.0`, `.1`, … chunks. */
const MAX_CHUNKS = 16;

function expiredCookie(name: string): string {
  const secure = name.startsWith("__Secure-") || name.startsWith("__Host-");
  return [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "SameSite=Lax",
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export async function POST(request: Request) {
  // Prevent a cross-site form POST from logging someone out by accident.
  if (request.headers.get("x-requested-with") !== "fetch") {
    return Response.json({ success: false, message: "Invalid request" }, { status: 403 });
  }

  const setCookies: string[] = [];
  for (const base of COOKIE_BASES) {
    const names = [base, `__Secure-${base}`, `__Host-${base}`];
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      names.push(`${base}.${index}`, `__Secure-${base}.${index}`, `__Host-${base}.${index}`);
    }
    setCookies.push(...names.map(expiredCookie));
  }

  return new Response(null, {
    status: 204,
    headers: [
      ["Cache-Control", "no-store"],
      ...setCookies.map((value) => ["Set-Cookie", value] as [string, string]),
    ],
  });
}
