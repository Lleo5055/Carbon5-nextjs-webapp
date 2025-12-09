// app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    // Only allow these plans to go through Checkout
    if (!plan || !['growth', 'pro'].includes(plan)) {
      return new NextResponse('Invalid plan', { status: 400 });
    }

    const priceId =
      plan === 'growth'
        ? process.env.STRIPE_PRICE_ID_GROWTH
        : process.env.STRIPE_PRICE_ID_PRO;

    if (!priceId) {
      return new NextResponse('Missing Stripe price ID for this plan', {
        status: 500,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // TODO (later): attach Supabase user id as metadata for webhooks
    // const userId = ...;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
    });

    if (!session.url) {
      return new NextResponse('No checkout URL returned', { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error', err);
    return new NextResponse('Failed to create checkout session', {
      status: 500,
    });
  }
}