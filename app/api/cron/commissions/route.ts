import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Call this on the 1st of each month via Vercel Cron or manually
// Protected by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20' as any,
  });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Calculate last calendar month range
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = `${firstOfLastMonth.getFullYear()}-${String(firstOfLastMonth.getMonth() + 1).padStart(2, '0')}`;

  // Get all active attributions with months remaining
  const { data: attributions } = await supabaseAdmin
    .from('referral_attributions')
    .select('id, affiliate_id, referred_user_id, commission_months_remaining')
    .gt('commission_months_remaining', 0);

  if (!attributions?.length) {
    return NextResponse.json({ ok: true, processed: 0, month: monthLabel });
  }

  let processed = 0;

  for (const attr of attributions) {
    try {
      // Check commission not already calculated for this month
      const { data: existing } = await supabaseAdmin
        .from('commission_ledger')
        .select('id')
        .eq('affiliate_id', attr.affiliate_id)
        .eq('referred_user_id', attr.referred_user_id)
        .eq('month', monthLabel)
        .single();

      if (existing) continue;

      // Get referred user's Stripe customer ID
      const { data: planRow } = await supabaseAdmin
        .from('user_plans')
        .select('stripe_customer_id, plan')
        .eq('user_id', attr.referred_user_id)
        .single();

      if (!planRow?.stripe_customer_id || planRow.plan === 'free') {
        // No paid plan, skip but don't decrement months
        continue;
      }

      // Sum Stripe invoices paid last month for this customer
      const invoices = await stripe.invoices.list({
        customer: planRow.stripe_customer_id,
        status: 'paid',
        created: {
          gte: Math.floor(firstOfLastMonth.getTime() / 1000),
          lt: Math.floor(firstOfThisMonth.getTime() / 1000),
        },
      });

      const totalPaidPence = invoices.data.reduce((s, inv) => s + (inv.amount_paid ?? 0), 0);
      if (totalPaidPence === 0) continue;

      const commissionGbp = Number(((totalPaidPence / 100) * 0.15).toFixed(2));

      await supabaseAdmin.from('commission_ledger').insert({
        affiliate_id: attr.affiliate_id,
        referred_user_id: attr.referred_user_id,
        month: monthLabel,
        amount_gbp: commissionGbp,
        stripe_payment_id: invoices.data[0]?.id ?? null,
        status: 'pending',
      });

      // Decrement months remaining
      await supabaseAdmin
        .from('referral_attributions')
        .update({ commission_months_remaining: attr.commission_months_remaining - 1 })
        .eq('id', attr.id);

      processed++;
    } catch (err: any) {
      console.error(`[cron/commissions] Error for attribution ${attr.id}:`, err.message);
    }
  }

  console.log(`[cron/commissions] Processed ${processed} commissions for ${monthLabel}`);
  return NextResponse.json({ ok: true, processed, month: monthLabel });
}
