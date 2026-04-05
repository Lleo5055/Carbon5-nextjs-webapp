import { createClient } from '@supabase/supabase-js';
import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';
import { sendMail } from '@/lib/mailer';

type EmissionRow = {
  diesel_litres: number; petrol_litres: number; gas_kwh: number;
  lpg_kg: number; cng_kg: number; refrigerant_kg: number;
  refrigerant_code: string; total_co2e: number;
};

function calcScope1(rows: EmissionRow[], ef: ReturnType<typeof getFactorsForCountry>) {
  let refrigCo2 = 0;
  let fuelCo2 = 0;
  for (const r of rows) {
    refrigCo2 += calcRefrigerantCo2e(Number(r.refrigerant_kg ?? 0), r.refrigerant_code ?? 'GENERIC_HFC');
    fuelCo2 +=
      Number(r.diesel_litres ?? 0) * ef.diesel +
      Number(r.petrol_litres ?? 0) * ef.petrol +
      Number(r.gas_kwh ?? 0) * ef.gas +
      Number(r.lpg_kg ?? 0) * ef.lpgKg +
      Number(r.cng_kg ?? 0) * ef.cngKg;
  }
  return { refrigCo2, fuelCo2, total: fuelCo2 + refrigCo2 };
}

export async function checkRefrigerantWatch(
  supabase: ReturnType<typeof createClient<any>>,
  userId: string
) {
  const { data: settingsRaw } = await supabase
    .from('notification_settings')
    .select('refrigerant_watch_enabled, refrigerant_threshold_pct, refrigerant_recipients')
    .eq('user_id', userId)
    .single();

  const settings = settingsRaw as {
    refrigerant_watch_enabled: boolean;
    refrigerant_threshold_pct: number;
    refrigerant_recipients: string[];
  } | null;

  if (!settings?.refrigerant_watch_enabled) return;

  const threshold = Number(settings.refrigerant_threshold_pct ?? 15);

  const now = new Date();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentMonth = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('country, contact_email, company_name')
    .eq('id', userId)
    .single();

  const profile = profileRaw as {
    country: string; contact_email: string; company_name: string;
  } | null;

  const ef = getFactorsForCountry(profile?.country ?? 'GB');

  // Current month data
  const { data: monthRowsRaw } = await supabase
    .from('emissions')
    .select('diesel_litres, petrol_litres, gas_kwh, lpg_kg, cng_kg, refrigerant_kg, refrigerant_code, total_co2e')
    .eq('user_id', userId)
    .eq('month', currentMonth);

  const monthRows = (monthRowsRaw ?? []) as EmissionRow[];

  // All time data
  const { data: allRowsRaw } = await supabase
    .from('emissions')
    .select('diesel_litres, petrol_litres, gas_kwh, lpg_kg, cng_kg, refrigerant_kg, refrigerant_code, total_co2e')
    .eq('user_id', userId);

  const allRows = (allRowsRaw ?? []) as EmissionRow[];

  if (monthRows.length === 0 && allRows.length === 0) return;

  const month = calcScope1(monthRows, ef);
  const all = calcScope1(allRows, ef);

  // Trigger if either current month OR all-time exceeds threshold
  const monthPct = month.total > 0 ? (month.refrigCo2 / month.total) * 100 : 0;
  const allPct = all.total > 0 ? (all.refrigCo2 / all.total) * 100 : 0;

  if (monthPct < threshold && allPct < threshold) return;

  let recipients: string[] = Array.isArray(settings?.refrigerant_recipients)
    ? settings.refrigerant_recipients.filter(Boolean)
    : [];
  if (recipients.length === 0 && profile?.contact_email) {
    recipients = [profile.contact_email];
  }
  if (recipients.length === 0) return;

  const companyName = profile?.company_name || 'Your organisation';

  await sendMail({
    to: recipients,
    subject: `Refrigerant alert: emissions exceed ${threshold}% threshold - ${currentMonth}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Georgia',serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:28px 40px 20px;border-bottom:3px solid #ea580c;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="https://greenio.co/logogreenio.svg" alt="Greenio" width="200" style="display:block;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:28px;">
                    <p style="margin:0;color:#ea580c;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Refrigerant Watch Alert</p>
                    <h1 style="margin:8px 0 0;color:#0a3d2e;font-size:26px;font-weight:normal;line-height:1.3;font-family:'Georgia',serif;">
                      Refrigerant emissions threshold exceeded
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar - same as confirmation but orange -->
          <tr>
            <td style="background:linear-gradient(90deg,#ea580c,#fb923c);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                Refrigerant emissions for <strong>${companyName}</strong> have exceeded your configured alert threshold of <strong>${threshold}%</strong> of total Scope 1 emissions.
              </p>
              <p style="margin:0 0 28px;color:#374151;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;">
                We recommend scheduling a leak-detection inspection as soon as possible.
              </p>

              <!-- This month -->
              <p style="margin:0 0 10px;color:#ea580c;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">This month &mdash; ${currentMonth}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;margin-bottom:28px;">
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Refrigerant CO2e</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#0a3d2e;text-align:right;">${(month.refrigCo2 / 1000).toFixed(3)} tCO2e</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Total Scope 1 CO2e</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#0a3d2e;text-align:right;">${(month.total / 1000).toFixed(3)} tCO2e</td>
                </tr>
                <tr style="background:#fff7ed;">
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Refrigerant % of Scope 1</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#c2410c;text-align:right;">${monthPct.toFixed(1)}%</td>
                </tr>
              </table>

              <!-- All time -->
              <p style="margin:0 0 10px;color:#ea580c;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">All time</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;margin-bottom:32px;">
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Refrigerant CO2e</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#0a3d2e;text-align:right;">${(all.refrigCo2 / 1000).toFixed(3)} tCO2e</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Total Scope 1 CO2e</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#0a3d2e;text-align:right;">${(all.total / 1000).toFixed(3)} tCO2e</td>
                </tr>
                <tr style="background:#fff7ed;">
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">Refrigerant % of Scope 1</td>
                  <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#c2410c;text-align:right;">${allPct.toFixed(1)}%</td>
                </tr>
              </table>

              <!-- CTA - same style as confirmation -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;">
                    <a href="https://greenio.co/dashboard?uid=${userId}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.2px;">
                      View emissions dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/>
            </td>
          </tr>

          <!-- Footer - identical to confirmation email -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;font-family:Arial,sans-serif;">
                You're receiving this because refrigerant watch is enabled in your Greenio account.
              </p>
              <p style="margin:0 0 12px;color:#9ca3af;font-size:12px;font-family:Arial,sans-serif;">
                Questions? Reply to <a href="mailto:hello@greenio.co" style="color:#16a34a;text-decoration:none;">hello@greenio.co</a>
                &nbsp;&middot;&nbsp;
                <a href="https://greenio.co/dashboard" style="color:#16a34a;text-decoration:none;">Manage settings</a>
              </p>
              <p style="margin:0;color:#d1d5db;font-size:11px;font-family:Arial,sans-serif;">
                &copy; 2026 Greenio &middot; Carbon accounting intelligence
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`,
  });
}
