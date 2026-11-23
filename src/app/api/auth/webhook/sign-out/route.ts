import { NextResponse } from "next/server";

/**
 * Better Auth sign-out webhook stub.
 * The app handles auth via the Render backend; this endpoint exists only to
 * satisfy Next.js route validation. It acknowledges receipt without side effects.
 */
export async function POST() {
  return NextResponse.json({ received: true }, { status: 200 });
}
