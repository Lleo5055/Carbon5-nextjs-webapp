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

    const { data: app } = await supabaseAdmin
      .from('affiliate_applications')
      .select('name, email')
      .eq('id', application_id)
      .single();

    await supabaseAdmin
      .from('affiliate_applications')
      .update({ status: 'rejected' })
      .eq('id', application_id);

    if (app?.email) {
      transporter.sendMail({
        from: '"Greenio" <hello@greenio.co>',
        to: app.email,
        subject: 'Your Greenio partner application',
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
          <h1 style="margin:24px 0 0;color:#0a3d2e;font-size:22px;">Hi ${app.name.split(' ')[0]},</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">Thank you for your interest in the Greenio partner programme. After reviewing your application, we're not able to move forward at this time.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;">This doesn't mean we won't work together in the future — feel free to reach out to <a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a> if you'd like to discuss further.</p>
          <p style="color:#374151;font-size:15px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;"><a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/partners/reject]', err.message);
    return new NextResponse(err?.message ?? 'Failed', { status: 500 });
  }
}
