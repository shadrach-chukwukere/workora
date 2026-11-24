import { NextResponse, type NextRequest } from "next/server";

/**
 * Layouts cannot read the browser pathname on the server. Expose the current
 * URL to Server Components so the session guard can preserve deep links
 * through mandatory onboarding. The value is always overwritten here, so a
 * client-supplied header with the same name cannot be trusted.
 */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-workora-current-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|sitemap-0.xml|robots.txt).*)"],
};
