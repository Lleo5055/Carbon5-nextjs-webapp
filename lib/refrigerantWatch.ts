import { createClient } from '@supabase/supabase-js';
import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';
import { sendMail } from '@/lib/mailer';

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

  const { data: rowsRaw } = await supabase
    .from('emissions')
    .select('diesel_litres, petrol_litres, gas_kwh, lpg_kg, cng_kg, refrigerant_kg, refrigerant_code, total_co2e')
    .eq('user_id', userId)
    .eq('month', currentMonth);

  const rows = rowsRaw as {
    diesel_litres: number; petrol_litres: number; gas_kwh: number;
    lpg_kg: number; cng_kg: number; refrigerant_kg: number;
    refrigerant_code: string; total_co2e: number;
  }[] | null;

  if (!rows || rows.length === 0) return;

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('country, contact_email, company_name')
    .eq('id', userId)
    .single();

  const profile = profileRaw as {
    country: string; contact_email: string; company_name: string;
  } | null;

  const ef = getFactorsForCountry(profile?.country ?? 'GB');

  let totalRefrigCo2 = 0;
  let totalFuelCo2 = 0;

  for (const r of rows) {
    const refrig = calcRefrigerantCo2e(Number(r.refrigerant_kg ?? 0), r.refrigerant_code ?? 'GENERIC_HFC');
    const fuel =
      Number(r.diesel_litres ?? 0) * ef.diesel +
      Number(r.petrol_litres ?? 0) * ef.petrol +
      Number(r.gas_kwh ?? 0) * ef.gas +
      Number(r.lpg_kg ?? 0) * ef.lpgKg +
      Number(r.cng_kg ?? 0) * ef.cngKg;
    totalRefrigCo2 += refrig;
    totalFuelCo2 += fuel;
  }

  const totalScope1 = totalFuelCo2 + totalRefrigCo2;
  if (totalScope1 === 0) return;

  const refrigPct = (totalRefrigCo2 / totalScope1) * 100;
  if (refrigPct < threshold) return;

  let recipients: string[] = Array.isArray(settings?.refrigerant_recipients)
    ? settings.refrigerant_recipients.filter(Boolean)
    : [];
  if (recipients.length === 0 && profile?.contact_email) {
    recipients = [profile.contact_email];
  }
  if (recipients.length === 0) return;

  const companyName = profile?.company_name ?? 'Your organisation';
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await sendMail({
    to: recipients,
    subject: `Alert: Refrigerant emissions exceed ${threshold}% threshold - ${monthLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#0f371e;padding:24px 32px;border-radius:8px 8px 0 0">
          <img src="https://greenio.co/logogreenio.svg" alt="Greenio" height="32" />
        </div>
        <div style="background:#fff8f0;padding:32px;border:1px solid #f97316;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="color:#c2410c;margin:0 0 16px">Refrigerant emission alert</h2>
          <p style="color:#475a5a;line-height:1.6">
            Refrigerant leaks for <strong>${companyName}</strong> in <strong>${monthLabel}</strong> represent
            <strong style="color:#c2410c">${refrigPct.toFixed(1)}%</strong> of total Scope 1 emissions,
            exceeding your configured threshold of ${threshold}%.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
            <tr style="background:#f9fbf9">
              <td style="padding:8px 12px;border:1px solid #e2e8f0">Refrigerant CO2e</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">${(totalRefrigCo2 / 1000).toFixed(3)} tCO2e</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">Total Scope 1 CO2e</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">${(totalScope1 / 1000).toFixed(3)} tCO2e</td>
            </tr>
            <tr style="background:#fff8f0">
              <td style="padding:8px 12px;border:1px solid #e2e8f0">Refrigerant % of Scope 1</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#c2410c">${refrigPct.toFixed(1)}%</td>
            </tr>
          </table>
          <p style="color:#475a5a;line-height:1.6;margin-top:16px">
            We recommend scheduling a leak-detection inspection. Refrigerant leaks are typically the highest-impact
            and most cost-effective Scope 1 reduction available.
          </p>
          <a href="https://greenio.co/dashboard/emissions"
             style="display:inline-block;margin-top:20px;padding:12px 24px;background:#21884a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
            View emissions dashboard
          </a>
          <p style="color:#94a3a0;font-size:12px;margin-top:32px">
            You're receiving this because refrigerant watch is enabled in your Greenio account.
            <a href="https://greenio.co/dashboard" style="color:#21884a">Manage settings</a>
          </p>
        </div>
      </div>
    `,
  });
}
