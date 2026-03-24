import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return new NextResponse('Missing STRIPE_SECRET_KEY', { status: 500 });

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' as any });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { plan, interval = 'monthly', user_id } = await req.json();

    if (!plan || !['growth', 'pro'].includes(plan)) {
      return new NextResponse('Invalid plan', { status: 400 });
    }
    if (!user_id) return new NextResponse('Missing user_id', { status: 400 });

    // Get the existing subscription from DB
    const { data: planRow } = await supabaseAdmin
      .from('user_plans')
      .select('stripe_subscription_id')
      .eq('user_id', user_id)
      .single();

    if (!planRow?.stripe_subscription_id) {
      return new NextResponse('No active subscription found', { status: 400 });
    }

    const priceMap: Record<string, string | undefined> = {
      growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
      growth_annual:  process.env.STRIPE_PRICE_GROWTH_ANNUAL,
      pro_monthly:    process.env.STRIPE_PRICE_PRO_MONTHLY,
      pro_annual:     process.env.STRIPE_PRICE_PRO_ANNUAL,
    };

    const priceId = priceMap[`${plan}_${interval}`];
    if (!priceId) return new NextResponse(`Missing price ID for ${plan}_${interval}`, { status: 500 });

    // Get current subscription to find the item ID
    const subscription = await stripe.subscriptions.retrieve(planRow.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) return new NextResponse('Could not find subscription item', { status: 500 });

    // Update subscription to new price (takes effect immediately)
    await stripe.subscriptions.update(planRow.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    // Update user_plans table
    await supabaseAdmin
      .from('user_plans')
      .update({ plan })
      .eq('user_id', user_id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Change plan error:', err);
    return new NextResponse(err?.message ?? 'Change plan failed', { status: 500 });
  }
}
