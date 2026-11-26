import type { NextRequest } from "next/server";

/**
 * Transparent proxy for the single remote MCP endpoint. A config rewrite does
 * not reliably forward Authorization to an external backend, so this handler
 * forwards the original headers and streams the response unchanged. All MCP
 * protocol/business logic stays in the API; this file contains no logic.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiOrigin = (process.env.API_URL || "https://workora-backend-x5il.onrender.com").replace(/\/+$/, "");

async function proxy(request: NextRequest): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete("host");
  const target = `${apiOrigin}/mcp${request.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      cache: "no-store",
      // Required by undici when streaming a request body from a NextRequest.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("transfer-encoding");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "MCP endpoint temporarily unavailable" }, id: null },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
