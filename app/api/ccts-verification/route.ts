import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safe(v: any) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function GET(req: NextRequest) {
  try {
    // Create client inside handler — avoids stale module-level instance
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');
    const format = (searchParams.get('format') ?? 'pdf') as 'pdf' | 'csv' | 'json';
    const periodType = searchParams.get('periodType');
    const period = searchParams.get('period');
    const fyYear = searchParams.get('fyYear');
    let startMonth = searchParams.get('start');
    let endMonth = searchParams.get('end');

    // Auth
    if (!userId) return new NextResponse('Missing userId', { status: 400 });
    if (!token) return new NextResponse('Unauthorized', { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) return new NextResponse('Unauthorized', { status: 401 });

    // Quick period calculation
    if (periodType === 'quick' && period && period !== 'All' && !startMonth && !endMonth) {
      const months = Number(period.replace('M', ''));
      if (!isNaN(months)) {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        const start = new Date(end);
        start.setMonth(start.getMonth() - (months - 1));
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        startMonth = fmt(start);
        endMonth = fmt(end);
      }
    }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Verify India
    if (profile?.country !== 'IN') {
      return new NextResponse('CCTS verification is only available for India accounts', { status: 403 });
    }

    // Load all data in parallel
    const [
      { data: emissionsRaw, error: emissionsError },
      { data: scope3Raw },
      { data: locksRaw },
      { data: targetsRaw },
      { data: productionRaw },
    ] = await Promise.all([
      supabase.from('emissions').select('*').eq('user_id', userId).order('month_key', { ascending: true }),
      supabase.from('scope3_activities').select('*').eq('user_id', userId).order('month', { ascending: true }),
      supabase.from('report_locks').select('month, locked, locked_at, emission_ids, scope3_ids').eq('user_id', userId),
      supabase.from('org_targets').select('*').eq('user_id', userId).order('compliance_year', { ascending: true }),
      supabase.from('production_entries').select('*').eq('user_id', userId).order('month_key', { ascending: true }),
    ]);

    if (emissionsError) return new NextResponse('Failed to load emissions', { status: 500 });

    const locksByMonth = new Map<string, any>();
    for (const lock of locksRaw ?? []) {
      locksByMonth.set(lock.month, lock);
    }

    // Period filter
    let emissions = emissionsRaw ?? [];
    let scope3 = scope3Raw ?? [];

    if (startMonth && endMonth) {
      emissions = emissions.filter(r => {
        const mk = (r.month_key ?? '').slice(0, 7); // normalize to YYYY-MM
        return mk >= startMonth! && mk <= endMonth!;
      });
      scope3 = scope3.filter(r => {
        if (!r.month) return false;
        const parts = r.month.split(' ');
        if (parts.length !== 2) return false;
        const MONTHS: Record<string, string> = {
          January: '01', February: '02', March: '03', April: '04',
          May: '05', June: '06', July: '07', August: '08',
          September: '09', October: '10', November: '11', December: '12',
        };
        const ym = `${parts[1]}-${MONTHS[parts[0]] ?? '01'}`;
        return ym >= startMonth! && ym <= endMonth!;
      });
    }

    const ef = getFactorsForCountry('IN');
    const companyName = profile?.company_name ?? 'Not provided';
    const industry = profile?.industry ?? 'Not provided';
    const empCount = Number(profile?.employee_count ?? 0);
    const revenue = Number(profile?.annual_revenue ?? 0);

    const reportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtYM = (ym: string) => {
      if (!ym) return '';
      const [y, m] = ym.split('-');
      return `${MONTH_ABBR[parseInt(m) - 1]} ${y}`;
    };
    const periodLabel = fyYear
      ? `FY ${fyYear} (Apr ${Number(fyYear) - 1} \u2013 Mar ${fyYear})`
      : startMonth && endMonth
      ? `${fmtYM(startMonth)} \u2013 ${fmtYM(endMonth)}`
      : 'All data';

    // Build assembled rows
    const assembledRows = emissions.map(r => {
      const lock = locksByMonth.get(r.month);
      const hasBreakdown = !!r.calc_breakdown;

      const elecKg = safe(r.electricity_kw) * (r.ef_electricity ?? ef.electricity);
      const dieselKg = safe(r.diesel_litres) * (r.ef_diesel ?? ef.diesel);
      const petrolKg = safe(r.petrol_litres) * (r.ef_petrol ?? ef.petrol);
      const gasKg = safe(r.gas_kwh) * (r.ef_gas ?? ef.gas);
      const lpgKg = safe(r.lpg_kg) * (r.ef_lpg ?? ef.lpgKg);
      const cngKg = safe(r.cng_kg) * (r.ef_cng ?? ef.cngKg);
      const refrigKg = calcRefrigerantCo2e(
        safe(r.refrigerant_kg),
        r.refrigerant_code ?? 'GENERIC_HFC'
      );
      const totalKg = elecKg + dieselKg + petrolKg + gasKg + lpgKg + cngKg + refrigKg;

      return {
        id: r.id,
        month: r.month,
        month_key: r.month_key,
        country_code: r.country_code ?? 'IN',
        data_source: r.data_source ?? 'manual',
        ef_version: r.ef_version ?? ef.version,
        electricity_kw: safe(r.electricity_kw),
        diesel_litres: safe(r.diesel_litres),
        petrol_litres: safe(r.petrol_litres),
        gas_kwh: safe(r.gas_kwh),
        lpg_kg: safe(r.lpg_kg),
        cng_kg: safe(r.cng_kg),
        refrigerant_kg: safe(r.refrigerant_kg),
        refrigerant_code: r.refrigerant_code ?? 'GENERIC_HFC',
        ef_electricity: r.ef_electricity ?? ef.electricity,
        ef_diesel: r.ef_diesel ?? ef.diesel,
        ef_petrol: r.ef_petrol ?? ef.petrol,
        ef_gas: r.ef_gas ?? ef.gas,
        ef_lpg: r.ef_lpg ?? ef.lpgKg,
        ef_cng: r.ef_cng ?? ef.cngKg,
        ef_refrigerant: r.ef_refrigerant ?? null,
        elec_co2e_kg: elecKg,
        diesel_co2e_kg: dieselKg,
        petrol_co2e_kg: petrolKg,
        gas_co2e_kg: gasKg,
        lpg_co2e_kg: lpgKg,
        cng_co2e_kg: cngKg,
        refrigerant_co2e_kg: refrigKg,
        total_co2e_kg: totalKg,
        calc_breakdown: r.calc_breakdown ?? null,
        has_full_audit_chain: hasBreakdown,
        lock_status: lock?.locked ? 'locked' : lock ? 'unlocked' : 'no_lock_record',
        locked_at: lock?.locked_at ?? null,
      };
    });

    // Remove ghost rows — months where only product output was saved, no actual emissions
    const assembledRowsFiltered = assembledRows.filter(r =>
      r.total_co2e_kg > 0 ||
      r.electricity_kw > 0 || r.diesel_litres > 0 || r.petrol_litres > 0 ||
      r.gas_kwh > 0 || r.lpg_kg > 0 || r.cng_kg > 0 || r.refrigerant_kg > 0
    );

    const scope3Assembled = scope3.map(r => ({
      id: r.id,
      month: r.month,
      category: r.category,
      label: r.label,
      co2e_kg: safe(r.co2e_kg),
      data_source: r.data_source ?? 'manual',
      data: r.data ?? {},
    }));

    const totalScope1ElecKg = assembledRowsFiltered.reduce((s, r) => s + r.elec_co2e_kg, 0);
    const totalScope1FuelKg = assembledRowsFiltered.reduce((s, r) => s + r.diesel_co2e_kg + r.petrol_co2e_kg + r.gas_co2e_kg + r.lpg_co2e_kg + r.cng_co2e_kg, 0);
    const totalScope1RefrigKg = assembledRowsFiltered.reduce((s, r) => s + r.refrigerant_co2e_kg, 0);
    const totalScope1Kg = totalScope1FuelKg + totalScope1RefrigKg;
    const totalScope2Kg = totalScope1ElecKg;
    const totalScope3Kg = scope3Assembled.reduce((s, r) => s + r.co2e_kg, 0);
    const totalAllKg = totalScope1Kg + totalScope2Kg + totalScope3Kg;

    const lockedCount = assembledRowsFiltered.filter(r => r.lock_status === 'locked').length;
    const auditChainCount = assembledRowsFiltered.filter(r => r.has_full_audit_chain).length;
    // Filter production entries to match the report period
    let productionEntries = productionRaw ?? [];
    if (startMonth && endMonth) {
      productionEntries = productionEntries.filter(r => {
        const mk = r.month_key?.slice(0, 7) ?? '';
        return mk >= startMonth! && mk <= endMonth!;
      });
    }
    const totalProductOutput = productionEntries.reduce((s, r) => s + safe(r.quantity), 0);
    const totalIntensity = totalProductOutput > 0 ? (totalAllKg / 1000) / totalProductOutput : null;

    // Normalized GEI — replaces current EF electricity with baseline EF for fair comparison
    // per BEE CCTS methodology: Scope 2 is recalculated using baseline year EF
    const primaryTarget = targetsRaw?.[0];
    const baselineEF = primaryTarget?.baseline_ef_electricity ?? null;
    const currentEF = ef.electricity;

    let totalNormalizedKg: number | null = null;
    let normalizedIntensity: number | null = null;

    if (baselineEF && baselineEF !== currentEF) {
      const totalElecKwh = assembledRowsFiltered.reduce((s, r) => s + r.electricity_kw, 0);
      const scope2Adjustment = totalElecKwh * (baselineEF - currentEF);
      totalNormalizedKg = totalAllKg + scope2Adjustment;
      normalizedIntensity = totalProductOutput > 0 ? (totalNormalizedKg / 1000) / totalProductOutput : null;
    } else {
      totalNormalizedKg = totalAllKg;
      normalizedIntensity = totalIntensity;
    }


    // ── JSON FORMAT ──
    if (format === 'json') {
      const payload = {
        document_type: 'CCTS_VERIFICATION_PACKAGE',
        schema_version: '1.0',
        generated_at: new Date().toISOString(),
        regulatory_reference: 'Carbon Credit Trading Scheme, 2023 (MoP S.O. 2825(E))',
        organisation: {
          name: companyName,
          industry,
          country: 'India',
          employee_count: empCount || null,
          annual_revenue_inr: revenue || null,
        },
        reporting_period: {
          label: periodLabel,
          start_month: startMonth,
          end_month: endMonth,
        },
        summary: {
          total_scope1_tco2e: +(totalScope1Kg / 1000).toFixed(4),
          total_scope2_tco2e: +(totalScope2Kg / 1000).toFixed(4),
          total_scope3_tco2e: +(totalScope3Kg / 1000).toFixed(4),
          total_all_scopes_tco2e: +(totalAllKg / 1000).toFixed(4),
          months_reported: assembledRowsFiltered.length,
          months_locked: lockedCount,
          rows_with_full_audit_chain: auditChainCount,
          total_product_output: totalProductOutput || null,
          actual_gei_tco2e_per_unit: totalIntensity,
        },
        emission_factor_sources: ef.version,
        emission_records: assembledRows,
        scope3_records: scope3Assembled,
      };

      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="CCTS-Verification-Package-${companyName.replace(/[^a-zA-Z0-9]/g, '-')}.json"`,
        },
      });
    }

    // ── CSV FORMAT ──
    if (format === 'csv') {
      const headers = [
        'Month', 'Row ID', 'Data Source', 'EF Version',
        'Electricity (kWh)', 'Diesel (L)', 'Petrol (L)', 'Gas (kWh)', 'LPG (kg)', 'CNG (kg)', 'Refrigerant (kg)', 'Refrigerant Code',
        'EF Electricity', 'EF Diesel', 'EF Petrol', 'EF Gas', 'EF LPG', 'EF CNG', 'EF Refrigerant',
        'Electricity CO2e (kg)', 'Diesel CO2e (kg)', 'Petrol CO2e (kg)', 'Gas CO2e (kg)', 'LPG CO2e (kg)', 'CNG CO2e (kg)', 'Refrigerant CO2e (kg)',
        'Total CO2e (kg)', 'Lock Status', 'Locked At', 'Full Audit Chain',
      ];

      const lines = assembledRowsFiltered.map(r => [
        r.month, r.id, r.data_source, r.ef_version,
        r.electricity_kw, r.diesel_litres, r.petrol_litres, r.gas_kwh, r.lpg_kg, r.cng_kg, r.refrigerant_kg, r.refrigerant_code,
        r.ef_electricity, r.ef_diesel, r.ef_petrol, r.ef_gas, r.ef_lpg, r.ef_cng, r.ef_refrigerant ?? '',
        r.elec_co2e_kg.toFixed(4), r.diesel_co2e_kg.toFixed(4), r.petrol_co2e_kg.toFixed(4),
        r.gas_co2e_kg.toFixed(4), r.lpg_co2e_kg.toFixed(4), r.cng_co2e_kg.toFixed(4), r.refrigerant_co2e_kg.toFixed(4),
        r.total_co2e_kg.toFixed(4), r.lock_status, r.locked_at ?? '', r.has_full_audit_chain ? 'Yes' : 'No (legacy row)',
      ].join(','));

      const s3Headers = ['', 'SCOPE 3 ACTIVITIES'];
      const s3ColHeaders = ['Month', 'Row ID', 'Category', 'Label', 'CO2e (kg)', 'Data Source'];
      const s3Lines = scope3Assembled.map(r => [
        r.month, r.id, r.category, `"${(r.label ?? '').replace(/"/g, '""')}"`, r.co2e_kg.toFixed(4), r.data_source,
      ].join(','));

      const summary = [
        '',
        'SUMMARY',
        `Organisation,${companyName}`,
        `Period,${periodLabel}`,
        `Total Scope 1 (tCO2e),${(totalScope1Kg / 1000).toFixed(4)}`,
        `Total Scope 2 (tCO2e),${(totalScope2Kg / 1000).toFixed(4)}`,
        `Total Scope 3 (tCO2e),${(totalScope3Kg / 1000).toFixed(4)}`,
        `Total All Scopes (tCO2e),${(totalAllKg / 1000).toFixed(4)}`,
        `Months Reported,${assembledRowsFiltered.length}`,
        `Months Locked,${lockedCount}`,
        `Rows with Full Audit Chain,${auditChainCount}`,
        `EF Sources,${ef.version}`,
        `Generated,${new Date().toISOString()}`,
        `Regulatory Reference,"Carbon Credit Trading Scheme, 2023 (MoP S.O. 2825(E))"`,
      ];

      const csv = [
        ...summary,
        '',
        'EMISSION RECORDS',
        headers.join(','),
        ...lines,
        '',
        s3Headers.join(','),
        s3ColHeaders.join(','),
        ...s3Lines,
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="CCTS-Verification-Package-${companyName.replace(/[^a-zA-Z0-9]/g, '-')}.csv"`,
        },
      });
    }

    // ── PDF FORMAT ──
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const GREEN = rgb(26/255, 122/255, 74/255);
    const TEXT = rgb(32/255, 32/255, 34/255);
    const GREY = rgb(0.5, 0.5, 0.52);
    const LIGHT = rgb(0.96, 0.96, 0.97);
    const DIVIDER = rgb(0.87, 0.87, 0.87);

    let pNum = 0;
    const addPage = () => { pNum++; return pdf.addPage([595, 842]); };
    const pgFtr = () => `Greenio · CCTS Verification Package · Page ${pNum}`;

    const drawText = (page: any, str: string, x: number, y: number, size: number, f: any, color = TEXT) => {
      page.drawText(str, { x, y, size, font: f, color });
    };

    // PAGE 1: Cover
    let page = addPage();
    let y = 780;

    drawText(page, 'CCTS VERIFICATION PACKAGE', 50, y, 20, bold, GREEN);
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: GREEN });
    y -= 28;

    drawText(page, 'Carbon Credit Trading Scheme: Audit-Ready Emission Data', 50, y, 12, font, GREY);
    y -= 36;

    const metaRows = [
      ['Organisation', companyName],
      ['Industry', industry],
      ['Country', 'India'],
      ['Reporting period', periodLabel],
      ...(fyYear ? [['Compliance year', `FY ${fyYear}: Carbon Credit Trading Scheme, 2023`]] : []),
      ['Report date', reportDate],
      ['Regulatory reference', 'Carbon Credit Trading Scheme, 2023 (MoP S.O. 2825(E))'],
      ['Emission factor sources', ef.version.split(' | ')[0]],
      ['Prepared by', 'Greenio Carbon Accounting Platform'],
    ];

    for (const [label, value] of metaRows) {
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: LIGHT });
      page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: DIVIDER });
      drawText(page, label, 55, y - 6, 9, bold, TEXT);
      drawText(page, value, 230, y - 6, 9, font, TEXT);
      y -= 24;
    }

    y -= 20;

    page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
    drawText(page, 'Emissions Summary', 55, y - 10, 10, bold, rgb(1, 1, 1));
    drawText(page, 'Value', 400, y - 10, 10, bold, rgb(1, 1, 1));
    y -= 26;

    const summaryRows = [
      ['Total Scope 1 emissions (Fuels & Refrigerants)', `${(totalScope1Kg / 1000).toFixed(3)} tCO2e`],
      ['Total Scope 2 emissions (Electricity)', `${(totalScope2Kg / 1000).toFixed(3)} tCO2e`],
      ['Total Scope 3 emissions (Value chain)', `${(totalScope3Kg / 1000).toFixed(3)} tCO2e`],
      ['Total all scopes', `${(totalAllKg / 1000).toFixed(3)} tCO2e`],
      ['Months in this package', String(assembledRowsFiltered.length)],
      ['Months locked & verified', `${lockedCount} of ${assembledRowsFiltered.length}`],
      ['Rows with full audit chain', `${auditChainCount} of ${assembledRowsFiltered.length}`],
    ];

    let shade = false;
    for (const [label, value] of summaryRows) {
      const bg = shade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: bg });
      page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: DIVIDER });
      drawText(page, label, 55, y - 6, 9.5, font, TEXT);
      drawText(page, value, 400, y - 6, 9.5, bold, GREEN);
      shade = !shade;
      y -= 24;
    }

    y -= 20;

    const noticeColor = auditChainCount === assembledRowsFiltered.length ? rgb(0.9, 0.97, 0.92) : rgb(0.99, 0.97, 0.88);
    const noticeBorder = auditChainCount === assembledRowsFiltered.length ? GREEN : rgb(0.85, 0.6, 0);
    const noticeText = auditChainCount === assembledRowsFiltered.length
      ? 'All emission records in this package contain a full audit chain (input quantities, emission factors applied, and calculated outputs). This package is ready for ACVA review.'
      : `${auditChainCount} of ${assembledRowsFiltered.length} records contain a full audit chain. ${assembledRowsFiltered.length - auditChainCount} legacy records show recalculated values using current factors. Factor snapshots are available only for records submitted after 16 March 2026.`;

    page.drawRectangle({ x: 45, y: y - 40, width: 510, height: 44, color: noticeColor });
    page.drawRectangle({ x: 45, y: y - 40, width: 4, height: 44, color: noticeBorder });

    const noticeWords = noticeText.split(' ');
    let noticeLine = '';
    let noticeY = y - 14;
    for (const w of noticeWords) {
      const test = noticeLine ? noticeLine + ' ' + w : w;
      if (font.widthOfTextAtSize(test, 8.5) > 490) {
        drawText(page, noticeLine, 56, noticeY, 8.5, font, TEXT);
        noticeY -= 13;
        noticeLine = w;
      } else { noticeLine = test; }
    }
    if (noticeLine) drawText(page, noticeLine, 56, noticeY, 8.5, font, TEXT);

    y -= 60;

    // Production Intensity section (only if org_targets exist and output was logged)
    if (targetsRaw && targetsRaw.length > 0 && totalIntensity !== null) {
      // Guard: if not enough space for the full GEI block, push to new page
      const estimatedGeiHeight = (targetsRaw.length * 7 * 24) + 60;
      if (y < estimatedGeiHeight + 60) {
        drawText(page, pgFtr(), 180, 20, 9, font, GREY);
        page = addPage();
        y = 780;
      }
      y -= 10;
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      drawText(page, 'Production Intensity (GEI)', 55, y - 10, 10, bold, rgb(1, 1, 1));
      drawText(page, 'Value', 400, y - 10, 10, bold, rgb(1, 1, 1));
      y -= 26;

      for (const target of targetsRaw) {
        const useNormalized = normalizedIntensity !== null && baselineEF !== null && baselineEF !== currentEF;
        const comparisonGEI = useNormalized ? normalizedIntensity! : totalIntensity;
        const onTrack = comparisonGEI !== null && comparisonGEI <= target.target_gei;

        const intensityRows: [string, string, boolean][] = [
          ['Compliance year', `FY ${target.compliance_year}`, false],
          ['Sector', target.sector.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), false],
          ['Equivalent product', `${target.equivalent_product} (${target.equivalent_product_unit})`, false],
          ['Target GEI', `${target.target_gei} tCO2e/${target.equivalent_product_unit}`, false],
          ['Total product output (this period)', `${totalProductOutput.toLocaleString()} ${target.equivalent_product_unit}`, false],
          ['Raw GEI (current EF)', `${totalIntensity!.toFixed(4)} tCO2e/${target.equivalent_product_unit}`, false],
          ...(useNormalized ? [
            ['Baseline EF (electricity)', `${baselineEF} kgCO2e/kWh (locked at baseline year)`, false] as [string, string, boolean],
            ['Normalized GEI (baseline EF)', `${normalizedIntensity!.toFixed(4)} tCO2e/${target.equivalent_product_unit}`, true] as [string, string, boolean],
          ] : []),
          ['vs Target', onTrack ? 'On track' : 'Above target', true],
        ];

        let rowShadeI = false;
        for (const [label, value, highlight] of intensityRows) {
          if (y < 60) {
            drawText(page, pgFtr(), 180, 20, 9, font, GREY);
            page = addPage();
            y = 780;
          }
          const bg = rowShadeI ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
          page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: bg });
          page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: DIVIDER });
          drawText(page, label, 55, y - 6, 9, bold, TEXT);
          const valueColor = highlight ? (onTrack ? GREEN : rgb(0.75, 0.1, 0.1)) : TEXT;
          drawText(page, value, 260, y - 6, 9, font, valueColor);
          rowShadeI = !rowShadeI;
          y -= 24;
        }
        y -= 8;
      }
    }

    drawText(page, pgFtr(), 180, 20, 9, font, GREY);

    // PAGE 2+: Emission Records
    page = addPage();
    y = 780;

    drawText(page, '1. Monthly Emission Records', 50, y, 16, bold, TEXT);
    page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: GREEN });
    y -= 30;

    drawText(page, 'Each row shows the raw activity inputs, emission factors applied, and calculated CO2e output.', 50, y, 9, font, GREY);
    y -= 13;
    drawText(page, 'This constitutes the full MRV chain required for ACVA verification.', 50, y, 9, font, GREY);
    y -= 16;

    for (const r of assembledRowsFiltered) {
      if (y < 120) {
        drawText(page, pgFtr(), 180, 20, 9, font, GREY);
        page = addPage();
        y = 780;
      }

      const lockBadge = r.lock_status === 'locked' ? 'Locked' : 'Unlocked';
      const chainBadge = r.has_full_audit_chain ? 'Full audit chain' : 'Legacy (recalculated)';

      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0.1, 0.1, 0.12) });
      drawText(page, r.month, 55, y - 10, 9.5, bold, rgb(1, 1, 1));
      drawText(page, lockBadge, 300, y - 10, 8.5, font, r.lock_status === 'locked' ? rgb(0.6, 0.9, 0.6) : rgb(0.9, 0.75, 0.4));
      drawText(page, chainBadge, 400, y - 10, 8.5, font, r.has_full_audit_chain ? rgb(0.6, 0.9, 0.6) : rgb(0.9, 0.75, 0.4));
      y -= 24;

      const sourceRows = [
        ['Electricity', `${r.electricity_kw} kWh`, `x ${r.ef_electricity}`, `${r.elec_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 2'],
        ['Diesel', `${r.diesel_litres} L`, `x ${r.ef_diesel}`, `${r.diesel_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1'],
        ['Petrol', `${r.petrol_litres} L`, `x ${r.ef_petrol}`, `${r.petrol_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1'],
        ['Gas', `${r.gas_kwh} kWh`, `x ${r.ef_gas.toFixed(4)}`, `${r.gas_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1'],
        ['LPG', `${r.lpg_kg} kg`, `x ${r.ef_lpg}`, `${r.lpg_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1'],
        ['CNG', `${r.cng_kg} kg`, `x ${r.ef_cng}`, `${r.cng_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1'],
        ['Refrigerant', `${r.refrigerant_kg} kg (${r.refrigerant_code})`, r.ef_refrigerant ? `x ${r.ef_refrigerant}` : `x GWP lookup`, `${r.refrigerant_co2e_kg.toFixed(3)} kg CO2e`, 'Scope 1 fugitive'],
      ].filter(row => {
        const qty = parseFloat(row[1]);
        return !isNaN(qty) && qty > 0;
      });

      page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: rgb(0, 0, 0) });
      drawText(page, 'Source', 55, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Quantity', 160, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Factor', 255, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'CO2e', 355, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Scope', 465, y - 9, 8, bold, rgb(1, 1, 1));
      y -= 22;

      let rowShade = false;
      for (const [src, qty, factor, co2e, scope] of sourceRows) {
        page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: rowShade ? LIGHT : rgb(0.99, 0.99, 1) });
        page.drawLine({ start: { x: 45, y: y - 16 }, end: { x: 555, y: y - 16 }, thickness: 0.2, color: DIVIDER });
        drawText(page, src, 55, y - 8, 8, font, TEXT);
        drawText(page, qty, 160, y - 8, 8, font, TEXT);
        drawText(page, factor, 255, y - 8, 8, font, TEXT);
        drawText(page, co2e, 355, y - 8, 8, bold, GREEN);
        drawText(page, scope, 465, y - 8, 7.5, font, GREY);
        rowShade = !rowShade;
        y -= 20;
      }

      page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: rgb(0.92, 0.97, 0.94) });
      drawText(page, 'Total CO2e this month', 55, y - 8, 8.5, bold, TEXT);
      drawText(page, `${r.total_co2e_kg.toFixed(3)} kg  (${(r.total_co2e_kg / 1000).toFixed(4)} tCO2e)`, 355, y - 8, 8.5, bold, GREEN);
      y -= 22;

      // EF version on its own line (may be long); data source always shown in full on next line
      const efVersionStr = `EF version: ${r.ef_version}`;
      const efTruncated = font.widthOfTextAtSize(efVersionStr, 7) > 490
        ? efVersionStr.slice(0, Math.floor(efVersionStr.length * 490 / font.widthOfTextAtSize(efVersionStr, 7))) + '...'
        : efVersionStr;
      drawText(page, efTruncated, 55, y - 6, 7, font, GREY);
      drawText(page, `Data source: ${r.data_source}   |   Row ID: ${r.id}`, 55, y - 17, 7, font, GREY);
      y -= 26;
      y -= 6;
    }

    drawText(page, pgFtr(), 180, 20, 9, font, GREY);

    // Scope 3 page
    if (scope3Assembled.length > 0) {
      page = addPage();
      y = 780;

      drawText(page, '2. Scope 3 Activity Records', 50, y, 16, bold, TEXT);
      page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: GREEN });
      y -= 30;

      page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: rgb(0, 0, 0) });
      drawText(page, 'Month', 55, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Category', 150, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Label', 270, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'CO2e (kg)', 430, y - 9, 8, bold, rgb(1, 1, 1));
      drawText(page, 'Source', 490, y - 9, 8, bold, rgb(1, 1, 1));
      y -= 22;

      let s3Shade = false;
      for (const r of scope3Assembled) {
        if (y < 60) {
          drawText(page, pgFtr(), 180, 20, 9, font, GREY);
          page = addPage();
          y = 780;
        }
        page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: s3Shade ? LIGHT : rgb(0.99, 0.99, 1) });
        page.drawLine({ start: { x: 45, y: y - 16 }, end: { x: 555, y: y - 16 }, thickness: 0.2, color: DIVIDER });
        drawText(page, r.month ?? '', 55, y - 8, 8, font, TEXT);
        drawText(page, (r.category ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), 150, y - 8, 8, font, TEXT);
        const label = (r.label ?? '').replace(/\(#[a-f0-9]{4}\)$/i, '').trim();
        drawText(page, label.length > 20 ? label.slice(0, 20) + '\u2026' : label, 270, y - 8, 8, font, TEXT);
        drawText(page, r.co2e_kg.toFixed(3), 430, y - 8, 8, font, TEXT);
        drawText(page, r.data_source, 490, y - 8, 7.5, font, GREY);
        s3Shade = !s3Shade;
        y -= 20;
      }

      drawText(page, pgFtr(), 180, 20, 9, font, GREY);
    }

    // Methodology page
    page = addPage();
    y = 780;

    drawText(page, '3. Methodology & Governance', 50, y, 16, bold, TEXT);
    page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: GREEN });
    y -= 30;

    const methodSections = [
      ['Calculation methodology', `Emission calculations use national GHG conversion factors for India (${ef.version}). Electricity uses location-based grid factors (CEA/IEA 2026). Fuels use DEFRA 2025 factors. Refrigerants use IPCC AR6 GWP values. Scope 3 uses category-specific activity factors.`],
      ['Organisational boundary', 'This report applies an operational-control boundary covering operations in India. The GHG Protocol Corporate Standard methodology is followed.'],
      ['Scope definitions', 'Scope 1: Direct combustion of fuels and fugitive refrigerant emissions. Scope 2: Purchased electricity (location-based). Scope 3: Value-chain activities as recorded \u2014 this is not a complete Scope 3 inventory.'],
      ['GEI normalization', `Where a baseline electricity emission factor is recorded, Scope 2 emissions are normalized using the baseline year factor (${baselineEF ?? 'N/A'} kgCO2e/kWh) rather than the current year factor (${currentEF} kgCO2e/kWh). This follows BEE CCTS methodology to ensure fair year-on-year comparison independent of grid decarbonization. The normalized GEI is used for target compliance assessment.`],
      ['Audit chain', 'Records submitted after 16 March 2026 include a full factor snapshot (ef_* columns) and calc_breakdown JSON per row. Earlier records show recalculated values using current factors \u2014 factor snapshots are not available for these rows.'],
      ['Lock status', 'Locked months have been confirmed by the organisation and the exact emission row IDs are snapshotted in report_locks. Unlocked months are included in this package but have not been formally confirmed.'],
      ['Responsibility', 'Directors or authorised representatives are responsible for the completeness and accuracy of all data submitted. Greenio applies calculations to the data provided and does not perform independent verification unless separately commissioned.'],
      ['CCTS reference', 'This package is prepared for submission to an Accredited Carbon Verification Agency (ACVA) under the voluntary offset mechanism of the Carbon Credit Trading Scheme, 2023, administered by the Bureau of Energy Efficiency (BEE), Ministry of Power, Government of India.'],
    ];

    for (const [heading, content] of methodSections) {
      if (y < 100) {
        drawText(page, pgFtr(), 180, 20, 9, font, GREY);
        page = addPage();
        y = 780;
      }
      drawText(page, heading, 50, y, 10, bold, TEXT);
      y -= 16;

      const words = content.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(test, 9) > 480) {
          drawText(page, line, 55, y, 9, font, TEXT);
          y -= 13;
          line = w;
        } else { line = test; }
      }
      if (line) { drawText(page, line, 55, y, 9, font, TEXT); y -= 13; }
      y -= 14;
    }

    drawText(page, pgFtr(), 180, 20, 9, font, GREY);

    const pdfBytes = await pdf.save();
    const safeCompany = companyName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CCTS-Verification-Package-${safeCompany}.pdf"`,
      },
    });

  } catch (err: any) {
    console.error('CCTS verification error:', err);
    return new NextResponse('Failed to generate verification package', { status: 500 });
  }
}