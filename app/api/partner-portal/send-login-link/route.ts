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
  const { email } = await req.json();
  if (!email) return new NextResponse('Missing email', { status: 400 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Check the email belongs to an active approved partner
  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, name')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (!affiliate) {
    // Return 200 to avoid leaking whether an email is registered
    return NextResponse.json({ ok: true });
  }

  // Generate magic link via admin API
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: email.toLowerCase().trim(),
    options: { redirectTo: 'https://greenio.co/partner-portal' },
  });

  const magicLink = (linkData as any)?.properties?.action_link;
  if (!magicLink) return NextResponse.json({ ok: true });

  const firstName = affiliate.name?.split(' ')[0] ?? 'there';

  await transporter.sendMail({
    from: '"Greenio" <hello@greenio.co>',
    to: email,
    subject: 'Your Greenio partner login link',
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td style="padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
          <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="160" style="display:block;"/>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;">Click the button below to access your partner portal. This link expires in 1 hour.</p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="background:#16a34a;border-radius:10px;">
              <a href="${magicLink}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Access partner portal →</a>
            </td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;"><a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a> · <a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
