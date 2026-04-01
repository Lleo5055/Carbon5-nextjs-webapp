// app/dashboard/emissions/scope3/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import ViewIndicator from '@/app/dashboard/ViewIndicator';
import { loadViewState, getViewLabel } from '@/lib/enterpriseView';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { calcRefrigerantCo2e } from '../../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';

type PeriodKey = '3m' | '6m' | '12m' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All data',
};

const CATEGORY_LABELS: Record<string, string> = {
  employee_commuting: 'Employee Commuting',
  business_travel: 'Business Travel',
  purchased_goods: 'Purchased Goods & Services',
  waste: 'Waste',
  upstream_transport: 'Upstream Transport',
  downstream_transport: 'Downstream Transport',
  other: 'Other',
};

type ActivityRow = {
  monthLabel: string;
  category: string;
  label: string;
  activityValue?: number | null;
  activityUnit?: string | null;
  co2eKg: number;
};

type Scope3Month = {
  monthLabel: string;
  co2eKg: number;
};

type Scope3InsightsData = {
  activities: ActivityRow[];
  months: Scope3Month[];
  totalCo2eKg: number;
  lastMonth: Scope3Month | null;
  prevMonth: Scope3Month | null;
  shareOfFootprintPercent: number;
  topCategory: string | null;
};

async function getScope3Insights(period: PeriodKey): Promise<Scope3InsightsData> {
  const empty: Scope3InsightsData = {
    activities: [],
    months: [],
    totalCo2eKg: 0,
    lastMonth: null,
    prevMonth: null,
    shareOfFootprintPercent: 0,
    topCategory: null,
  };

  const vs = loadViewState();
  let emQ = supabase.from('emissions').select('*') as any;
  if (vs.orgId) {
    if (vs.mode === 'enterprise') emQ = emQ.eq('org_id', vs.orgId);
    else if (vs.mode === 'entity' && vs.siteIds?.length) emQ = emQ.in('site_id', vs.siteIds);
    else if (vs.mode === 'site' && vs.siteId) emQ = emQ.eq('site_id', vs.siteId);
  }
  const [{ data: s3Data, error: s3Error }, { data: emData }] = await Promise.all([
    supabase.from('scope3_activities').select('*').order('month', { ascending: false }),
    emQ,
  ]);

  if (s3Error || !s3Data) {
    console.error('Error loading scope3 activities', s3Error);
    return empty;
  }

  // For entity/site views, attribute scope3 by month-matching against filtered emissions
  let s3Attributed = s3Data as any[];
  if (vs.orgId && (vs.mode === 'entity' || vs.mode === 'site') && emData) {
    const emMonths = new Set((emData as any[]).map((r: any) => r.month));
    s3Attributed = s3Attributed.filter((r: any) => emMonths.has(r.month));
  }

  // Apply period filter
  let filtered = s3Attributed;
  if (period !== 'all') {
    const n = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - n);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
    filtered = filtered.filter((r) => r.month && r.month >= cutoffStr);
  }

  const activities: ActivityRow[] = filtered.map((r) => ({
    monthLabel: r.month ?? 'Unknown',
    category: r.category ?? 'other',
    label: r.label ?? '',
    activityValue: r.activity_value ?? null,
    activityUnit: r.activity_unit ?? null,
    co2eKg: Number(r.co2e_kg ?? 0),
  }));

  // Aggregate by month
  const monthMap = new Map<string, number>();
  activities.forEach((a) => {
    monthMap.set(a.monthLabel, (monthMap.get(a.monthLabel) ?? 0) + a.co2eKg);
  });
  const months: Scope3Month[] = Array.from(monthMap.entries())
    .map(([monthLabel, co2eKg]) => ({ monthLabel, co2eKg }))
    .sort((a, b) => new Date(b.monthLabel).getTime() - new Date(a.monthLabel).getTime());

  const totalCo2eKg = activities.reduce((s, a) => s + a.co2eKg, 0);
  const lastMonth = months[0] ?? null;
  const prevMonth = months[1] ?? null;

  // Top category
  const catTotals = new Map<string, number>();
  activities.forEach((a) => catTotals.set(a.category, (catTotals.get(a.category) ?? 0) + a.co2eKg));
  const topCategory = catTotals.size > 0
    ? Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Share of footprint (scope3 / total including scope1+2)
  let shareOfFootprintPercent = 0;
  if (emData && emData.length > 0) {
    const countryCode = emData[0]?.country_code ?? 'GB';
    const ef = getFactorsForCountry(countryCode);

    let emFiltered = emData as any[];
    if (period !== 'all') {
      const n = period === '3m' ? 3 : period === '6m' ? 6 : 12;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - n);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
      emFiltered = emFiltered.filter((r: any) => r.month && r.month >= cutoffStr);
    }

    const s1s2 = emFiltered.reduce((s: number, r: any) => {
      const elec = Number(r.electricity_kw ?? 0) * ef.electricity;
      const diesel = Number(r.diesel_litres ?? 0) * ef.diesel;
      const petrol = Number(r.petrol_litres ?? 0) * ef.petrol;
      const gas = Number(r.gas_kwh ?? 0) * ef.gas;
      const lpg = Number(r.lpg_kg ?? 0) * ef.lpgKg;
      const cng = Number(r.cng_kg ?? 0) * ef.cngKg;
      const refrig = calcRefrigerantCo2e(Number(r.refrigerant_kg ?? 0), r.refrigerant_code ?? 'GENERIC_HFC');
      return s + elec + diesel + petrol + gas + lpg + cng + refrig;
    }, 0);

    const total = s1s2 + totalCo2eKg;
    shareOfFootprintPercent = total > 0 ? Math.round((totalCo2eKg / total) * 1000) / 10 : 0;
  }

  return { activities, months, totalCo2eKg, lastMonth, prevMonth, shareOfFootprintPercent, topCategory };
}

