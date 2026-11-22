import { NextResponse } from 'next/server';
import { auth } from '@/better-auth';

export async function GET(request: Request) {
  try {
    // Handle the GitHub OAuth callback
    const result = await auth.handleCallback('github', request);

    if (result.error) {
      console.error('GitHub OAuth error:', result.error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    if (result.user) {
      // Sign in the user - create a session
      // The user object contains: id, name, email, image, role
      const session = await auth.createSession(result.user.id, result.user);

      // Redirect to the user's workspace/dashboard
      const workspace = `/${result.user.role}/dashboard`;
      return NextResponse.redirect(new URL(workspace, request.url));
    }

    // No user returned - redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }
}