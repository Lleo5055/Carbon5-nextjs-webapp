// app/dashboard/emissions/fuel/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import ViewIndicator from '@/app/dashboard/ViewIndicator';
import { loadViewState, getViewLabel } from '@/lib/enterpriseView';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { calcRefrigerantCo2e } from '../../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { normaliseSharesTo100 } from '@/lib/normalisePercentages';

export const dynamic = 'force-dynamic';

type PeriodKey = '3m' | '6m' | '12m' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All data',
};

type DashboardMonth = {
  monthLabel: string;
  electricityKwh: number;
  fuelLitres: number;
  refrigerantKg: number;
  totalCo2eKg: number;
  dieselLitres?: number;
  petrolLitres?: number;
  gasKwh?: number;
  lpgKg?: number;
  cngKg?: number;
  refrigerantCode?: string | null;
};

type InsightsMonth = {
  monthLabel: string;
  dieselLitres: number;
  petrolLitres: number;
  gasKwh: number;
  totalFuelEnergyLitresEquivalent: number;
  co2eKg: number;
};

type FuelInsightsData = {
  months: InsightsMonth[];
  totalLitresEquivalent: number;
  totalCo2eKg: number;
  lastMonth: InsightsMonth | null;
  prevMonth: InsightsMonth | null;
  shareOfFootprintPercent: number;
};

function formatTonnes(v: number) {
  return `${(v / 1000).toFixed(2)} t CO₂e`;
}

