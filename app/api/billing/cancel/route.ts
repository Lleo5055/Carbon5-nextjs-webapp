import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'hello@greenio.co',
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { user_id, reason } = await req.json();
    if (!user_id) return new NextResponse('Missing user_id', { status: 400 });

    // Get subscription + user info
    const [{ data: planRow }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('user_plans').select('stripe_subscription_id, plan').eq('user_id', user_id).single(),
      supabaseAdmin.from('profiles').select('contact_name, contact_email, company_name').eq('id', user_id).single(),
    ]);

    if (!planRow?.stripe_subscription_id) {
      return new NextResponse('No active subscription found', { status: 400 });
    }

    // Cancel at period end (not immediately — gives user time until billing cycle ends)
    await stripe.subscriptions.update(planRow.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Send offboarding email to user
    const firstName = profile?.contact_name?.split(' ')[0] || 'there';
    const userEmail = profile?.contact_email;

    if (userEmail) {
      transporter.sendMail({
        from: '"Greenio" <hello@greenio.co>',
        to: userEmail,
        subject: 'Your Greenio subscription has been cancelled',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <tr>
          <td style="background:#ffffff;padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td>
                <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;height:auto;"/>
              </td></tr>
              <tr><td style="padding-top:28px;">
                <p style="margin:0;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Subscription Update</p>
                <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                  Sorry to see you go, ${firstName}
                </h1>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr><td style="background:linear-gradient(90deg,#16a34a,#4ade80);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              Your subscription has been cancelled and will remain active until the end of your current billing period. You won't be charged again.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              Your data is safe — you can still access your dashboard on the Free plan.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#16a34a;border-radius:10px;">
                  <a href="https://greenio.co/dashboard"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;">
                    Return to dashboard →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:32px 0 0;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,sans-serif;">
              Changed your mind? You can resubscribe any time from your billing page.
            </p>
            <p style="margin:8px 0 0;color:#374151;font-size:15px;font-family:Arial,sans-serif;">
              — The Greenio Team
            </p>
          </td>
        </tr>

        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/></td></tr>

        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;font-family:Arial,sans-serif;">
              Questions? Reply to <a href="mailto:hello@greenio.co" style="color:#16a34a;text-decoration:none;">hello@greenio.co</a>
              &nbsp;·&nbsp;
              <a href="https://greenio.co" style="color:#16a34a;text-decoration:none;">greenio.co</a>
            </p>
            <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;font-family:Arial,sans-serif;">© 2026 Greenio · Carbon accounting intelligence</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(() => {/* silent fail */});
    }

    // Send internal notification to hello@greenio.co with cancellation reason
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: 'hello@greenio.co',
      subject: `Cancellation: ${profile?.company_name || userEmail}`,
      html: `
        <p><strong>User:</strong> ${profile?.contact_name} (${userEmail})</p>
        <p><strong>Company:</strong> ${profile?.company_name}</p>
        <p><strong>Plan cancelled:</strong> ${planRow.plan}</p>
        <p><strong>Reason:</strong> ${reason || 'Not provided'}</p>
      `,
    }).catch(() => {/* silent fail */});

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Cancel error:', err);
    return new NextResponse(err?.message ?? 'Cancellation failed', { status: 500 });
  }
}
