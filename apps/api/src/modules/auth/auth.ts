import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { env } from "../../config/env.js";
import { db } from "../../database/connection.js";

/** Better Auth is constructed over the shared Kysely instance, with our table/column names. */
const instance = await db();

export const auth = betterAuth({
  appName: "Workora",
  basePath: "/api/auth",
  baseURL: env.AUTH_BASE_URL,
  secret: env.AUTH_SECRET,

  database: kyselyAdapter(instance, { type: "postgres" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Users are verified by default — no email service required.
    requireEmailVerification: false,
    // Argon2id, per project security requirements
    password: {
      hash: async (password: string) => hash(password),
      verify: async ({ hash: storedHash, password }: { hash: string; password: string }) =>
        verify(storedHash, password),
    },
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      // No email service integrated; verification is automatic.
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      // No email service integrated; verification is automatic.
    },
  },

  // Our snake_case schema, mapped here rather than renamed at the database
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3010",
    "https://workora-phi.vercel.app",
  ],

  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    database: { generateId: "uuid" },
  },

  rateLimit: {
    window: 60,
    max: 60,
  },
});

export type Session = typeof auth.$Infer.Session;
