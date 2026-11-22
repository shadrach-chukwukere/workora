import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    const cookieStore = await cookies();
    const cookie = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    // Exchange OAuth code for session
    // Use the same base URL as auth.ts
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app';
    
    const res = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
      body: JSON.stringify({
        code,
        provider: 'github',
        state,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error('GitHub OAuth token exchange error:', data);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    if (data.user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }
}