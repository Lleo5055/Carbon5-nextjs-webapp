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

function generateRefCode(name: string): string {
  const base = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    // Admin guard
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

    const adminEmails = (process.env.ADMIN_EMAILS ?? 'hello@greenio.co').split(',');
    if (!adminEmails.includes(user.email ?? '')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { application_id } = await req.json();
    if (!application_id) return new NextResponse('Missing application_id', { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get application
    const { data: app } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (!app) return new NextResponse('Application not found', { status: 404 });

    // Create a dedicated partner auth account (separate from regular Greenio accounts)
    let partnerId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: app.email,
      email_confirm: true,
      user_metadata: {
        account_type: 'partner',
        full_name: app.name,
      },
    });

    if (createError) {
      // If email already exists, check if it's already a partner account
      if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === app.email);
        if (!existing) throw createError;

        // Block if this is a regular Greenio customer account
        if (existing.user_metadata?.account_type !== 'partner') {
          return new NextResponse(
            `${app.email} already has a regular Greenio account. Ask them to apply with a different email address for their partner account.`,
            { status: 409 }
          );
        }
        partnerId = existing.id;
      } else {
        throw createError;
      }
    } else {
      partnerId = newUser.user.id;
    }

    // Generate unique ref_code
    let refCode = generateRefCode(app.name);
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabaseAdmin
        .from('affiliates').select('id').eq('ref_code', refCode).single();
      if (!existing) break;
      refCode = generateRefCode(app.name);
      attempts++;
    }

    // Create or update affiliate record
    const { data: existingAffiliate } = await supabaseAdmin
      .from('affiliates').select('id, ref_code').eq('user_id', partnerId).single();

    if (!existingAffiliate) {
      await supabaseAdmin.from('affiliates').insert({
        user_id: partnerId,
        application_id,
        name: app.name,
        email: app.email,
        ref_code: refCode,
        is_active: true,
      });
    } else {
      // Already exists, reuse their ref_code
      refCode = existingAffiliate.ref_code;
    }

    // Update application status
    await supabaseAdmin
      .from('affiliate_applications')
      .update({ status: 'approved' })
      .eq('id', application_id);

    // Generate a magic link so the partner can log straight in without setting a password
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: app.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/partner-portal`,
      },
    });

    const magicLink = (linkData as any)?.properties?.action_link ?? 'https://greenio.co/partner-login';
    const firstName = app.name.split(' ')[0];
    const refLink = `https://greenio.co/r/${refCode}`;

    // Send approval email with magic login link
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: app.email,
      subject: "You're approved as a Greenio partner 🎉",
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td style="padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
          <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;"/>
          <p style="margin:24px 0 4px;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Partner Programme</p>
          <h1 style="margin:0;color:#0a3d2e;font-size:24px;font-weight:normal;">Welcome to the team, ${firstName}!</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">Your partner application has been approved. Here's your unique referral link:</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:16px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;">Your referral link</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#16a34a;">${refLink}</p>
          </div>
          <p style="color:#374151;font-size:15px;line-height:1.7;">Share this link with anyone who could benefit from Greenio. You'll earn <strong>15% of their monthly subscription for 12 months</strong> for every paying customer you refer.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;">Click below to access your partner portal — this link logs you in automatically (valid for 24 hours):</p>
          <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
            <tr><td style="background:#16a34a;border-radius:10px;">
              <a href="${magicLink}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Access your partner portal →</a>
            </td></tr>
          </table>
          <p style="color:#374151;font-size:13px;line-height:1.7;color:#6b7280;">After clicking the link, you can set a password from your portal so you can log in again at <a href="https://greenio.co/partner-login" style="color:#16a34a;">greenio.co/partner-login</a> any time.</p>
          <p style="color:#374151;font-size:14px;line-height:1.7;margin-top:16px;"><strong>How payouts work:</strong> Commissions are calculated on the 1st of each month. Once your balance reaches £50, you can request a payout from your portal.</p>
          <p style="color:#374151;font-size:15px;margin-top:24px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Questions? <a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a> · <a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, ref_code: refCode });
  } catch (err: any) {
    console.error('[admin/partners/approve]', err.message);
    return new NextResponse(err?.message ?? 'Failed', { status: 500 });
  }
}
