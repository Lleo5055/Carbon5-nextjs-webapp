import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get affiliate record
    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id, ref_code, name, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!affiliate) return new NextResponse('Not a partner', { status: 404 });

    const [
      { count: totalClicks },
      { count: totalSignups },
      { data: commissions },
      { data: payouts },
      { data: recentPayouts },
    ] = await Promise.all([
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('ref_code', affiliate.ref_code),
      supabaseAdmin
        .from('referral_attributions')
        .select('*', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate.id),
      supabaseAdmin
        .from('commission_ledger')
        .select('amount_gbp, status')
        .eq('affiliate_id', affiliate.id),
      supabaseAdmin
        .from('affiliate_payouts')
        .select('amount_gbp, status')
        .eq('affiliate_id', affiliate.id),
      supabaseAdmin
        .from('affiliate_payouts')
        .select('amount_gbp, status, requested_at, paid_at')
        .eq('affiliate_id', affiliate.id)
        .order('requested_at', { ascending: false })
        .limit(10),
    ]);

    const totalEarned = (commissions ?? []).reduce((s, r) => s + Number(r.amount_gbp), 0);
    const totalPaid = (payouts ?? [])
      .filter(p => p.status === 'paid')
      .reduce((s, r) => s + Number(r.amount_gbp), 0);
    const pendingBalance = totalEarned - totalPaid;

    // Active paying customers — referred users who have a paid plan
    const { data: attributions } = await supabaseAdmin
      .from('referral_attributions')
      .select('referred_user_id')
      .eq('affiliate_id', affiliate.id);

    const referredIds = (attributions ?? []).map(a => a.referred_user_id);
    let activeCustomers = 0;
    if (referredIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('user_plans')
        .select('*', { count: 'exact', head: true })
        .in('user_id', referredIds)
        .in('plan', ['growth', 'pro']);
      activeCustomers = count ?? 0;
    }

    return NextResponse.json({
      ref_code: affiliate.ref_code,
      ref_link: `https://greenio.co/r/${affiliate.ref_code}`,
      total_clicks: totalClicks ?? 0,
      total_signups: totalSignups ?? 0,
      active_customers: activeCustomers,
      total_earned_gbp: Number(totalEarned.toFixed(2)),
      total_paid_gbp: Number(totalPaid.toFixed(2)),
      pending_balance_gbp: Number(pendingBalance.toFixed(2)),
      can_request_payout: pendingBalance >= 50,
      recent_payouts: recentPayouts ?? [],
    });
  } catch (err: any) {
    console.error('[partner-portal/stats]', err.message);
    return new NextResponse('Failed', { status: 500 });
  }
}
