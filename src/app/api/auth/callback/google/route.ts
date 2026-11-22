import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { betterAuth } from 'better-auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    // Handle the Google OAuth callback
    // Better Auth automatically processes the callback and creates a session
    const res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/auth/signin/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
      body: JSON.stringify({
        // The callback parameters will be extracted from the URL
        provider: 'google',
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.redirect(new URL('/login?error=' + (data.error || 'unknown'), request.url));
    }

    // Session created successfully - redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }
}