import { betterAuth } from 'better-auth';
import * as process from 'process';

// Better Auth configuration with Google and GitHub OAuth + Webhooks
export const auth = betterAuth({
  // Base URL for the application - important for redirects
  // This needs to match the domain configured in Google/GitHub developer consoles
  issuerBaseURL: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',

  social: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // The redirect URI must match what's configured in Google Cloud Console
      // Format: {baseURL}/api/auth/callback/google
      authorization: {
        // Additional OAuth parameters if needed
        params: {
          prompt: 'select_account', // Force account selection prompt
        },
      },
    },
    github: {
      enabled: true,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // The redirect URI must match what's configured in GitHub developer settings
      // Format: {baseURL}/api/auth/callback/github
    },
  },

  // Email/password disabled - using social auth only
  emailAndPassword: {
    enabled: false,
  },

  // Session configuration
  session: {
    // Cookie settings are managed by the framework
  },

  // Trusted origins for OAuth callbacks
  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    'https://workora-phi.vercel.app',
    'https://workora.com',
  ],

  // Webhook configuration for auth events
  webhooks: {
    signIn: '/api/auth/webhook/sign-in',
    signOut: '/api/auth/webhook/sign-out',
    signUp: '/api/auth/webhook/sign-up',
  },
});

// Helper functions for social login
export function signInWithGoogle() {
  // This will redirect to Google OAuth, then callback to /api/auth/callback/google
  window.location.href = `/api/auth/signin/google`;
  return false;
}

export function signInWithGitHub() {
  // This will redirect to GitHub OAuth, then callback to /api/auth/callback/github
  window.location.href = `/api/auth/signin/github`;
  return false;
}

export function signOut() {
  // Sign out from better auth
  window.location.href = `/api/auth/sign-out`;
  return false;
}

// Helper to get session from the API
export async function getCurrentSession() {
  const res = await fetch('/api/auth/session', {
    credentials: 'include',
  });
  if (!res.ok) return null;
  return res.json();
}