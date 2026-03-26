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

function verifyToken(action: string, id: string, expires: string, sig: string): boolean {
  try {
    const exp = parseInt(expires, 10);
    if (isNaN(exp) || Math.floor(Date.now() / 1000) > exp) return false;
    const secret = process.env.CRON_SECRET ?? 'greenio-secret';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${action}:${id}:${exp}`)
      .digest('hex');
    const sigBuf = Buffer.from(sig.padEnd(expected.length, '0').substring(0, expected.length), 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch { return false; }
}

function htmlPage(title: string, message: string, success: boolean) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${title}</title>
    <style>body{font-family:Arial,sans-serif;background:#f0f4f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
    .card{background:#fff;border-radius:16px;padding:48px 40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.07);}
    .icon{font-size:48px;margin-bottom:16px;}
    h1{color:#0a3d2e;font-size:22px;margin:0 0 12px;}
    p{color:#6b7280;font-size:15px;line-height:1.6;margin:0;}
    </style></head>
    <body><div class="card">
      <div class="icon">${success ? '✅' : '❌'}</div>
      <h1>${title}</h1>
      <p>${message}</p>
    </div></body></html>`,
    { status: success ? 200 : 400, headers: { 'Content-Type': 'text/html' } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '';
  const expires = searchParams.get('expires') ?? '';
  const sig = searchParams.get('sig') ?? '';

  if (!verifyToken('reject', id, expires, sig)) {
    return htmlPage('Link expired or invalid', 'This rejection link is invalid or has expired (links last 7 days). Please ask the applicant to reapply.', false);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: app } = await supabaseAdmin
    .from('affiliate_applications')
    .select('*')
    .eq('id', id)
    .single();

  if (!app) return htmlPage('Not found', 'Application not found.', false);
  if (app.status === 'approved') return htmlPage('Already approved', `${app.name} was already approved as a partner.`, false);
  if (app.status === 'rejected') return htmlPage('Already rejected', `${app.name} has already been rejected.`, true);

  await supabaseAdmin.from('affiliate_applications').update({ status: 'rejected' }).eq('id', id);

  const firstName = app.name.split(' ')[0];

  // Send rejection email to applicant
  transporter.sendMail({
    from: '"Greenio" <hello@greenio.co>',
    to: app.email,
    subject: 'Update on your Greenio partner application',
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td style="padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
          <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;"/>
          <p style="margin:24px 0 4px;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Partner Programme</p>
          <h1 style="margin:0;color:#0a3d2e;font-size:24px;font-weight:normal;">Hi ${firstName},</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;">Thank you for your interest in the Greenio Partner Programme. After reviewing your application, we are unable to move forward at this time.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin-top:16px;">We appreciate you taking the time to apply and wish you all the best.</p>
          <p style="color:#374151;font-size:15px;margin-top:24px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Questions? <a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a> · <a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }).catch(() => {});

  return htmlPage(
    'Application rejected',
    `${app.name} (${app.email}) has been rejected. A notification email has been sent to the applicant.`,
    true
  );
}
