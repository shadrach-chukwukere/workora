import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { betterAuth } from 'better-auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    // Handle the Google OAuth callback
    // Better Auth automatically processes the callback when we hit the right endpoint
    // The key is that Google redirects to /api/auth/callback/google, not /api/auth/signin/google/callback
    
    // Let's use Better Auth's built-in callback handling
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // Exchange the code for tokens and create session
    const res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
      body: JSON.stringify({
        code,
        provider: 'google',
        state,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error('Google OAuth token exchange error:', data);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    // Session created successfully - get the user info and redirect
    if (data.user) {
      // User is now signed in - redirect to dashboard
      const role = data.user.role || 'freelancer';
      return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
    }

    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }
}