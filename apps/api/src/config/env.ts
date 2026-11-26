import "dotenv/config";
import { z } from "zod";

/** Environment validated once at boot. Anything missing aborts startup. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  BASE_URL: z.string().url(),
  WEB_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DATABASE_PGLITE_PATH: z.string().default(".pglite"),
  AUTH_BASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters; generate a random one"),
  CORS_ORIGINS: z.string().min(1),
  /** Social sign-in. A provider is only enabled when both its id and secret are set. */
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().min(1).default("Workora <no-reply@example.com>"),
  /** Vercel Blob read/write token. When set, OAuth avatars are mirrored to our own storage. */
  BLOB_READ_WRITE_TOKEN: z.string().default(""),
  /** Google Gemini is used for resume parsing and profile suggestions. */
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  AI_DAILY_LIMIT_FREE: z.coerce.number().int().min(1).default(10),
  AI_DAILY_LIMIT_PAID: z.coerce.number().int().min(1).default(50),
  AI_GLOBAL_DAILY_CAP: z.coerce.number().int().min(1).default(500),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  PAYSTACK_SECRET_KEY: z.string().default(""),
  PAYSTACK_WEBHOOK_SECRET: z.string().default(""),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("eu-west-1"),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  /**
   * Yoti IDV is backend-only. YOTI_API_KEY holds the application PEM private
   * key (from Yoti Hub), with literal \n escapes accepted for env files.
   * When either value is empty, the manual admin-review flow remains available.
   */
  YOTI_SDK_ID: z.string().default(""),
  YOTI_API_KEY: z.string().default(""),
  /**
   * Identity verification is paused by default. Set this to true only when the
   * Yoti/storage keys and manual review flow are ready for real users.
   */
  REQUIRE_VERIFICATION: z.string().default("false"),

  /** MCP / OAuth 2.1 integration. URLs default to the existing web app origin. */
  MCP_ISSUER_URL: z.string().url().optional(),
  MCP_RESOURCE_URL: z.string().url().optional(),
  MCP_ENABLED: z.string().default("true"),
  MCP_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  MCP_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(2592000),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`\nInvalid environment configuration:\n${issues}\nCopy .env.example to .env and fix it.\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

/** Public URLs used by MCP clients for discovery and token audience binding. */
export const mcpIssuer = (env.MCP_ISSUER_URL ?? env.WEB_APP_URL).replace(/\/+$/, "");
export const mcpResourceUrl = (env.MCP_RESOURCE_URL ?? `${mcpIssuer}/api/mcp`).replace(/\/+$/, "");
export const mcpEnabled = ["1", "true", "yes", "on"].includes(env.MCP_ENABLED.trim().toLowerCase());

/** Single source of truth for the temporary verification pause. */
export const verificationRequired = ["1", "true", "yes", "on"].includes(
  env.REQUIRE_VERIFICATION.trim().toLowerCase(),
);