function formatNumber(v: number) {
  return v.toLocaleString();
}

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) {
    return (
      <div className="h-10 flex items-center text-[11px] text-slate-400">
        Not enough data yet
      </div>
    );
  }

  const width = 160;
  const height = 48;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const norm = (v - minVal) / range;
      const y = height - norm * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-slate-900">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FuelInsightsPage({ searchParams }: { searchParams?: { period?: string } }) {
  const rawPeriod = (searchParams?.period ?? 'all') as string;
  const period: PeriodKey =
    rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === '12m' ? (rawPeriod as PeriodKey) : 'all';

  const [data, setData] = useState<FuelInsightsData | null>(null);
  const [viewLabel, setViewLabel] = useState<string | null>(null);
  useEffect(() => {
    const s = loadViewState();
    if (s?.orgId && sessionStorage.getItem("greenio_is_enterprise") === "1") setViewLabel(getViewLabel(s));
  }, []);

  useEffect(() => {
    async function fetchData() {
      const vs = loadViewState();
      let emQ = supabase.from('emissions').select('*') as any;
      if (vs.orgId && sessionStorage.getItem("greenio_is_enterprise") === "1") {
        if (vs.mode === 'enterprise') emQ = emQ.eq('org_id', vs.orgId);
        else if (vs.mode === 'entity' && vs.siteIds?.length) emQ = emQ.in('site_id', vs.siteIds);
        else if (vs.mode === 'site' && vs.siteId) emQ = emQ.eq('site_id', vs.siteId);
      }
      const [{ data: rows, error }, { data: s3Data }] = await Promise.all([
        emQ,
        supabase.from('scope3_activities').select('month, co2e_kg'),
      ]);

      if (error || !rows) {
        console.error('Error loading fuel emissions', error);
        setData({
          months: [],
          totalLitresEquivalent: 0,
          totalCo2eKg: 0,
          lastMonth: null,
          prevMonth: null,
          shareOfFootprintPercent: 0,
        });
        return;
      }

      const countryCode = rows[0]?.country_code ?? 'GB';
      const ef = getFactorsForCountry(countryCode);

      let baseMonths: DashboardMonth[] = rows.map((row: any) => {
        const electricityKwh = Number(row.electricity_kw ?? 0);
        const dieselFromNew = Number(row.diesel_litres ?? 0);
        const petrolFromNew = Number(row.petrol_litres ?? 0);
        const gasKwh = Number(row.gas_kwh ?? 0);
        const legacyFuelLitres = Number(row.fuel_liters ?? 0);

        const hasNewFuel = dieselFromNew !== 0 || petrolFromNew !== 0 || gasKwh !== 0;
        const dieselLitres = hasNewFuel ? dieselFromNew : legacyFuelLitres;
        const petrolLitres = hasNewFuel ? petrolFromNew : 0;
        const fuelLitres = dieselLitres + petrolLitres;

        const refrigerantKg = Number(row.refrigerant_kg ?? 0);
        const refrigerantCode = (row.refrigerant_code as string | null) ?? 'GENERIC_HFC';

        return {
          monthLabel: row.month ?? 'Unknown month',
          electricityKwh,
          fuelLitres,
          refrigerantKg,
          totalCo2eKg: Number(row.total_co2e ?? 0),
          dieselLitres,
          petrolLitres,
          gasKwh,
          lpgKg: Number(row.lpg_kg ?? 0),
          cngKg: Number(row.cng_kg ?? 0),
          refrigerantCode,
        };
      });

      baseMonths = baseMonths.sort((a, b) => new Date(a.monthLabel).getTime() - new Date(b.monthLabel).getTime());
      const latestFirst = baseMonths.slice().reverse();

      const limit = period === '3m' ? 3 : period === '6m' ? 6 : period === '12m' ? 12 : latestFirst.length;
      const periodMonths = latestFirst.slice(0, limit);

      const insightsMonths: InsightsMonth[] = periodMonths.map((m) => {
        const dieselLitres = m.dieselLitres ?? 0;
        const petrolLitres = m.petrolLitres ?? 0;
        const gasKwh = m.gasKwh ?? 0;
        const lpgKg = m.lpgKg ?? 0;
        const cngKg = m.cngKg ?? 0;
        const co2eKg =
          dieselLitres * ef.diesel +
          petrolLitres * ef.petrol +
          gasKwh * ef.gas +
          lpgKg * ef.lpgKg +
          cngKg * ef.cngKg;
        return {
          monthLabel: m.monthLabel,
          dieselLitres,
          petrolLitres,
          gasKwh,
          totalFuelEnergyLitresEquivalent: dieselLitres + petrolLitres,
          co2eKg,
        };
      });

      const totalLitresEquivalent = insightsMonths.reduce((s, m) => s + m.totalFuelEnergyLitresEquivalent, 0);
      const totalCo2eKg = insightsMonths.reduce((s, m) => s + m.co2eKg, 0);

      const lastMonth = insightsMonths.length > 0 ? insightsMonths[0] : null;
      const prevMonth = insightsMonths.length > 1 ? insightsMonths[1] : null;

      const totalElec = periodMonths.reduce((s, m) => s + m.electricityKwh * ef.electricity, 0);
      const totalFuel = periodMonths.reduce(
        (s, m) =>
          s +
          (m.dieselLitres ?? 0) * ef.diesel +
          (m.petrolLitres ?? 0) * ef.petrol +
          (m.gasKwh ?? 0) * ef.gas +
          (m.lpgKg ?? 0) * ef.lpgKg +
          (m.cngKg ?? 0) * ef.cngKg,
        0
      );
      const totalRef = periodMonths.reduce(
        (s, m) => s + calcRefrigerantCo2e(m.refrigerantKg ?? 0, m.refrigerantCode ?? 'GENERIC_HFC'),
        0
      );

      const periodMonthLabels = new Set(periodMonths.map((m) => m.monthLabel));
      const scope3Total = (s3Data ?? [])
        .filter((r: any) => periodMonthLabels.has(r.month))
        .reduce((s: number, r: any) => s + Number(r.co2e_kg ?? 0), 0);

      const denom = totalElec + totalFuel + totalRef + scope3Total || 1;
      const normalisedShares = normaliseSharesTo100({
        electricity: (totalElec / denom) * 100,
        fuel: (totalFuel / denom) * 100,
        refrigerant: (totalRef / denom) * 100,
        scope3: (scope3Total / denom) * 100,
      });

      setData({
        months: insightsMonths,
        totalLitresEquivalent,
        totalCo2eKg,
        lastMonth,
        prevMonth,
        shareOfFootprintPercent: normalisedShares.fuel,
      });
    }

    fetchData();
  }, [period]);

  if (!data) return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            ← Dashboard
          </Link>
          <span className="hidden md:inline-block h-4 w-px bg-slate-200" />
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Hotspot · Fuel</p>
        </div>
        <header>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Fuel Insights</h1>
            {viewLabel && <ViewIndicator label={viewLabel} />}
          <p className="text-sm text-slate-600 mt-1">Understand how fuel contributes to your footprint in this period.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="rounded-xl bg-white border p-6 shadow h-28 animate-pulse bg-slate-100" />)}
        </div>
        <div className="rounded-xl bg-white border p-6 shadow h-48 animate-pulse bg-slate-100" />
      </div>
    </main>
  );

  const { months, totalLitresEquivalent, totalCo2eKg, lastMonth, prevMonth, shareOfFootprintPercent } = data;
  const hasData = months.length > 0;
  const periodLabel = PERIOD_LABELS[period];
  const monthChangePercent = lastMonth && prevMonth && prevMonth.co2eKg > 0
    ? ((lastMonth.co2eKg - prevMonth.co2eKg) / prevMonth.co2eKg) * 100
    : null;
  const chartValues = months.slice().reverse().map((m) => m.co2eKg);

  const navItems = [
    { href: '/dashboard/emissions/electricity', label: 'Electricity Insights', active: false },
    { href: '/dashboard/emissions/fuel',        label: 'Fuel Insights',        active: true },
    { href: '/dashboard/emissions/refrigerant', label: 'Refrigerant Insights', active: false },
    { href: '/dashboard/emissions/scope3',      label: 'Scope 3 Insights',     active: false },
  ];

  const periodPills: { key: PeriodKey; label: string }[] = [
    { key: '3m', label: 'Last 3 months' },
    { key: '6m', label: 'Last 6 months' },
    { key: '12m', label: 'Last 12 months' },
    { key: 'all', label: 'All data' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Top nav / breadcrumb */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              ← Dashboard
            </Link>
            <span className="hidden md:inline-block h-4 w-px bg-slate-200" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Hotspot · Fuel</p>
          </div>
          <nav className="inline-flex rounded-full bg-white border border-slate-200 p-1 text-[11px]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'px-3 py-1 rounded-full transition hover:shadow-sm hover:-translate-y-px ' +
                  (item.active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900')
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Fuel Insights</h1>
            {viewLabel && <ViewIndicator label={viewLabel} />}
          <p className="text-sm text-slate-600 max-w-2xl">
            See how diesel, petrol and gas usage contribute to your footprint. This view is ideal for fleet and logistics decisions.
          </p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 p-1 text-[11px]">
            {periodPills.map((p) => {
              const active = p.key === period;
              const href = p.key === 'all' ? '/dashboard/emissions/fuel' : `/dashboard/emissions/fuel?period=${p.key}`;
              return (
                <Link
                  key={p.key}
                  href={href}
                  className={
                    'px-3 py-1 rounded-full transition hover:shadow-sm hover:-translate-y-px ' +
                    (active ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900')
                  }
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </header>

        {!hasData ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">No fuel data yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Once you log diesel, petrol or gas usage, this view will show how your fleet and combustion fuels are driving your footprint.
            </p>
          </section>
        ) : (
          <>
            {/* Key stats */}
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total fuel CO₂e · {periodLabel}</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{formatTonnes(totalCo2eKg)}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Across {formatNumber(Math.round(totalLitresEquivalent * 10) / 10)} litres of diesel/petrol (equivalent) in this period.
                </p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Share of footprint</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{shareOfFootprintPercent.toFixed(1)}%</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Portion of your total emissions in this period that comes from fuel use.
                </p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Latest month vs previous</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {monthChangePercent === null ? 'n/a' : `${monthChangePercent >= 0 ? '+' : ''}${monthChangePercent.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Change in fuel-related CO₂e between the last two reported months.</p>
              </div>
            </section>

            {/* Trend + table */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              <article className="rounded-xl bg-white border p-6 shadow flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Trend over time</h2>
                  <p className="text-[11px] text-slate-500">Fuel CO₂e per month</p>
                </div>
                <div className="flex items-center gap-4">
                  <Sparkline values={chartValues} />
                  <p className="text-[11px] text-slate-600">
                    Each point is the fuel-related CO₂e for that month. Use this to see the impact of routing changes, driver training or vehicle upgrades.
                  </p>
                </div>

                <div className="mt-2 border-t border-slate-100 pt-3">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100">
                        <th className="py-1.5 text-left font-medium">Month</th>
                        <th className="py-1.5 text-right font-medium">Diesel (L)</th>
                        <th className="py-1.5 text-right font-medium">Petrol (L)</th>
                        <th className="py-1.5 text-right font-medium">Gas (kWh)</th>
                        <th className="py-1.5 text-right font-medium">CO₂e (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m, idx) => (
                        <tr key={m.monthLabel} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5 text-[12px] text-slate-900">
                            {m.monthLabel}
                            {idx === 0 && <span className="ml-1 text-[10px] text-emerald-600">• Latest</span>}
                          </td>
                          <td className="py-1.5 text-right text-slate-700">{formatNumber(Math.round(m.dieselLitres))}</td>
                          <td className="py-1.5 text-right text-slate-700">{formatNumber(Math.round(m.petrolLitres))}</td>
                          <td className="py-1.5 text-right text-slate-700">{formatNumber(Math.round(m.gasKwh))}</td>
                          <td className="py-1.5 text-right text-slate-700">{m.co2eKg.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <aside className="rounded-xl bg-white border p-6 shadow flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Recommended actions</h2>
                <p className="text-[11px] text-slate-500 mb-1">
                  Focus on high-impact, low-friction changes in routing, behaviour and vehicle mix.
                </p>
                <ul className="grid gap-2 text-[11px]">
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Target the most fuel-intensive routes</p>
                    <p className="text-slate-600">Identify the top 10% of routes by fuel use and check whether they can be consolidated, rescheduled or moved to more efficient vehicles.</p>
                  </li>
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Run a driver behaviour pilot</p>
                    <p className="text-slate-600">Coach on idling, harsh acceleration and speed. Track results over 2–3 months.</p>
                  </li>
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">Build a vehicle transition plan</p>
                    <p className="text-slate-600">Highlight the dirtiest vehicles and prioritise them for replacement or shift to lower-emission options first.</p>
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