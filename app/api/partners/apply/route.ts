import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,
  auth: { user: 'hello@greenio.co', pass: process.env.SMTP_PASSWORD },
});

function signedActionLink(action: 'approve' | 'reject', applicationId: string): string {
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const secret = process.env.CRON_SECRET ?? 'greenio-secret';
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${action}:${applicationId}:${expires}`)
    .digest('hex');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';
  return `${base}/api/admin/partners/${action}-link?id=${applicationId}&expires=${expires}&sig=${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, website, how_they_refer } = await req.json();
    if (!name || !email) return new NextResponse('Missing fields', { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Insert and get back the ID
    const { data: inserted, error } = await supabaseAdmin
      .from('affiliate_applications')
      .insert({ name, email, company, website, how_they_refer, status: 'pending' })
      .select('id')
      .single();

    if (error) throw error;

    const approveLink = signedActionLink('approve', inserted.id);
    const rejectLink = signedActionLink('reject', inserted.id);

    // Notify Greenio team with one-click approve/reject buttons
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: 'hello@greenio.co',
      subject: `New partner application: ${name}`,
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
          <p style="margin:24px 0 4px;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;">New Partner Application</p>
          <h1 style="margin:0;color:#0a3d2e;font-size:22px;font-weight:normal;">${name} wants to be a partner</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Application details</p>
            </td></tr>
            <tr><td style="padding:16px;">
              <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Name:</strong> ${name}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Email:</strong> ${email}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Company:</strong> ${company || '—'}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Website:</strong> ${website || '—'}</p>
              <p style="margin:0;font-size:14px;color:#374151;"><strong>How they plan to refer:</strong><br/>${how_they_refer || '—'}</p>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Click a button below — no login required. Links expire in 7 days.</p>

          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#16a34a;border-radius:10px;padding-right:8px;">
                <a href="${approveLink}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">
                  ✓ Approve
                </a>
              </td>
              <td style="width:8px;"></td>
              <td style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;">
                <a href="${rejectLink}" style="display:inline-block;padding:14px 28px;color:#374151;font-size:14px;font-weight:600;text-decoration:none;">
                  ✕ Reject
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Greenio Partner Programme · <a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => {});

    // Confirmation to applicant
    transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: email,
      subject: 'We received your partner application',
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
          <h1 style="margin:24px 0 0;color:#0a3d2e;font-size:22px;">Thanks for applying, ${name.split(' ')[0]}!</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">We've received your partner application and will review it within 48 hours. If approved, you'll receive your unique referral link and partner portal access by email.</p>
          <p style="color:#374151;font-size:15px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Questions? <a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[partners/apply]', err.message);
    return new NextResponse(err?.message ?? 'Failed', { status: 500 });
  }
}
