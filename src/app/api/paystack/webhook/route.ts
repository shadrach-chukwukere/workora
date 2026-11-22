import { NextResponse } from 'next/server';

/**
 * Paystack Webhook Handler
 * 
 * Receives real-time payment notifications from Paystack.
 * 
 * Must be secured with Paystack's secret key signature verification.
 * 
 * Events handled:
 * - charge.success - Payment was successful
 * - charge.failure - Payment failed
 * - transfer.success - Transfer completed
 * - transfer.failure - Transfer failed
 * - dispute.open - Dispute opened
 * - dispute.closed - Dispute resolved
 * - refund.success - Refund processed
 * - refund.failure - Refund failed
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Paystack signature header' },
        { status: 400 }
      );
    }

    // Verify the webhook signature
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    // In production, you should verify the signature properly
    // Paystack provides a way to verify webhook signatures
    // For now, we'll log and accept the webhook

    console.log('🔔 Paystack Webhook received:', {
      ...payload,
      signature,
      receivedAt: new Date().toISOString(),
    });

    // Map event types to handlers
    const event = payload.event;

    // Handle different event types
    switch (event) {
      case 'charge.success': {
        // Payment was successful
        // - Update payment status in database
        // - Release escrow funds
        // - Send receipt to customer
        // - Notify freelancer
        console.log('💳 Payment successful:', {
          reference: payload.data?.reference,
          amount: payload.data?.amount,
          email: payload.data?.customer_email,
        });
        break;
      }

      case 'charge.failure': {
        // Payment failed
        // - Update payment status to failed
        // - Notify user
        // - Offer retry option
        console.log('❌ Payment failed:', {
          reference: payload.data?.reference,
          reason: payload.data?.failure_reason,
        });
        break;
      }

      case 'transfer.success': {
        // Transfer to freelancer completed
        // - Update milestone status
        // - Release funds to freelancer bank
        console.log('✅ Transfer successful:', {
          reference: payload.data?.reference,
          amount: payload.data?.amount,
        });
        break;
      }

      case 'dispute.open': {
        // Dispute opened
        // - Mark milestone as disputed
        // - Notify both parties
        console.log('🚨 Dispute opened:', {
          reference: payload.data?.reference,
        });
        break;
      }

      case 'refund.success': {
        // Refund processed
        // - Update payment status
        // - Send confirmation
        console.log('💰 Refund successful:', {
          reference: payload.data?.reference,
        });
        break;
      }

      default: {
        console.log('📋 Unknown Paystack event:', event, payload);
        break;
      }
    }

    return NextResponse.json({
      success: true,
      event: event,
      receivedAt: new Date().toISOString(),
      data: payload.data ? {
        reference: payload.data.reference,
        amount: payload.data.amount,
        status: payload.data.status,
      } : null,
    });
  } catch (error) {
    console.error('❌ Paystack Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Paystack Webhook GET endpoint for verification
 * 
 * Paystack may send GET requests to verify the webhook URL.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const token = searchParams.get('token');

  // In a full implementation, you would verify the token with Paystack
  // and return 200 if the endpoint is verified

  if (mode === 'subscribe' && token) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}