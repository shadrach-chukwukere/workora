import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverApiBase } from '@/lib/api-base';

const MAX_AMOUNT = 1_000_000; // cap at 1,000,000 (currency unit)
const ALLOWED_CALLBACK_HOSTS = [new URL(process.env.NEXT_PUBLIC_URL || 'https://workora-phi.vercel.app').hostname];

// Simple in-memory rate limit: 20 payment init requests per minute per IP.
const paystackRateLimit = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = paystackRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    paystackRateLimit.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

function isAllowedCallbackUrl(url: string | undefined): boolean {
  if (!url) return true; // default callback is used when not provided
  try {
    const parsed = new URL(url);
    return ALLOWED_CALLBACK_HOSTS.includes(parsed.hostname) && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidReference(ref: string | undefined): boolean {
  if (!ref) return true; // a server-generated reference is used when not provided
  return /^[a-zA-Z0-9_-]{3,64}$/.test(ref);
}

/** Verify the caller has an active Better Auth session. */
async function requireSession(request: Request): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookie) {
    return { ok: false, status: 401, body: { error: 'Authentication required' } };
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip)) {
    return { ok: false, status: 429, body: { error: 'Too many requests. Try again later.' } };
  }

  try {
    const res = await fetch(`${serverApiBase}/api/auth/get-session`, {
      headers: { cookie, origin: new URL(request.url).origin },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, status: 401, body: { error: 'Authentication required' } };
    }
    const session = (await res.json()) as { user?: { id: string; email: string } } | null;
    if (!session?.user) {
      return { ok: false, status: 401, body: { error: 'Authentication required' } };
    }
    return { ok: true, status: 200, body: session.user };
  } catch {
    return { ok: false, status: 401, body: { error: 'Authentication required' } };
  }
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session.ok) {
    return NextResponse.json(session.body, { status: session.status });
  }
  const user = (session as { ok: true; status: number; body: { email: string } }).body;

  try {
    const { amount, email, reference, callback_url, currency } = await request.json();

    // Amount: required, positive, capped. Caller cannot choose arbitrary amounts.
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between 0 and ${MAX_AMOUNT}` },
        { status: 400 },
      );
    }

    // Email: use the session user's email; ignore caller-supplied email.
    const payerEmail = user.email;

    // Reference: strict alphanumeric + dash/underscore, max 64 chars.
    if (!isValidReference(reference)) {
      return NextResponse.json(
        { error: 'Invalid reference format' },
        { status: 400 },
      );
    }

    // Callback URL: only allow your own domain over HTTPS.
    if (!isAllowedCallbackUrl(callback_url)) {
      return NextResponse.json(
        { error: 'callback_url must point to your own domain over HTTPS' },
        { status: 400 },
      );
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;

    if (!paystackSecretKey || !paystackPublicKey) {
      return NextResponse.json(
        { error: 'Paystack keys not configured' },
        { status: 500 },
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
        email: payerEmail,
        amount: Math.round(amountNum * 100), // Convert to kobo (smallest unit)
        reference: reference || `workora-${Date.now()}`,
        callback_url: callback_url || `${process.env.NEXT_PUBLIC_URL}/payment/callback`,
        currency: currency || 'NGN',
      }),
    });

    const initData = await initResponse.json();

    if (!initData.data) {
      return NextResponse.json(
        { error: initData.message || 'Failed to initialize payment' },
        { status: initData.status || 400 },
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
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session.ok) {
    return NextResponse.json(session.body, { status: session.status });
  }

  // Handle verification callback
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');

  if (!reference || !isValidReference(reference)) {
    return NextResponse.json({ error: 'Invalid or missing reference' }, { status: 400 });
  }

  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify?reference=${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      },
    );

    const verifyData = await verifyResponse.json();

    return NextResponse.json({
      verified: verifyData.data?.status === 'success',
      amount: verifyData.data?.amount / 100,
      transaction_id: verifyData.data?.id,
      gateway_response: verifyData.data?.gateway_response,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 },
    );
  }
}