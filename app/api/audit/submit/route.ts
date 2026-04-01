import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { requireOrgRole } from '@/lib/orgAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'hello@greenio.co',
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { package_id, org_id } = body;

    if (!package_id || !org_id) {
      return NextResponse.json(
        { error: 'package_id and org_id are required' },
        { status: 400 }
      );
    }

    // 1. Auth check — admin or owner required
    const authResult = await requireOrgRole(request, org_id, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 2. Fetch the audit package — verify ownership
    const { data: pkg, error: pkgError } = await adminSupabase
      .from('audit_packages')
      .select('*')
      .eq('id', package_id)
      .eq('org_id', org_id)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Audit package not found' }, { status: 404 });
    }

    // Accept draft, under_review, and clarification_requested (resend case)
    if (pkg.status === 'verified') {
      return NextResponse.json(
        { error: 'This package has already been verified and cannot be resubmitted' },
        { status: 409 }
      );
    }

    // 3. Generate auditor access token (base64url-encoded JSON — no DB storage needed)
    const tokenPayload = {
      package_id,
      org_id,
      auditor_email: pkg.auditor_email,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenio.co';
    const reviewUrl = `${appUrl}/audit/review?token=${token}`;

    // 4. Update package status (only transition from draft → under_review; resends keep current status)
    const updatePayload: Record<string, any> = {
      submitted_at: new Date().toISOString(),
    };
    if (pkg.status === 'draft') {
      updatePayload.status = 'under_review';
    }

    const { error: updateError } = await adminSupabase
      .from('audit_packages')
      .update(updatePayload)
      .eq('id', package_id);

    if (updateError) {
      console.error('[audit/submit] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch org name for email
    const { data: orgRow } = await adminSupabase
      .from('organisations')
      .select('name')
      .eq('id', org_id)
      .single();
    const orgName = orgRow?.name ?? 'the organisation';

    // Fetch site name if set
    let siteName = 'All sites';
    if (pkg.site_id) {
      const { data: siteRow } = await adminSupabase
        .from('sites')
        .select('name')
        .eq('id', pkg.site_id)
        .single();
      if (siteRow?.name) siteName = siteRow.name;
    }

    const submittedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const isResend = pkg.status !== 'draft';

    // 5. Send audit invitation email
    await transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: pkg.auditor_email,
      subject: `Audit package ready for review — ${orgName} FY${pkg.financial_year}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Audit Package — ${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Georgia',serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr>
      <td align="center">

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
                    <p style="margin:0;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Audit Review Request</p>
                    <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                      ${isResend ? 'Audit package link resent' : 'Audit package ready for your review'}
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
                Hi ${pkg.auditor_name},
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                <strong>${orgName}</strong> has submitted their emissions data for your review. Please use the link below to access and review the audit package.
              </p>

              <!-- Summary table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:24px;margin:0 0 32px;">
                <tr><td>
                  <p style="margin:0 0 14px;color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;">Package details</p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#374151;width:120px;">Organisation</td>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;font-weight:600;">${orgName}</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">Site</td>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;font-weight:600;">${siteName}</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">Financial Year</td>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;font-weight:600;">FY ${pkg.financial_year}</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">Submitted</td>
                      <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;font-weight:600;">${submittedDate}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;">
                    <a href="${reviewUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.2px;">
                      Review Audit Package →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;color:#6b7280;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">
                This link is valid for 30 days. If you did not expect this email, you can safely ignore it.
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[audit/submit]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}