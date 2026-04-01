import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgRole } from '@/lib/orgAuth';

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fyDates(financialYear: number, fyStartMonth: number): { start: string; end: string } {
  if (fyStartMonth === 1) {
    return { start: `${financialYear}-01-01`, end: `${financialYear}-12-31` };
  }
  const startPad = String(fyStartMonth).padStart(2, '0');
  const endMonth = fyStartMonth - 1 === 0 ? 12 : fyStartMonth - 1;
  const endYear = financialYear + 1;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  return {
    start: `${financialYear}-${startPad}-01`,
    end: `${endYear}-${String(endMonth).padStart(2, '0')}-${endDay}`,
  };
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const org_id = searchParams.get('org_id');

  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
  }

  const auth = await requireOrgRole(request, org_id, 'viewer');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const currentYear = new Date().getFullYear();
    const financialYear = Number(searchParams.get('financial_year') ?? currentYear);
    if (isNaN(financialYear)) {
      return NextResponse.json({ error: 'financial_year must be a number' }, { status: 400 });
    }

    // Fetch entities
    const { data: entities, error: entitiesError } = await adminSupabase
      .from('entities')
      .select('id, name, country_code, fy_start_month, employee_count')
      .eq('org_id', org_id)
      .order('name', { ascending: true });

    if (entitiesError) {
      return NextResponse.json({ error: entitiesError.message }, { status: 500 });
    }

    const fyStartMonth: number = entities?.[0]?.fy_start_month ?? 1;
    const { start: fyStart, end: fyEnd } = fyDates(financialYear, fyStartMonth);
    const { start: prevFyStart, end: prevFyEnd } = fyDates(financialYear - 1, fyStartMonth);

    // Fetch current + prev FY emissions and sites in parallel
    const [currEmissionsRes, prevEmissionsRes, sitesRes] = await Promise.all([
      adminSupabase
        .from('emissions')
        .select('*')
        .eq('org_id', org_id)
        .gte('month_key',fyStart)
        .lte('month_key',fyEnd),
      adminSupabase
        .from('emissions')
        .select('total_co2e_kg')
        .eq('org_id', org_id)
        .gte('month_key',prevFyStart)
        .lte('month_key',prevFyEnd),
      adminSupabase
        .from('sites')
        .select('id, name, city, entity_id')
        .eq('org_id', org_id),
    ]);

    console.log('Emissions query result:', {
      org_id,
      fyStart,
      fyEnd,
      count: currEmissionsRes.data?.length ?? 0,
      error: currEmissionsRes.error?.message ?? null,
      first: currEmissionsRes.data?.[0] ?? null,
    });

    if (currEmissionsRes.error) {
      return NextResponse.json({ error: currEmissionsRes.error.message }, { status: 500 });
    }

    const emissions = currEmissionsRes.data ?? [];
    const prevEmissions = prevEmissionsRes.data ?? [];
    const sites = sitesRes.data ?? [];

    // Build site → entity lookup so we can resolve entity even when entity_id is null on the row
    const siteToEntityMap = new Map<string, string>();
    for (const s of sites) {
      siteToEntityMap.set(s.id, s.entity_id);
    }

    // Emission factors (GB defaults)
    const EF = {
      diesel: 0.25268,
      petrol: 0.23646,
      gas: 0.18254,
      lpg: 1.5551,
      cng: 2.5407,
      refrigerant: 1774,
      electricity: 0.233,
    };

    // Per-row scope calculations
    const rowScope1 = (r: any): number =>
      safe(r.diesel_litres) * EF.diesel +
      safe(r.petrol_litres) * EF.petrol +
      safe(r.gas_kwh) * EF.gas +
      safe(r.lpg_kg) * EF.lpg +
      safe(r.cng_kg) * EF.cng +
      safe(r.refrigerant_kg) * EF.refrigerant;

    const rowScope2 = (r: any): number =>
      safe(r.electricity_kwh ?? r.electricity_kw) * EF.electricity;

    // Aggregate current FY
    let totalCo2e = 0;
    let scope1Co2e = 0;
    let scope2Co2e = 0;

    // by_entity accumulators: entity_id → { co2e, s1, s2 }
    const entityTotals = new Map<string, { co2e: number; s1: number; s2: number }>();
    // by_site accumulators: site_id → co2e
    const siteTotals = new Map<string, number>();
    // by_month accumulators: YYYY-MM → { co2e, s1, s2 }
    const monthTotals = new Map<string, { co2e: number; s1: number; s2: number }>();

    for (const r of emissions) {
      const rowCo2e = safe(r.total_co2e_kg);
      const s1 = rowScope1(r);
      const s2 = rowScope2(r);

      totalCo2e += rowCo2e;
      scope1Co2e += s1;
      scope2Co2e += s2;

      // by entity — resolve via site_id if entity_id not stored on the row
      const eid = r.entity_id ?? (r.site_id ? siteToEntityMap.get(r.site_id) : undefined) ?? '_none';
      const et = entityTotals.get(eid) ?? { co2e: 0, s1: 0, s2: 0 };
      et.co2e += rowCo2e;
      et.s1 += s1;
      et.s2 += s2;
      entityTotals.set(eid, et);

      // by site
      if (r.site_id) {
        siteTotals.set(r.site_id, (siteTotals.get(r.site_id) ?? 0) + rowCo2e);
      }

      // by month — prefer month_key column, fall back to month
      const mk = typeof r.month_key === 'string' ? r.month_key.slice(0, 7) : (typeof r.month === 'string' ? r.month.slice(0, 7) : '');
      if (mk) {
        const mt = monthTotals.get(mk) ?? { co2e: 0, s1: 0, s2: 0 };
        mt.co2e += rowCo2e;
        mt.s1 += s1;
        mt.s2 += s2;
        monthTotals.set(mk, mt);
      }
    }

    const prevTotalCo2e = prevEmissions.reduce((acc, r) => acc + safe(r.total_co2e_kg), 0);
    const yoyChangePct =
      prevTotalCo2e > 0
        ? round2(((totalCo2e - prevTotalCo2e) / prevTotalCo2e) * 100)
        : null;

    // Employees
    const totalEmployees = (entities ?? []).reduce(
      (acc, e) => acc + safe(e.employee_count),
      0
    );
    const co2ePerEmployee =
      totalEmployees > 0 ? round2(totalCo2e / totalEmployees) : null;

    // Sites coverage
    const sitesWithData = new Set(
      emissions.filter((r) => r.site_id).map((r) => r.site_id)
    ).size;
    const totalSites = sites.length;
    const completenessPct =
      totalSites > 0 ? round2((sitesWithData / totalSites) * 100) : 0;

    // Build by_entity
    const sitesByEntity = new Map<string, typeof sites>();
    for (const s of sites) {
      const arr = sitesByEntity.get(s.entity_id) ?? [];
      arr.push(s);
      sitesByEntity.set(s.entity_id, arr);
    }

    // Count records per site for has_data / record_count
    const siteRecordCount = new Map<string, number>();
    for (const r of emissions) {
      if (r.site_id) {
        siteRecordCount.set(r.site_id, (siteRecordCount.get(r.site_id) ?? 0) + 1);
      }
    }

    const byEntity = (entities ?? []).map((e) => {
      const et = entityTotals.get(e.id) ?? { co2e: 0, s1: 0, s2: 0 };
      const empCount = e.employee_count ? safe(e.employee_count) : null;
      const entitySites = (sitesByEntity.get(e.id) ?? []).map((s) => {
        const siteCo2e = siteTotals.get(s.id) ?? 0;
        const rc = siteRecordCount.get(s.id) ?? 0;
        return {
          site_id: s.id,
          site_name: s.name,
          city: s.city ?? null,
          total_co2e: round2(siteCo2e),
          has_data: rc > 0,
          record_count: rc,
        };
      });
      return {
        entity_id: e.id,
        entity_name: e.name,
        country_code: e.country_code,
        total_co2e: round2(et.co2e),
        scope1_co2e: round2(et.s1),
        scope2_co2e: round2(et.s2),
        employee_count: empCount,
        co2e_per_employee:
          empCount && empCount > 0 ? round2(et.co2e / empCount) : null,
        sites: entitySites,
      };
    });

    // Build by_month sorted chronologically
    const byMonth = Array.from(monthTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, mt]) => ({
        month_key: mk,
        month_label: monthLabel(mk),
        total_co2e: round2(mt.co2e),
        scope1_co2e: round2(mt.s1),
        scope2_co2e: round2(mt.s2),
      }));

    return NextResponse.json(
      {
        org_id,
        financial_year: financialYear,
        fy_range: { start: fyStart, end: fyEnd },
        total_co2e: round2(totalCo2e),
        scope1_co2e: round2(scope1Co2e),
        scope2_co2e: round2(scope2Co2e),
        prev_total_co2e: round2(prevTotalCo2e),
        yoy_change_pct: yoyChangePct,
        total_employees: totalEmployees,
        co2e_per_employee: co2ePerEmployee,
        total_sites: totalSites,
        sites_with_data: sitesWithData,
        completeness_pct: completenessPct,
        by_entity: byEntity,
        by_month: byMonth,
        meta: {
          generated_at: new Date().toISOString(),
          record_count: emissions.length,
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[consolidation]', err.message);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}