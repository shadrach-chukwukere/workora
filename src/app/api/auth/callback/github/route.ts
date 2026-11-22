import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { betterAuth } from 'better-auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    // Handle the GitHub OAuth callback
    const res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/auth/signin/github/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
      body: JSON.stringify({
        provider: 'github',
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.redirect(new URL('/login?error=' + (data.error || 'unknown'), request.url));
    }

    // Session created successfully - redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }
}