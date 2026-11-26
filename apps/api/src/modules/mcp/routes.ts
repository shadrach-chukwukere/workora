import type { FastifyInstance, FastifyReply } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env, mcpIssuer, mcpResourceUrl } from "../../config/env.js";
import { MCP_SCOPES } from "../oauth/scopes.js";
import { audit, verifyAccessToken, type TokenContext } from "../oauth/service.js";
import { AGENT_OPERATIONS } from "../agent/operations.js";
import { buildMcpServer } from "./server.js";

/** In-memory throttle: per user, per OAuth client and per IP (the global HTTP limit is disabled here). */
const WINDOW_MS = 60_000;
const MAX_CALLS = 180;
const calls = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = calls.get(key);
  if (!entry || entry.resetAt < now) {
    calls.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (calls.size > 20_000) calls.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_CALLS;
}

function unauthorized(reply: FastifyReply): void {
  reply.header("Cache-Control", "no-store");
  reply.header(
    "WWW-Authenticate",
    `Bearer resource_metadata="${mcpIssuer}/.well-known/oauth-protected-resource/api/mcp", scope="${MCP_SCOPES.join(" ")}", error="invalid_token"`,
  );
  reply.code(401).send({ error: "invalid_token", error_description: "Connect your Workora account to use this tool" });
}

function insufficientScope(reply: FastifyReply, scope: string): void {
  reply.header("Cache-Control", "no-store");
  reply.header(
    "WWW-Authenticate",
    `Bearer error="insufficient_scope", scope="${scope}", resource_metadata="${mcpIssuer}/.well-known/oauth-protected-resource/api/mcp"`,
  );
  reply.code(403).send({ error: "insufficient_scope", error_description: `The ${scope} permission is required` });
}

/** DNS-rebinding protection: only same-origin browser clients may call this endpoint. */
function invalidOrigin(origin: string | undefined): boolean {
  if (!origin) return false; // Native MCP clients do not send Origin.
  try {
    const url = new URL(origin);
    return url.hostname.toLowerCase() !== new URL(mcpIssuer).hostname.toLowerCase();
  } catch {
    return true;
  }
}

/** Register the stateless Streamable HTTP endpoint. Public URL: /api/mcp on the web origin. */
export default async function mcpRoutes(app: FastifyInstance) {
  app.all(
    "/mcp",
    { config: { rateLimit: false } },
    async (request, reply) => {
      if (!env.MCP_ENABLED || ["0", "false", "no", "off"].includes(env.MCP_ENABLED.toLowerCase())) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      if (env.NODE_ENV === "production" && request.headers["x-forwarded-proto"] === "http") {
        reply.code(403).send({ error: "https_required", error_description: "MCP requires HTTPS" });
        return;
      }
      if (invalidOrigin(request.headers.origin)) {
        reply.code(403).send({ error: "invalid_origin", error_description: "Origin is not allowed" });
        return;
      }

      // Throttle by IP before authentication so anonymous floods are also bounded.
      if (rateLimited(`preauth:${request.ip}`)) {
        reply.header("Retry-After", "60");
        reply.code(429).send({ error: "rate_limit_exceeded", error_description: "Too many MCP requests" });
        return;
      }

      // Every MCP request — including initialization and tool discovery — must
      // carry a valid, user-bound bearer token. The 401 challenge is what
      // starts the OAuth flow in Claude and other spec-compliant clients.
      const authorization = request.headers.authorization;
      let ctx: TokenContext | null = null;
      if (authorization?.startsWith("Bearer ")) {
        ctx = await verifyAccessToken(authorization.slice(7).trim());
      }
      if (!ctx) {
        unauthorized(reply);
        return;
      }

      const body = request.body as { method?: string; params?: { name?: string; arguments?: Record<string, unknown> } } | undefined;
      const toolName = body?.method === "tools/call" ? body.params?.name : undefined;
      if (toolName) {
        const op = AGENT_OPERATIONS.find((candidate) => candidate.name === toolName);
        if (!op || !op.scope || !ctx.scopes.includes(op.scope)) {
          insufficientScope(reply, op?.scope ?? MCP_SCOPES[0]!);
          return;
        }
      }

      const limits = [ctx.userId, ctx.clientId, request.ip];
      if (limits.some((key) => rateLimited(`${key}:${toolName ?? body?.method ?? "unknown"}`))) {
        reply.header("Retry-After", "60");
        reply.code(429).send({ error: "rate_limit_exceeded", error_description: "Too many MCP requests" });
        return;
      }

      reply.hijack();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const server = buildMcpServer(ctx);
      await server.connect(transport);

      reply.raw.once("close", () => {
        void transport.close();
        void server.close();
      });

      try {
        await transport.handleRequest(request.raw, reply.raw, request.body);
        if (ctx && body) {
          await audit(
            ctx.userId,
            ctx.clientId,
            toolName ? `mcp.tool.${toolName}` : `mcp.${body.method ?? "request"}`,
            `${request.method} ${mcpResourceUrl} at ${new Date().toISOString()}`,
          );
        }
      } catch (error) {
        request.log.error({ err: error }, "mcp request failed");
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { "content-type": "application/json" });
          reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
        } else if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
        void transport.close();
        void server.close();
      }
    },
  );
}
