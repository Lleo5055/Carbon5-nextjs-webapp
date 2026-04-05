import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/mailer';

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

  // Current month bounds e.g. "2026-04-01" to "2026-04-30"
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Fetch all users with reminder enabled
  const { data: settings, error } = await supabase
    .from('notification_settings')
    .select('user_id, reminder_recipients')
    .eq('reminder_enabled', true);

  if (error) {
    console.error('[LOGGING-REMINDER] fetch settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const setting of settings ?? []) {
    const { user_id, reminder_recipients } = setting;

    // Check if any emission row exists for this month
    const { count } = await supabase
      .from('emissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('month', monthStart)
      .lte('month', monthEnd);

    if ((count ?? 0) > 0) {
      skipped++;
      continue; // data already logged — no nudge needed
    }

    // Determine recipients — fall back to profile contact_email
    let recipients: string[] = Array.isArray(reminder_recipients) ? reminder_recipients.filter(Boolean) : [];
    if (recipients.length === 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_email')
        .eq('id', user_id)
        .single();
      if (profile?.contact_email) recipients = [profile.contact_email];
    }

    if (recipients.length === 0) continue;

    await sendMail({
      to: recipients,
      subject: `Reminder: Log your emissions for ${monthLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0f371e;padding:24px 32px;border-radius:8px 8px 0 0">
            <img src="https://greenio.co/logogreenio.svg" alt="Greenio" height="32" />
          </div>
          <div style="background:#f9fbf9;padding:32px;border:1px solid #d2e1d7;border-top:none;border-radius:0 0 8px 8px">
            <h2 style="color:#0f371e;margin:0 0 16px">Monthly emissions data not yet logged</h2>
            <p style="color:#475a5a;line-height:1.6">
              We noticed you haven't logged your emissions data for <strong>${monthLabel}</strong> yet.
              Keeping your data up to date ensures accurate BRSR, SECR and CSRD reporting.
            </p>
            <a href="https://greenio.co/dashboard/emissions/add"
               style="display:inline-block;margin-top:20px;padding:12px 24px;background:#21884a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
              Log emissions now
            </a>
            <p style="color:#94a3a0;font-size:12px;margin-top:32px">
              You're receiving this because logging reminders are enabled in your Greenio account.
              <a href="https://greenio.co/dashboard" style="color:#21884a">Manage settings</a>
            </p>
          </div>
        </div>
      `,
    });

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
