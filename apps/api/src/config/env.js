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
    RESEND_API_KEY: z.string().default(""),
    EMAIL_FROM: z.string().min(1).default("Workora <no-reply@example.com>"),
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
});
function loadEnv() {
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
