import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { env } from "../../config/env.js";
import { db } from "../../database/connection.js";
import { mirrorProviderAvatarToBlob } from "./oauth-avatar.js";

/** Better Auth is constructed over the shared Kysely instance, with our table/column names. */
const instance = await db();

/**
 * OAuth redirect URIs go through the web app origin (WEB_APP_URL) so the state
 * cookie set at sign-in and the callback both land on the same origin, via the
 * Next.js `/api/auth/*` rewrite. Register these exact URIs with each provider:
 *   {WEB_APP_URL}/api/auth/callback/google
 *   {WEB_APP_URL}/api/auth/callback/github
 */
const webOrigin = env.WEB_APP_URL.replace(/\/+$/, "");

const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectURI: `${webOrigin}/api/auth/callback/google`,
        },
      }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          redirectURI: `${webOrigin}/api/auth/callback/github`,
        },
      }
    : {}),
};

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
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      // No email service integrated; verification is automatic.
    },
  },

  socialProviders,

  /**
   * Social sign-up: replace the provider's avatar URL with a copy hosted in
   * our own Vercel Blob store before the user row is inserted. That way the
   * DB, the session and every public profile all use the same stable URL.
   * If mirroring is disabled or fails, we keep the provider URL as fallback.
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const providerImage = typeof user.image === "string" ? user.image.trim() : null;
          if (!providerImage || !/^https?:\/\//i.test(providerImage)) return;

          const blobUrl = await mirrorProviderAvatarToBlob({
            id: typeof user.id === "string" ? user.id : null,
            email: typeof user.email === "string" ? user.email : null,
            imageUrl: providerImage,
          });
          if (!blobUrl) return;

          return { data: { image: blobUrl } };
        },
      },
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
    // Let someone who signed up with email/password later use Google/GitHub
    // with the same (provider-verified) email, instead of a duplicate-account error.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
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
