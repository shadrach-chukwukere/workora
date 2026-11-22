import { NextResponse } from 'next/server';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_INFO_URL = 'https://api.github.com/user';

const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/auth/callback/github`;

export async function GET(request: Request) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      allow_signup: 'false',
      state: 'random-state',
    });

    const authUrl = `${GITHUB_AUTH_URL}?${params}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=auth_failed`);
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    // Exchange code for token
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.text();
    const params = new URLSearchParams(tokenData as string);
    const accessToken = params.get('access_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'failed_to_get_token' }, { status: 500 });
    }

    // Get user info from GitHub
    const userResponse = await fetch(GITHUB_USER_INFO_URL, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const userInfo = await userResponse.json();

    return NextResponse.json({ 
      success: true,
      user: userInfo,
      accessToken 
    });
  } catch (error) {
    console.error('GitHub callback error:', error);
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 });
  }
}