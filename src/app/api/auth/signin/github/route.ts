import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Better Auth GitHub OAuth sign-in initiation
    // Redirect user to GitHub OAuth authorization page
    const origin = process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app';
    
    // Construct the GitHub OAuth URL with required parameters
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID || '');
    githubAuthUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/github`);
    githubAuthUrl.searchParams.set('scope', 'read:user user:email');
    githubAuthUrl.searchParams.set('state', 'random-state-value'); // Better Auth manages state
    githubAuthUrl.searchParams.set('allow_signup', 'false');
    
    return NextResponse.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}