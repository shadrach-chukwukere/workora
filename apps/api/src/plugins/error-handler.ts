import type { FastifyInstance } from "fastify";
import type { FastifyReply } from "fastify";
import { env } from "../config/env.js";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function forbidden(message = "You are not allowed to perform this action"): AppError {
  return new AppError(403, "FORBIDDEN", message);
}

export function unauthenticated(message = "Authentication required"): AppError {
  return new AppError(401, "UNAUTHENTICATED", message);
}

export function conflict(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(409, "CONFLICT", message, details);
}

export function badRequest(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function serviceUnavailable(message: string): AppError {
  return new AppError(503, "SERVICE_UNAVAILABLE", message);
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((rawError, request, reply) => {
    const error = rawError as unknown as {
      statusCode?: number;
      validation?: unknown;
      message?: string;
    };
    const route = request.routeOptions?.url ?? request.url;
    if (rawError instanceof AppError) {
      request.log.info({ err: rawError.code, route }, rawError.message);
      reply.status(rawError.statusCode).send({
        success: false,
        message: rawError.message,
        error: { code: rawError.code, details: rawError.details ?? {} },
      });
      return;
    }

    if (error?.validation) {
      reply.status(400).send({
        success: false,
        message: "Validation failed",
        error: { code: "VALIDATION_ERROR", details: { issues: error.validation } },
      });
      return;
    }

    if (error?.statusCode === 429) {
      reply.status(429).send({
        success: false,
        message: "Too many requests, try again shortly",
        error: { code: "RATE_LIMITED", details: {} },
      });
      return;
    }

    if (typeof error?.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      const statusCode = error.statusCode;
      const message = error.message ?? "Request failed";
      request.log.warn({ err: message, route, statusCode }, "client error");
      reply.status(statusCode).send({
        success: false,
        message,
        error: { code: "BAD_REQUEST", details: {} },
      });
      return;
    }

    request.log.error({ err: rawError, route }, "request failed");
    reply.status(500).send({
      success: false,
      message: "Something went wrong",
      error: {
        code: "INTERNAL_ERROR",
        details: env.NODE_ENV === "production" ? {} : { message: String(rawError instanceof Error ? rawError.message : rawError) },
      },
    });
  });
}
