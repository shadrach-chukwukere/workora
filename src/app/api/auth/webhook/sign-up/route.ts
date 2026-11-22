import { NextResponse } from 'next/server';

/**
 * Better Auth Sign-Up Webhook
 * 
 * Receives events when a user creates an account via social provider.
 * 
 * Events include:
 * - provider: "google" | "github" | "email"
 * - userId: the newly created user's ID
 * - email: the user's email address
 * - username: the user's display name (if available)
 * - ipAddress: the IP address from which the sign-up occurred
 * - userAgent: the user agent string
 * - timestamp: when the sign-up occurred
 * - confirmed: whether the email has been confirmed
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log('🔔 Better Auth Sign-Up Webhook received:', {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    // Custom logic:
    // - Send welcome email sequence
    // - Add user to onboarding drip campaign
    // - Update analytics (new user sign-up)
    // - Trigger referral code generation
    // - Add to welcome newsletter

    return NextResponse.json({
      success: true,
      event: 'sign_up',
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Better Auth Sign-Up Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}