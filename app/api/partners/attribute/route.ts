import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user_id, ref_code } = await req.json();
    if (!user_id || !ref_code) return new NextResponse('Missing fields', { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Look up active affiliate by ref_code
    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('ref_code', ref_code.toLowerCase())
      .eq('is_active', true)
      .single();

    if (!affiliate) return NextResponse.json({ ok: true }); // silently ignore invalid codes

    // Avoid duplicate attributions
    const { data: existing } = await supabaseAdmin
      .from('referral_attributions')
      .select('id')
      .eq('referred_user_id', user_id)
      .single();

    if (existing) return NextResponse.json({ ok: true });

    await supabaseAdmin.from('referral_attributions').insert({
      affiliate_id: affiliate.id,
      referred_user_id: user_id,
      commission_months_remaining: 12,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[partners/attribute]', err.message);
    return new NextResponse('Failed', { status: 500 });
  }
}
