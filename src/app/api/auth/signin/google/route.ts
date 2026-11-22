import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Better Auth Google OAuth sign-in initiation
    // Redirect user to Google OAuth consent screen
    const origin = process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app';
    
    // Construct the Google OAuth URL with required parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID || '');
    googleAuthUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/google`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', 'random-state-value'); // Better Auth manages state
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    
    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('Google sign-in error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}