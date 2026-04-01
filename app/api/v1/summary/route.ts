import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/apiKeyAuth';
import { getFactorsForCountry } from '@/lib/factors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function safe(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const financialYearParam = searchParams.get('financial_year');

    if (!financialYearParam) {
      return NextResponse.json(
        { error: 'financial_year is required' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const financialYear = Number(financialYearParam);
    if (isNaN(financialYear)) {
      return NextResponse.json(
        { error: 'financial_year must be a number' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch entities first to resolve fy_start_month and country_code
    const { data: entities } = await adminSupabase
      .from('entities')
      .select('country_code, fy_start_month')
      .eq('org_id', auth.orgId)
      .limit(1);

    const countryCode = entities?.[0]?.country_code ?? 'GB';
    const fyStartMonth: number = entities?.[0]?.fy_start_month ?? 1;

    // Calculate FY date range using fy_start_month
    let fyStart: string;
    let fyEnd: string;
    if (fyStartMonth === 1) {
      fyStart = `${financialYear}-01-01`;
      fyEnd   = `${financialYear}-12-31`;
    } else {
      // e.g. fy_start_month=4 → FY 2025 = 2025-04-01 to 2026-03-31
      const fyStartPadded = String(fyStartMonth).padStart(2, '0');
      const fyEndMonth = fyStartMonth - 1 === 0 ? 12 : fyStartMonth - 1;
      const fyEndYear  = financialYear + 1;
      const fyEndDay   = new Date(fyEndYear, fyEndMonth, 0).getDate(); // last day
      fyStart = `${financialYear}-${fyStartPadded}-01`;
      fyEnd   = `${fyEndYear}-${String(fyEndMonth).padStart(2, '0')}-${fyEndDay}`;
    }

    const ef = getFactorsForCountry(countryCode);

    // Fetch emissions and sites in parallel now that FY range is known
    const [emissionsResult, sitesResult] = await Promise.all([
      adminSupabase
        .from('emissions')
        .select('*')
        .eq('org_id', auth.orgId)
        .gte('month', fyStart)
        .lte('month', fyEnd)
        .order('month', { ascending: true }),
      adminSupabase
        .from('sites')
        .select('id, name, entity_id')
        .eq('org_id', auth.orgId),
    ]);

    const { data: emissions, error: emissionsError } = emissionsResult;
    if (emissionsError) {
      return NextResponse.json({ error: emissionsError.message }, { status: 500 });
    }

    const siteMap = new Map<string, string>(
      (sitesResult.data ?? []).map((s: any) => [s.id, s.name])
    );

    // ── Aggregations ──────────────────────────────────────────────────────────

    let totalCo2e = 0;
    let scope1Total = 0;
    let scope2Total = 0;

    const bySiteMap = new Map<string, number>();    // site_id → co2e
    const byMonthMap = new Map<string, number>();   // YYYY-MM → co2e

    for (const r of emissions ?? []) {
      const rowTotal = safe(r.total_co2e_kg);
      totalCo2e += rowTotal;

      // Scope split — prefer calc_breakdown if available
      let rowScope1: number;
      let rowScope2: number;

      const cb = r.calc_breakdown;
      if (cb && (cb.fuel_co2e_kg !== undefined || cb.elec_co2e_kg !== undefined)) {
        rowScope2 = safe(cb.elec_co2e_kg ?? 0);
        rowScope1 = safe(cb.fuel_co2e_kg ?? 0) + safe(cb.refrig_co2e_kg ?? 0);
      } else {
        // Fallback: compute electricity CO2e from raw columns, scope1 = total - scope2
        const elecKwh = safe(r.electricity_kwh ?? r.electricity_kw ?? 0);
        rowScope2 = elecKwh * ef.electricity;
        rowScope1 = Math.max(0, rowTotal - rowScope2);
      }

      scope1Total += rowScope1;
      scope2Total += rowScope2;

      // by_site — group by site_id (null site_id = org-level / SME)
      const siteKey = r.site_id ?? '_org';
      bySiteMap.set(siteKey, (bySiteMap.get(siteKey) ?? 0) + rowTotal);

      // by_month — use YYYY-MM from the month column (stored as YYYY-MM-DD)
      const monthKey = typeof r.month === 'string' ? r.month.slice(0, 7) : '';
      if (monthKey) {
        byMonthMap.set(monthKey, (byMonthMap.get(monthKey) ?? 0) + rowTotal);
      }
    }

    // Build by_site array
    const bySite = Array.from(bySiteMap.entries())
      .map(([siteId, co2e]) => ({
        site_id: siteId === '_org' ? null : siteId,
        site_name: siteId === '_org' ? 'Organisation (no site)' : (siteMap.get(siteId) ?? siteId),
        total_co2e: Math.round(co2e * 100) / 100,
      }))
      .sort((a, b) => b.total_co2e - a.total_co2e);

    // Build by_month array sorted chronologically
    const byMonth = Array.from(byMonthMap.entries())
      .map(([monthKey, co2e]) => ({
        month_key: monthKey,
        total_co2e: Math.round(co2e * 100) / 100,
      }))
      .sort((a, b) => a.month_key.localeCompare(b.month_key));

    return NextResponse.json(
      {
        org_id: auth.orgId,
        financial_year: financialYear,
        total_co2e: Math.round(totalCo2e * 100) / 100,
        by_site: bySite,
        by_scope: {
          scope1: Math.round(scope1Total * 100) / 100,
          scope2: Math.round(scope2Total * 100) / 100,
        },
        by_month: byMonth,
        meta: {
          generated_at: new Date().toISOString(),
          record_count: (emissions ?? []).length,
          country_code_used: countryCode,
          fy_start_month: fyStartMonth,
          fy_range: { start: fyStart, end: fyEnd },
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[v1/summary]', err.message);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}