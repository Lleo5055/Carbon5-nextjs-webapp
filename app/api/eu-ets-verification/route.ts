import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EU_COUNTRIES_SET = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

function safe(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function sanitize(s: string): string {
  return (s ?? '').split('').filter(c => c.charCodeAt(0) <= 0xff).join('');
}

function fmt(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '\u2014';
  return v.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');
    const installationId = searchParams.get('installationId');
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
    const format = (searchParams.get('format') ?? 'pdf') as 'pdf' | 'csv' | 'json';

    if (!userId) return new NextResponse('Missing userId', { status: 400 });
    if (!token) return new NextResponse('Unauthorized', { status: 401 });
    if (!installationId) return new NextResponse('Missing installationId', { status: 400 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) return new NextResponse('Unauthorized', { status: 401 });

    // Load profile (EU guard)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!EU_COUNTRIES_SET.has(profile?.country ?? '')) {
      return new NextResponse('EU ETS verification is only available for EU accounts', { status: 403 });
    }

    // Load installation (ownership check)
    const { data: installation, error: instErr } = await supabase
      .from('eu_ets_installations')
      .select('*')
      .eq('id', installationId)
      .eq('profile_id', userId)
      .single();

    if (instErr || !installation) {
      return new NextResponse('Installation not found', { status: 404 });
    }

    // Load verification for the given year
    const { data: verification } = await supabase
      .from('eu_ets_verifications')
      .select('*')
      .eq('installation_id', installationId)
      .eq('reporting_year', year)
      .maybeSingle();

    // Load emissions for the year
    const { data: emissionsRaw } = await supabase
      .from('emissions')
      .select('month, electricity_kw, diesel_litres, petrol_litres, gas_kwh, total_co2e')
      .eq('user_id', userId)
      .like('month', `${year}-%`)
      .order('month', { ascending: true });

    const emissions = emissionsRaw ?? [];
    const totalAccountEmissions = emissions.reduce((s, r) => s + safe(r.total_co2e), 0);

    // ---- JSON ----
    if (format === 'json') {
      const body = JSON.stringify({
        scheme: 'EU ETS',
        reporting_year: year,
        generated_at: new Date().toISOString(),
        organisation: {
          name: sanitize(profile.company_name ?? ''),
          country: profile.country,
        },
        installation: {
          id: installation.id,
          name: installation.installation_name,
          permit_number: installation.permit_number,
          activity_type: installation.activity_type,
          address: installation.address ?? null,
          postcode: installation.postcode ?? null,
          thermal_input_mw: installation.thermal_input_mw ?? null,
          monitoring_methodology: installation.monitoring_methodology ?? null,
        },
        verification: verification ?? null,
        account_emissions_summary: {
          year,
          total_co2e_tonne: totalAccountEmissions,
          months: emissions.length,
        },
      }, null, 2);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="eu-ets-verification-${installation.permit_number}-${year}.json"`,
        },
      });
    }

    // ---- CSV ----
    if (format === 'csv') {
      const rows = [
        ['Field', 'Value'],
        ['Scheme', 'EU ETS'],
        ['Reporting Year', String(year)],
        ['Generated At', new Date().toISOString()],
        [''],
        ['--- INSTALLATION ---'],
        ['Installation Name', installation.installation_name],
        ['Permit Number', installation.permit_number],
        ['Activity Type', installation.activity_type],
        ['Address', installation.address ?? ''],
        ['Postcode', installation.postcode ?? ''],
        ['Thermal Input (MW)', installation.thermal_input_mw ?? ''],
        ['Monitoring Methodology', installation.monitoring_methodology ?? ''],
        [''],
        ['--- VERIFICATION ---'],
        ['Status', verification?.status ?? 'No record'],
        ['Verification Body', verification?.verification_body ?? ''],
        ['Lead Verifier', verification?.verifier_name ?? ''],
        ['Verifier Accreditation', verification?.verifier_accreditation ?? ''],
        ['Verification Opinion', verification?.verification_opinion ?? ''],
        ['Material Misstatements', verification?.material_misstatements ? 'Yes' : 'No'],
        ['Submitted At', verification?.submitted_at ?? ''],
        ['Verified At', verification?.verified_at ?? ''],
        [''],
        ['--- EMISSIONS & ALLOWANCES ---'],
        ['Verified Emissions (tCO2e)', verification?.verified_emissions ?? ''],
        ['Free Allocation (EUAs)', verification?.free_allocation ?? ''],
        ['Purchased Allowances (EUAs)', verification?.purchased_allowances ?? ''],
        ['Surrendered Allowances (EUAs)', verification?.surrendered_allowances ?? ''],
        ['Net Position (EUAs)', verification ? String(safe(verification.free_allocation) + safe(verification.purchased_allowances) - safe(verification.surrendered_allowances)) : ''],
        ['Surrender Deadline', verification?.surrender_deadline ?? ''],
        ['Surrender Status', verification?.surrender_status ?? ''],
        [''],
        ['--- FINDINGS ---'],
        ['Notes', verification?.findings ?? ''],
      ];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="eu-ets-verification-${installation.permit_number}-${year}.csv"`,
        },
      });
    }

    // ---- PDF ----
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PW = 595, PH = 842;
    const ML = 44, MR = 551, CW = MR - ML;

    const page = pdfDoc.addPage([PW, PH]);
    let y = PH - 44;

    const text = (t: string, x: number, yy: number, size = 9, f = font, color = rgb(0.2, 0.2, 0.2)) => {
      page.drawText(sanitize(t), { x, y: yy, size, font: f, color });
    };
    const line = (yy: number, x1 = ML, x2 = MR, thick = 0.5, col = rgb(0.85, 0.85, 0.85)) => {
      page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: thick, color: col });
    };
    const section = (title: string) => {
      y -= 14;
      page.drawRectangle({ x: ML, y: y - 3, width: CW, height: 16, color: rgb(0.96, 0.97, 1.0) });
      text(title.toUpperCase(), ML + 6, y + 5, 7.5, bold, rgb(0.2, 0.35, 0.65));
      y -= 8;
      line(y);
      y -= 10;
    };
    const row = (label: string, value: string) => {
      text(label, ML, y, 8.5, font, rgb(0.45, 0.45, 0.45));
      text(value, ML + 155, y, 8.5, bold, rgb(0.15, 0.15, 0.15));
      y -= 15;
    };

    // Header band — EU blue
    page.drawRectangle({ x: 0, y: PH - 52, width: PW, height: 52, color: rgb(0.1, 0.2, 0.55) });
    text('EU EMISSIONS TRADING SYSTEM', ML, PH - 22, 9, bold, rgb(0.75, 0.85, 1.0));
    text('Verification Report', ML, PH - 36, 13, bold, rgb(1, 1, 1));
    text(`Reporting Year: ${year}`, MR - 90, PH - 22, 8, font, rgb(0.75, 0.85, 1.0));
    text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, MR - 90, PH - 36, 8, font, rgb(0.75, 0.85, 1.0));

    y = PH - 72;

    // Organisation
    section('Organisation');
    row('Company', sanitize(profile.company_name ?? ''));
    row('Country', profile.country ?? '');

    // Installation
    section('Installation');
    row('Installation Name', sanitize(installation.installation_name));
    row('Permit Number', installation.permit_number);
    row('Activity Type', installation.activity_type.replace(/_/g, ' '));
    if (installation.address) row('Address', sanitize(installation.address));
    if (installation.postcode) row('Postcode', installation.postcode);
    if (installation.thermal_input_mw != null) row('Thermal Input', `${installation.thermal_input_mw} MW`);
    if (installation.monitoring_methodology) row('Monitoring Methodology', sanitize(installation.monitoring_methodology));

    // Verification
    section('Verification Details');
    if (!verification) {
      text('No verification record exists for this installation and year.', ML, y, 8.5, font, rgb(0.5, 0.5, 0.5));
      y -= 15;
    } else {
      const statusLabel = (verification.status as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      row('Status', statusLabel);
      row('Verification Body', sanitize(verification.verification_body ?? '\u2014'));
      row('Lead Verifier', sanitize(verification.verifier_name ?? '\u2014'));
      row('Verifier Accreditation', verification.verifier_accreditation ?? '\u2014');
      const opinionMap: Record<string, string> = {
        reasonable_assurance: 'Reasonable Assurance',
        limited_assurance: 'Limited Assurance',
        adverse: 'Adverse Opinion',
        disclaimed: 'Disclaimed Opinion',
      };
      row('Verification Opinion', opinionMap[verification.verification_opinion ?? ''] ?? (verification.verification_opinion ?? '\u2014'));
      row('Material Misstatements', verification.material_misstatements ? 'Yes' : 'No');
      if (verification.submitted_at) row('Submitted', new Date(verification.submitted_at).toLocaleDateString('en-GB'));
      if (verification.verified_at) row('Verified', new Date(verification.verified_at).toLocaleDateString('en-GB'));
    }

    // Emissions & Allowances
    section('Emissions & Allowances');
    if (!verification) {
      text('No data.', ML, y, 8.5, font, rgb(0.5, 0.5, 0.5));
      y -= 15;
    } else {
      const ve = safe(verification.verified_emissions);
      const fa = safe(verification.free_allocation);
      const pa = safe(verification.purchased_allowances);
      const sa = safe(verification.surrendered_allowances);
      const position = fa + pa - sa;

      row('Verified Emissions', `${fmt(ve, 2)} tCO\u2082e`);
      row('Free Allocation', `${fmt(fa)} EUAs`);
      row('Purchased Allowances', `${fmt(pa)} EUAs`);
      row('Surrendered Allowances', `${fmt(sa)} EUAs`);

      y -= 2;
      line(y + 13);
      const posColor = position >= 0 ? rgb(0.05, 0.5, 0.25) : rgb(0.75, 0.1, 0.1);
      text('Net Position', ML, y, 8.5, font, rgb(0.45, 0.45, 0.45));
      const posStr = `${position >= 0 ? '+' : ''}${fmt(position)} EUAs`;
      text(posStr, ML + 155, y, 9, bold, posColor);
      y -= 15;

      if (verification.surrender_deadline) row('Surrender Deadline', new Date(verification.surrender_deadline).toLocaleDateString('en-GB'));
      if (verification.surrender_status) row('Surrender Status', verification.surrender_status.charAt(0).toUpperCase() + verification.surrender_status.slice(1));

      if (position < 0) {
        y -= 4;
        const penalty = Math.abs(position) * 100;
        page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 32, color: rgb(1, 0.95, 0.95), borderColor: rgb(0.9, 0.75, 0.75), borderWidth: 0.5 });
        text('PENALTY RISK', ML + 6, y + 3, 7.5, bold, rgb(0.75, 0.1, 0.1));
        text(`${fmt(Math.abs(position))} EUA shortfall x \u20ac100/tonne = \u20ac${fmt(penalty)} exposure`, ML + 6, y - 10, 8, font, rgb(0.55, 0.1, 0.1));
        y -= 34;
      }
    }

    // Findings
    if (verification?.findings) {
      section('Findings / Notes');
      const words = sanitize(verification.findings).split(' ');
      let line1 = '';
      const lines: string[] = [];
      for (const w of words) {
        const test = line1 ? `${line1} ${w}` : w;
        if (font.widthOfTextAtSize(test, 8.5) > CW - 10) {
          lines.push(line1);
          line1 = w;
        } else {
          line1 = test;
        }
      }
      if (line1) lines.push(line1);
      for (const l of lines) {
        text(l, ML + 6, y, 8.5, font, rgb(0.2, 0.2, 0.2));
        y -= 13;
      }
    }

    // Footer
    page.drawLine({ start: { x: ML, y: 32 }, end: { x: MR, y: 32 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    text('This document is generated from Greenio. It is not a substitute for official EU ETS national authority compliance submissions.', ML, 20, 7, font, rgb(0.55, 0.55, 0.55));

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="eu-ets-verification-${installation.permit_number}-${year}.pdf"`,
      },
    });

  } catch (err: any) {
    console.error('[eu-ets-verification]', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}