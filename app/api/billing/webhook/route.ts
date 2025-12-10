import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// -------------------------------
// ENV CHECKS
// -------------------------------
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');

// -------------------------------
// Stripe + Supabase clients
// -------------------------------
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

// ❗ SERVICE ROLE client ONLY for webhook
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// -------------------------------
// POST handler
// -------------------------------
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature') || '';


  if (!signature) {
    return new NextResponse('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;

  // -------------------------------
  // 1️⃣ Verify Stripe signature
  // -------------------------------
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('🔴 Invalid Stripe signature:', err.message);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  // -------------------------------
  // 2️⃣ Handle relevant events
  // -------------------------------
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan as
        | 'free'
        | 'growth'
        | 'pro'
        | 'enterprise'
        | undefined;

      if (!userId || !plan) {
        console.warn('⚠️ Missing user_id/plan metadata in Stripe checkout');
      } else {
        const stripeCustomerId = session.customer?.toString() ?? null;
        const stripeSubscriptionId =
          (session.subscription as string | null) ?? null;

        // -------------------------------
        // 3️⃣ Update user_plans table
        // -------------------------------
        const { error } = await supabaseAdmin.from('user_plans').upsert(
          {
            user_id: userId,
            plan,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            report_count: 0, // reset on upgrade
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          console.error('🔴 Failed updating user_plans:', error);
          return new NextResponse('DB error', { status: 500 });
        }

        console.log(`✅ Updated plan for ${userId} → ${plan}`);
      }
    }

    // (Optional future events here)

    return new NextResponse('ok', { status: 200 });
  } catch (err: any) {
    console.error('🔴 Webhook handler failed:', err);
    return new NextResponse('Webhook error', { status: 500 });
  }
}
