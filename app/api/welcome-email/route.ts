import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
    const { name, email, company } = await req.json();

    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const firstName = name?.split(' ')[0] || 'there';

    await transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: email,
      subject: `Welcome to Greenio, ${firstName} 🌿`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to Greenio</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Georgia',serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:28px 40px 20px;border-bottom:3px solid #16a34a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:28px;">
                    <p style="margin:0;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Welcome</p>
                    <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                      You're all set, ${firstName}!
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#16a34a,#4ade80);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                ${company ? `<strong>${company}</strong> is now live on Greenio.` : 'Your Greenio account is now active.'} Start tracking your carbon footprint and build audit-ready reports in minutes.
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:24px;margin:24px 0 32px;">
                <tr><td>
                  <p style="margin:0 0 16px;color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;">Get started in 3 steps</p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#1f2937;">
                        <span style="display:inline-block;background:#16a34a;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;margin-right:10px;">1</span>
                        Add your emissions data — electricity, fuel and gas
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#1f2937;">
                        <span style="display:inline-block;background:#16a34a;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;margin-right:10px;">2</span>
                        Log Scope 3 activities — travel, supply chain, waste
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#1f2937;">
                        <span style="display:inline-block;background:#16a34a;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;margin-right:10px;">3</span>
                        Download your PDF report from the dashboard
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;">
                    <a href="https://greenio.co/dashboard"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.2px;">
                      Go to your dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                Any questions? Just reply to this email — we're happy to help.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;font-family:Arial,sans-serif;">
                Questions? Reply to <a href="mailto:hello@greenio.co" style="color:#16a34a;text-decoration:none;">hello@greenio.co</a>
                &nbsp;·&nbsp;
                <a href="https://greenio.co/privacy" style="color:#16a34a;text-decoration:none;">Privacy Policy</a>
                &nbsp;·&nbsp;
                <a href="https://greenio.co" style="color:#16a34a;text-decoration:none;">greenio.co</a>
              </p>
              <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;font-family:Arial,sans-serif;">
                © 2026 Greenio · Carbon accounting intelligence
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[welcome-email]', err.message);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
