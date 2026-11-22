import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_URL}/api/auth/callback/google`
);

export async function GET(request: Request) {
  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=auth_failed`);
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Get user info from Google
    const response = await oAuth2Client.fetch('https://www.googleapis.com/oauth2/v2/userinfo');
    const userInfo = response.data;

    // Here you would create/update the user in your database
    // and create a session cookie
    
    return NextResponse.json({ 
      success: true,
      user: userInfo,
      tokens 
    });
  } catch (error) {
    console.error('Google token exchange error:', error);
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 });
  }
}