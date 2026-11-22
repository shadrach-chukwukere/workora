import { betterAuth } from 'better-auth';
import * as process from 'process';

// Better Auth with Google and GitHub OAuth
// The issuerBaseURL MUST match your deployed domain exactly
export const auth = betterAuth({
  // CRITICAL: Must match your deployed domain exactly
  // Use fallback only for local development
  issuerBaseURL: process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app',

  social: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      enabled: true,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },

  // Email/password disabled - using social auth only
  emailAndPassword: {
    enabled: false,
  },

  // Session configuration
  session: {
    // Cookie settings are managed by the framework
    // Ensure cookieDomain matches your deployed domain
    cookieDomain: process.env.COOKIE_DOMAIN || 'workora-phi.vercel.app',
  },

  // Trusted origins for OAuth callbacks
  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app',
    'https://workora.com',
  ],
});