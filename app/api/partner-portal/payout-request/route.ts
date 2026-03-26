import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,
  auth: { user: 'hello@greenio.co', pass: process.env.SMTP_PASSWORD },
});

export async function POST(req: NextRequest) {
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

    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, email, ref_code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!affiliate) return new NextResponse('Not a partner', { status: 404 });

    // Calculate available balance
    const [{ data: commissions }, { data: payouts }] = await Promise.all([
      supabaseAdmin.from('commission_ledger').select('amount_gbp').eq('affiliate_id', affiliate.id),
      supabaseAdmin.from('affiliate_payouts').select('amount_gbp').eq('affiliate_id', affiliate.id).eq('status', 'paid'),
    ]);

    const totalEarned = (commissions ?? []).reduce((s, r) => s + Number(r.amount_gbp), 0);
    const totalPaid = (payouts ?? []).reduce((s, r) => s + Number(r.amount_gbp), 0);
    const available = totalEarned - totalPaid;

    if (available < 50) {
      return new NextResponse('Minimum payout threshold not reached (£50)', { status: 400 });
    }

    // Check no pending payout already exists
    const { data: pendingPayout } = await supabaseAdmin
      .from('affiliate_payouts')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'pending')
      .single();

    if (pendingPayout) {
      return new NextResponse('A payout request is already pending', { status: 400 });
    }

    await supabaseAdmin.from('affiliate_payouts').insert({
      affiliate_id: affiliate.id,
      amount_gbp: Number(available.toFixed(2)),
      status: 'pending',
    });

    // Notify Greenio team
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: 'hello@greenio.co',
      subject: `Payout request: ${affiliate.name} — £${available.toFixed(2)}`,
      html: `
        <p><strong>Partner:</strong> ${affiliate.name} (${affiliate.email})</p>
        <p><strong>Ref code:</strong> ${affiliate.ref_code}</p>
        <p><strong>Amount:</strong> £${available.toFixed(2)}</p>
        <p>Process this payout via Stripe or bank transfer, then mark as paid in <a href="https://greenio.co/admin/partners">admin panel</a>.</p>
      `,
    }).catch(() => {});

    // Confirm to partner
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: affiliate.email,
      subject: `Payout request received — £${available.toFixed(2)}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
          <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;"/>
          <h1 style="margin:24px 0 0;color:#0a3d2e;font-size:22px;">Payout request received</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">We've received your payout request for <strong>£${available.toFixed(2)}</strong>. We'll process it within 5 business days.</p>
          <p style="color:#374151;font-size:15px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;"><a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, amount_gbp: Number(available.toFixed(2)) });
  } catch (err: any) {
    console.error('[partner-portal/payout-request]', err.message);
    return new NextResponse(err?.message ?? 'Failed', { status: 500 });
  }
}
