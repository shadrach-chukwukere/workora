import type { NextRequest } from "next/server";

/**
 * Bearer-preserving proxy for agent REST operations. The Zod schemas, handlers
 * and permission checks live only in apps/api/src/modules/agent; this is a
 * transparent transport so OAuth clients can use the web origin.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiOrigin = (process.env.API_URL || "https://workora-backend-x5il.onrender.com").replace(/\/+$/, "");

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const target = `${apiOrigin}/api/v1/agent/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      cache: "no-store",
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("transfer-encoding");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ success: false, message: "Service temporarily unavailable", error: { code: "SERVICE_UNAVAILABLE" } }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
