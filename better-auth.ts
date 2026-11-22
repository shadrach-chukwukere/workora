import { betterAuth } from 'better-auth';
import * as process from 'process';

// Better Auth configuration with Google and GitHub OAuth + Webhooks
export const auth = betterAuth({
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
    cookieCache: {
      name: 'better-auth-session',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    },
  },

  // Trusted origins for OAuth callbacks
  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    'https://workora.com',
  ],

  // Webhook configuration for auth events
  webhooks: {
    // These endpoints will receive POST requests with auth event data
    signIn: '/api/auth/webhook/sign-in',
    signOut: '/api/auth/webhook/sign-out',
    signUp: '/api/auth/webhook/sign-up',
  },
});

// Helper functions for social login
export function signInWithGoogle() {
  // This will redirect to Google OAuth
  window.location.href = `/api/auth/signin/google`;
  return false;
}

export function signInWithGitHub() {
  // This will redirect to GitHub OAuth  
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