import { NextResponse } from 'next/server';

/**
 * Better Auth Sign-In Webhook
 * 
 * Receives events when a user signs in via social provider or email/password.
 * 
 * Events include:
 * - provider: "google" | "github" | "email"
 * - userId: the user's ID
 * - email: the user's email (if available)
 * - ipAddress: the IP address from which the sign-in occurred
 * - userAgent: the user agent string
 * - sessionId: the newly created session ID
 * - timestamp: when the sign-in occurred
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Log the webhook event (in production, send to your analytics/service)
    console.log('🔔 Better Auth Sign-In Webhook received:', {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    // You can add custom logic here:
    // - Send to analytics (Mixpanel, Amplitude, etc.)
    // - Update last_sign_in_at in your database
    // - Trigger welcome emails
    // - Log security events

    // Example: Update user last sign-in timestamp
    // if (payload.userId && payload.provider) {
    //   await updateUserLastSignIn(payload.userId, payload.provider, payload.ipAddress);
    // }

    return NextResponse.json({
      success: true,
      event: 'sign_in',
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Better Auth Sign-In Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}