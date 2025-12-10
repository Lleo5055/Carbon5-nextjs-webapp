// app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// -------------------------------
// ENV CHECKS
// -------------------------------
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment');
}

// Create Stripe client
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

// -------------------------------
// POST /checkout
// -------------------------------
export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    if (!plan || !['growth', 'pro'].includes(plan)) {
      return new NextResponse('Invalid plan', { status: 400 });
    }

    // Map plan → Stripe price ID
    const priceId =
      plan === 'growth'
        ? process.env.STRIPE_PRICE_GROWTH
        : process.env.STRIPE_PRICE_PRO;

    if (!priceId) {
      return new NextResponse('Missing Stripe price ID', { status: 500 });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?success=true&plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return new NextResponse('Checkout failed', { status: 500 });
  }
}
