import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/mailer';
import { GET as snapshotGet } from '@/app/api/snapshot/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = auth?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Fetch all users with snapshot enabled
  const { data: settings, error } = await supabase
    .from('notification_settings')
    .select('user_id, snapshot_recipients')
    .eq('snapshot_enabled', true);

  if (error) {
    console.error('[LEADERSHIP-SNAPSHOT] fetch settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const setting of settings ?? []) {
    const { user_id, snapshot_recipients } = setting;

    try {
      // Determine recipients - fall back to profile contact_email
      let recipients: string[] = Array.isArray(snapshot_recipients) ? snapshot_recipients.filter(Boolean) : [];
      if (recipients.length === 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('contact_email, company_name')
          .eq('id', user_id)
          .single();
        if (profile?.contact_email) recipients = [profile.contact_email];
      }
      if (recipients.length === 0) continue;

      // Fetch company name for filename
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', user_id)
        .single();
      const companyName = profile?.company_name ?? 'Greenio';
      const safeCompany = companyName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      // Call the existing snapshot GET handler to generate the PDF
      const snapshotUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenio.co'}/api/snapshot`);
      snapshotUrl.searchParams.set('userId', user_id);
      snapshotUrl.searchParams.set('periodType', 'quick');
      snapshotUrl.searchParams.set('period', '12M');

      const snapshotReq = new NextRequest(snapshotUrl.toString(), { method: 'GET' });
      const snapshotRes = await snapshotGet(snapshotReq);

      if (!snapshotRes.ok) {
        console.error(`[LEADERSHIP-SNAPSHOT] PDF gen failed for ${user_id}:`, snapshotRes.status);
        failed++;
        continue;
      }

      const pdfBuffer = Buffer.from(await snapshotRes.arrayBuffer());
      const now = new Date();
      const monthLabel = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`; // previous month

      await sendMail({
        to: recipients,
        subject: `${companyName} - Leadership Snapshot for ${monthLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#0f371e;padding:24px 32px;border-radius:8px 8px 0 0">
              <img src="https://greenio.co/logogreenio.svg" alt="Greenio" height="32" />
            </div>
            <div style="background:#f9fbf9;padding:32px;border:1px solid #d2e1d7;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="color:#0f371e;margin:0 0 16px">Your monthly emissions snapshot</h2>
              <p style="color:#475a5a;line-height:1.6">
                Your <strong>${monthLabel}</strong> Leadership Snapshot is attached.
                It includes your total CO2e, scope breakdown, trend analysis, and AI-powered insights.
              </p>
              <a href="https://greenio.co/dashboard/emissions/view-emissions"
                 style="display:inline-block;margin-top:20px;padding:12px 24px;background:#21884a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                View dashboard
              </a>
              <p style="color:#94a3a0;font-size:12px;margin-top:32px">
                You're receiving this because monthly snapshots are enabled in your Greenio account.
                <a href="https://greenio.co/dashboard" style="color:#21884a">Manage settings</a>
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `${safeCompany}-snapshot.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      sent++;
    } catch (err) {
      console.error(`[LEADERSHIP-SNAPSHOT] error for user ${user_id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
