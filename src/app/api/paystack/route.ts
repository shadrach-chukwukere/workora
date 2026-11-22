import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount, email, reference, callback_url, currency } = await request.json();

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;

    if (!paystackSecretKey || !paystackPublicKey) {
      return NextResponse.json(
        { error: 'Paystack keys not configured' },
        { status: 500 }
      );
    }

    // Initialize transaction with Paystack
    const initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Convert to kobo (smallest unit)
        reference: reference || `workora-${Date.now()}`,
        callback_url: callback_url || `${process.env.NEXT_PUBLIC_URL}/payment/callback`,
        currency: currency || 'NGN',
      }),
    });

    const initData = await initResponse.json();

    if (!initData.data) {
      return NextResponse.json(
        { error: initData.message || 'Failed to initialize payment' },
        { status: initData.status || 400 }
      );
    }

    return NextResponse.json({
      authorization: initData.data.authorization_code,
      access_code: initData.data.access_code,
      reference: initData.data.reference,
      wallet: initData.data.wallet,
      merchant: initData.data.merchant,
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Handle verification callback
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');

  if (reference) {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    try {
      const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify?reference=${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
          },
        }
      );

      const verifyData = await verifyResponse.json();

      return NextResponse.json({
        verified: verifyData.data.status === 'success',
        amount: verifyData.data.amount / 100,
        transaction_id: verifyData.data.id,
        gateway_response: verifyData.data.gateway_response,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({});
}