function formatTonnes(v: number) {
  return `${(v / 1000).toFixed(2)} t CO₂e`;
}

function fmtMonth(ym: string) {
  const d = new Date(ym + '-01');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2)
    return <div className="h-10 flex items-center text-[11px] text-slate-400">Not enough data yet</div>;
  const width = 160; const height = 48;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => `${i * stepX},${height - ((v - minVal) / range) * height}`).join(' ');
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const navItems = [
  { href: '/dashboard/emissions/electricity', label: 'Electricity Insights', active: false },
  { href: '/dashboard/emissions/fuel',        label: 'Fuel Insights',        active: false },
  { href: '/dashboard/emissions/refrigerant', label: 'Refrigerant Insights', active: false },
  { href: '/dashboard/emissions/scope3',      label: 'Scope 3 Insights',     active: true  },
];

export default function Scope3InsightsPage({ searchParams }: { searchParams?: { period?: string } }) {
  const rawPeriod = (searchParams?.period ?? 'all') as string;
  const period: PeriodKey = ['3m', '6m', '12m'].includes(rawPeriod) ? (rawPeriod as PeriodKey) : 'all';

  const [data, setData] = useState<Scope3InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewLabel, setViewLabel] = useState<string | null>(null);
  useEffect(() => {
    const s = loadViewState();
    if (s?.orgId) setViewLabel(getViewLabel(s));
  }, []);

  useEffect(() => {
    setLoading(true);
    getScope3Insights(period).then((res) => { setData(res); setLoading(false); });
  }, [period]);

  const periodPills: { key: PeriodKey; label: string }[] = [
    { key: '3m', label: 'Last 3 months' },
    { key: '6m', label: 'Last 6 months' },
    { key: '12m', label: 'Last 12 months' },
    { key: 'all', label: 'All data' },
  ];

  if (loading || !data) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                ← Dashboard
              </Link>
              <span className="hidden md:inline-block h-4 w-px bg-slate-200" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Hotspot · Scope 3</p>
            </div>
          </div>
          <header>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Scope 3 Insights</h1>
            {viewLabel && <ViewIndicator label={viewLabel} />}
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="rounded-xl bg-white border p-6 shadow h-28 animate-pulse bg-slate-100" />)}
          </div>
          <div className="rounded-xl bg-white border p-6 shadow h-48 animate-pulse bg-slate-100" />
        </div>
      </main>
    );
  }

  const { activities, months, totalCo2eKg, lastMonth, prevMonth, shareOfFootprintPercent, topCategory } = data;
  const hasData = activities.length > 0;
  const periodLabel = PERIOD_LABELS[period];
  const monthChangePercent = lastMonth && prevMonth && prevMonth.co2eKg > 0
    ? ((lastMonth.co2eKg - prevMonth.co2eKg) / prevMonth.co2eKg) * 100
    : null;
  const chartValues = months.slice().reverse().map((m) => m.co2eKg);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Top nav */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              ← Dashboard
            </Link>
            <span className="hidden md:inline-block h-4 w-px bg-slate-200" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Hotspot · Scope 3</p>
          </div>
          <nav className="inline-flex rounded-full bg-white border border-slate-200 p-1 text-[11px]">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-3 py-1 rounded-full transition hover:shadow-sm hover:-translate-y-px ${item.active ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}>{item.label}</Link>
            ))}
          </nav>
        </div>

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Scope 3 Insights</h1>
            {viewLabel && <ViewIndicator label={viewLabel} />}
          <p className="text-sm text-slate-600 max-w-2xl">Understand your value-chain emissions — commuting, business travel, purchased goods and more. These are often the largest share of a company's total footprint.</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 p-1 text-[11px]">
            {periodPills.map((p) => {
              const active = p.key === period;
              const href = p.key === 'all' ? '/dashboard/emissions/scope3' : `/dashboard/emissions/scope3?period=${p.key}`;
              return <Link key={p.key} href={href} className={`px-3 py-1 rounded-full transition hover:shadow-sm hover:-translate-y-px ${active ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}>{p.label}</Link>;
            })}
          </div>
        </header>

        {!hasData ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">No Scope 3 data yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add Scope 3 activities on the View Emissions page to start tracking your value-chain footprint.</p>
            <Link href="/dashboard/emissions/view-emissions" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">Add Scope 3 activities →</Link>
          </section>
        ) : (
          <>
            {/* Key stats */}
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total Scope 3 CO₂e · {periodLabel}</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{formatTonnes(totalCo2eKg)}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {topCategory ? `Largest category: ${CATEGORY_LABELS[topCategory] ?? topCategory}.` : 'Across all logged value-chain activities.'}
                </p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Share of footprint</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{shareOfFootprintPercent.toFixed(1)}%</p>
                <p className="mt-1 text-[11px] text-slate-500">Portion of your total emissions in this period from value-chain activities.</p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Latest month vs previous</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {monthChangePercent === null ? 'n/a' : `${monthChangePercent >= 0 ? '+' : ''}${monthChangePercent.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Change in Scope 3 CO₂e between the last two reported months.</p>
              </div>
            </section>

            {/* Trend + actions */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              <article className="rounded-xl bg-white border p-6 shadow flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Trend over time</h2>
                  <p className="text-[11px] text-slate-500">Scope 3 CO₂e per month</p>
                </div>
                <div className="flex items-center gap-4">
                  <Sparkline values={chartValues} />
                  <p className="text-[11px] text-slate-600">Each point is the total Scope 3 CO₂e logged for that month across all activity categories.</p>
                </div>

                {/* Activity log table */}
                <div className="mt-2 border-t border-slate-100 pt-3">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100">
                        <th className="py-1.5 text-left font-medium">Month</th>
                        <th className="py-1.5 text-left font-medium">Category</th>
                        <th className="py-1.5 text-left font-medium">Activity</th>
                        <th className="py-1.5 text-right font-medium">CO₂e (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((a, idx) => (
                        <tr key={idx} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5 text-[12px] text-slate-900 whitespace-nowrap">{fmtMonth(a.monthLabel)}</td>
                          <td className="py-1.5 text-slate-600">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                          <td className="py-1.5 text-slate-500">
                            {a.activityValue != null && a.activityUnit
                              ? <span className="text-amber-600 font-medium">{a.activityValue.toLocaleString()} {a.activityUnit}</span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-1.5 text-right text-slate-700 font-medium">{a.co2eKg.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              {/* Recommended actions */}
              <aside className="rounded-xl bg-white border p-6 shadow flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Recommended actions</h2>
                <p className="text-[11px] text-slate-500 mb-1">Value-chain emissions are harder to control but high-impact. Start with the largest categories.</p>
                <ul className="grid gap-2 text-[11px]">
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Engage your top 5 suppliers</p>
                    <p className="text-slate-600">Ask your highest-spend suppliers for their carbon targets or emissions data. Even one conversation per quarter builds momentum.</p>
                  </li>
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Introduce a travel policy</p>
                    <p className="text-slate-600">Set a default of video calls over flights for trips under 4 hours. Track business travel CO₂e monthly to show the impact of policy changes.</p>
                  </li>
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Add a commute survey</p>
                    <p className="text-slate-600">A short annual survey of commute modes and distances gives you a reliable Scope 3 baseline and identifies hybrid/remote policy opportunities.</p>
                  </li>
                </ul>
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
