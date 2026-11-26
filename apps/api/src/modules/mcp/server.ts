import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppError } from "../../plugins/error-handler.js";
import type { TokenContext } from "../oauth/service.js";
import { AGENT_OPERATIONS, type Actor } from "../agent/operations.js";

/** Tool responses are always both human-readable and machine-readable. */
function reply(data: Record<string, unknown>, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError,
  };
}

/** Never leak stacks, SQL, internal IDs or upstream error text to an agent. */
function safeError(error: unknown): { message: string; code: string } {
  if (error instanceof AppError && error.status < 500) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof z.ZodError) {
    return { message: error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" };
  }
  return { message: "The operation could not be completed. Try again or contact support.", code: "INTERNAL_ERROR" };
}

/**
 * A fresh MCP server per HTTP request. Every request is bound to the OAuth
 * token resolved by the transport route; there are no anonymous tool calls.
 * All business logic lives in the shared agent operations registry.
 */
export function buildMcpServer(ctx: TokenContext | null): McpServer {
  const server = new McpServer(
    { name: "workora-mcp", version: "1.0.0", description: "Workora freelance marketplace tools (MCP 2025-11-25)" },
    { capabilities: { tools: {} } },
  );
  const actor: Actor = { userId: ctx?.userId ?? null, token: ctx, session: false };

  for (const op of AGENT_OPERATIONS) {
    if (op.name.length > 64) throw new Error(`MCP tool name exceeds 64 characters: ${op.name}`);
    server.registerTool(
      op.name,
      {
        title: op.annotations.title,
        description: op.description,
        inputSchema: op.inputSchema as unknown as z.ZodRawShape,
        outputSchema: op.outputSchema,
        annotations: op.annotations,
      },
      async (args) => {
        try {
          const result = await op.handler(actor, op.inputSchema.parse(args ?? {}));
          return reply(result as Record<string, unknown>);
        } catch (error) {
          const { message, code } = safeError(error);
          return reply({ success: false, message, error: { code } }, true);
        }
      },
    );
  }

  return server;
}

/** Stable list of tool names, used by startup checks and tests. */
export const MCP_TOOL_NAMES = AGENT_OPERATIONS.map((op) => op.name);
