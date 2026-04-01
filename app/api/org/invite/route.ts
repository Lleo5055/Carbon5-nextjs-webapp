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
    // 1. Parse and validate body
    const body = await request.json();
    const { org_id, email: rawEmail, role } = body;
    const email = (rawEmail ?? '').trim().toLowerCase();

    if (!org_id || !email || !role) {
      return NextResponse.json({ error: 'org_id, email, and role are required' }, { status: 400 });
    }
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin, member, or viewer' }, { status: 400 });
    }

    // 3. Verify requesting user is owner or admin of this org
    const authResult = await requireOrgRole(request, org_id, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = { id: authResult.userId };

    // 4. Look up org name for the email
    const { data: orgRow } = await adminSupabase
      .from('organisations')
      .select('name')
      .eq('id', org_id)
      .single();
    const orgName = orgRow?.name ?? 'your organisation';

    // 5. Try to find existing user by email to check for duplicate membership
    const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );
    const foundUserId = existingAuthUser?.id ?? null;

    if (foundUserId) {
      const { data: existingMember } = await adminSupabase
        .from('org_members')
        .select('id, status')
        .eq('org_id', org_id)
        .eq('user_id', foundUserId)
        .maybeSingle();

      if (existingMember && existingMember.status !== 'suspended') {
        return NextResponse.json({ error: 'Already a member' }, { status: 409 });
      }
    }

    // 6. Generate magic link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenio.co';
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/organisation/enterprise`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[org/invite] magic link error:', linkError);
      return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 });
    }

    const magicLink = linkData.properties.action_link;

    // 7. Insert org_members row
    const { error: insertError } = await adminSupabase
      .from('org_members')
      .insert({
        org_id,
        user_id: foundUserId,
        role,
        status: 'pending',
        invited_at: new Date().toISOString(),
        joined_at: null,
        entity_access: null,
        invited_email: email,
      });

    if (insertError) {
      console.error('[org/invite] insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create invite record' }, { status: 500 });
    }

    // 8. Send invite email
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    await transporter.sendMail({
      from: '"Greenio" <hello@greenio.co>',
      to: email,
      subject: `You've been invited to join ${orgName} on Greenio`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're invited to ${orgName} on Greenio</title>
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
                    <p style="margin:0;color:#16a34a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Invitation</p>
                    <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                      You've been invited to join ${orgName}
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
                You have been invited to join <strong>${orgName}</strong> on Greenio as a <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                Click the button below to accept your invitation and access the organisation dashboard.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;">
                    <a href="${magicLink}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.2px;">
                      Accept invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;color:#6b7280;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">
                This link expires in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
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
    console.error('[org/invite]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}