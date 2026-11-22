import { NextResponse } from 'next/server';

/**
 * Better Auth Sign-Out Webhook
 * 
 * Receives events when a user signs out.
 * 
 * Events include:
 * - userId: the user's ID
 * - sessionId: the terminated session ID
 * - ipAddress: the IP address from which the sign-out occurred
 * - userAgent: the user agent string
 * - timestamp: when the sign-out occurred
 * - reason: optional reason for sign-out
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log('🔔 Better Auth Sign-Out Webhook received:', {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    // Custom logic:
    // - Update last_sign_out_at in database
    // - Trigger goodbye/retention emails
    // - Log security events
    // - Update analytics

    return NextResponse.json({
      success: true,
      event: 'sign_out',
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Better Auth Sign-Out Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}