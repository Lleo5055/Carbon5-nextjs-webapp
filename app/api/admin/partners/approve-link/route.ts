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
    return crypto.timingSafeEqual(new Uint8Array(sigBuf), new Uint8Array(expBuf));
  } catch { return false; }
}

function generateRefCode(name: string): string {
  const base = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}${suffix}`;
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

  if (!verifyToken('approve', id, expires, sig)) {
    return htmlPage('Link expired or invalid', 'This approval link is invalid or has expired (links last 7 days). Please ask the applicant to reapply.', false);
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
  if (app.status === 'approved') return htmlPage('Already approved', `${app.name} is already an approved partner.`, true);
  if (app.status === 'rejected') return htmlPage('Already rejected', `This application was previously rejected.`, false);

  // Create dedicated partner auth account
  let partnerId: string;
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: app.email,
    email_confirm: true,
    user_metadata: { account_type: 'partner', full_name: app.name },
  });

  if (createError) {
    if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === app.email);
      if (!existing) return htmlPage('Error', createError.message, false);
      if (existing.user_metadata?.account_type !== 'partner') {
        return htmlPage(
          'Email conflict',
          `${app.email} already has a regular Greenio account. Ask them to apply with a different email for their partner account.`,
          false
        );
      }
      partnerId = existing.id;
    } else {
      return htmlPage('Error', createError.message, false);
    }
  } else {
    partnerId = newUser.user.id;
  }

  // Generate unique ref_code
  let refCode = generateRefCode(app.name);
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabaseAdmin.from('affiliates').select('id').eq('ref_code', refCode).single();
    if (!existing) break;
    refCode = generateRefCode(app.name);
  }

  // Create affiliate record if not exists
  const { data: existingAffiliate } = await supabaseAdmin
    .from('affiliates').select('id, ref_code').eq('user_id', partnerId).single();

  if (!existingAffiliate) {
    await supabaseAdmin.from('affiliates').insert({
      user_id: partnerId,
      application_id: id,
      name: app.name,
      email: app.email,
      ref_code: refCode,
      is_active: true,
    });
  } else {
    refCode = existingAffiliate.ref_code;
  }

  // Update application status
  await supabaseAdmin.from('affiliate_applications').update({ status: 'approved' }).eq('id', id);

  const loginLink = 'https://greenio.co/partner-login';
  const TITLES = ['mr', 'mrs', 'ms', 'dr', 'prof', 'miss'];
  const nameParts = app.name.trim().split(/\s+/);
  const firstSignificant = nameParts.find((p: string) => !TITLES.includes(p.toLowerCase())) ?? nameParts[0];
  const firstName = firstSignificant.charAt(0).toUpperCase() + firstSignificant.slice(1).toLowerCase();
  const refLink = `https://greenio.co/r/${refCode}`;

  // Send welcome email to partner
  await transporter.sendMail({
    from: '"Greenio" <hello@greenio.co>',
    to: app.email,
    subject: "You're approved as a Greenio partner 🎉",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
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
          <p style="color:#374151;font-size:15px;line-height:1.7;">Earn <strong>15% of their monthly subscription for 12 months</strong> for every paying customer you refer.</p>
          <table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
            <tr><td style="background:#16a34a;border-radius:10px;">
              <a href="${loginLink}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Access your partner portal →</a>
            </td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px;">Enter your email at the login page and we'll send you a link each time you want to access your portal.</p>
          <p style="color:#374151;font-size:15px;margin-top:24px;">— The Greenio Team</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 16px 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;"><a href="mailto:hello@greenio.co" style="color:#16a34a;">hello@greenio.co</a> · <a href="https://greenio.co" style="color:#16a34a;">greenio.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }).catch(console.error);

  return htmlPage(
    'Partner approved!',
    `${app.name} (${app.email}) has been approved. Their welcome email with login link has been sent.`,
    true
  );
}
