import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new NextResponse('Missing STRIPE_SECRET_KEY', { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as any,
    });

    const { plan, interval = 'monthly', user_id } = await req.json();

    if (!plan || !['growth', 'pro'].includes(plan)) {
      return new NextResponse('Invalid plan', { status: 400 });
    }

    if (!user_id) {
      return new NextResponse('Missing user_id', { status: 400 });
    }

    const priceMap: Record<string, string | undefined> = {
      growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
      growth_annual:  process.env.STRIPE_PRICE_GROWTH_ANNUAL,
      pro_monthly:    process.env.STRIPE_PRICE_PRO_MONTHLY,
      pro_annual:     process.env.STRIPE_PRICE_PRO_ANNUAL,
    };

    const priceId = priceMap[`${plan}_${interval}`];

    if (!priceId) {
      return new NextResponse(`Missing Stripe price ID for ${plan}_${interval}`, { status: 500 });
    }

    // Use request origin so it works in both local dev and production
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id, plan, interval },
      success_url: `${origin}/billing?success=true&plan=${plan}`,
      cancel_url: `${origin}/billing?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return new NextResponse(err?.message ?? 'Checkout failed', { status: 500 });
  }
}
