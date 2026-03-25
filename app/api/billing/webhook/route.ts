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
      const plan = session.metadata?.plan as 'free' | 'growth' | 'pro' | undefined;

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

    // -------------------------------
    // invoice.payment_failed
    // -------------------------------
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer?.toString();

      if (customerId) {
        const { data: planRow } = await supabaseAdmin
          .from('user_plans')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (planRow?.user_id) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('contact_name, contact_email, company_name')
            .eq('id', planRow.user_id)
            .single();

          const firstName = profile?.contact_name?.split(' ')[0] || 'there';
          const userEmail = profile?.contact_email;

          if (userEmail) {
            transporter.sendMail({
              from: '"Greenio" <hello@greenio.co>',
              to: userEmail,
              subject: 'Action required: Payment failed for your Greenio subscription',
              html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <tr>
          <td style="background:#ffffff;padding:28px 40px 20px;border-bottom:3px solid #dc2626;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td>
                <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;height:auto;"/>
              </td></tr>
              <tr><td style="padding-top:28px;">
                <p style="margin:0;color:#dc2626;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Payment Failed</p>
                <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                  We couldn't process your payment, ${firstName}
                </h1>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr><td style="background:linear-gradient(90deg,#dc2626,#f87171);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              Your latest payment for Greenio could not be processed. Please update your payment method to keep your subscription active.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              If we're unable to collect payment, your account will be moved to the Free plan automatically.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#16a34a;border-radius:10px;">
                  <a href="https://greenio.co/billing"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;">
                    Update payment method →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:32px 0 0;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,sans-serif;">
              Need help? Just reply to this email — we're happy to assist.
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

          // Internal alert
          transporter.sendMail({
            from: '"Greenio" <hello@greenio.co>',
            to: 'hello@greenio.co',
            subject: `Payment failed: ${profile?.company_name || userEmail}`,
            html: `<p><strong>User:</strong> ${profile?.contact_name} (${userEmail})</p><p><strong>Company:</strong> ${profile?.company_name}</p><p><strong>Invoice:</strong> ${invoice.id}</p><p><strong>Amount due:</strong> ${((invoice.amount_due ?? 0) / 100).toFixed(2)} ${invoice.currency?.toUpperCase()}</p>`,
          }).catch(() => {/* silent fail */});

          console.log(`⚠️ Payment failed for user ${planRow.user_id}`);
        }
      }
    }

    // -------------------------------
    // customer.subscription.deleted
    // -------------------------------
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionId = subscription.id;

      const { data: planRow } = await supabaseAdmin
        .from('user_plans')
        .select('user_id, plan')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (planRow?.user_id) {
        // Downgrade to free
        await supabaseAdmin.from('user_plans').update({
          plan: 'free',
          stripe_subscription_id: null,
        }).eq('user_id', planRow.user_id);

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('contact_name, contact_email, company_name')
          .eq('id', planRow.user_id)
          .single();

        const firstName = profile?.contact_name?.split(' ')[0] || 'there';
        const userEmail = profile?.contact_email;

        if (userEmail) {
          transporter.sendMail({
            from: '"Greenio" <hello@greenio.co>',
            to: userEmail,
            subject: 'Your Greenio subscription has ended',
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
                <p style="margin:0;color:#6b7280;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Subscription Ended</p>
                <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                  Your subscription has ended, ${firstName}
                </h1>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr><td style="background:linear-gradient(90deg,#16a34a,#4ade80);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              Your Greenio subscription has ended and your account has been moved to the Free plan. Your data remains safe and accessible.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
              You can resubscribe any time to restore full access to all features.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#16a34a;border-radius:10px;">
                  <a href="https://greenio.co/billing"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;">
                    Resubscribe →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:32px 0 0;color:#374151;font-size:15px;font-family:Arial,sans-serif;">
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

        console.log(`🔴 Subscription deleted — downgraded user ${planRow.user_id} to free`);
      }
    }

    return new NextResponse('ok', { status: 200 });
  } catch (err: any) {
    console.error('🔴 Webhook handler failed:', err);
    return new NextResponse('Webhook error', { status: 500 });
  }
}
