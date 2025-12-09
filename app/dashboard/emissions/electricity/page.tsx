// app/dashboard/emissions/electricity/page.tsx
import React from 'react';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  calcFuelCo2eKg,
  calcRefrigerantCo2e,
} from '../../../../lib/emissionFactors';

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
  refrigerantCode?: string | null;
};

type InsightsMonth = {
  monthLabel: string;
  kwh: number;
  co2eKg: number;
};

type ElectricityInsightsData = {
  months: InsightsMonth[]; // latest first
  totalKwh: number;
  totalCo2eKg: number;
  lastMonth: InsightsMonth | null;
  prevMonth: InsightsMonth | null;
  shareOfFootprintPercent: number;
};

async function getElectricityInsights(
  period: PeriodKey
): Promise<ElectricityInsightsData> {
  const { data, error } = await supabase.from('emissions').select('*');

  if (error || !data) {
    console.error('Error loading emissions for electricity insights', error);
    return {
      months: [],
      totalKwh: 0,
      totalCo2eKg: 0,
      lastMonth: null,
      prevMonth: null,
      shareOfFootprintPercent: 0,
    };
  }

  // Base mapping – same structure as dashboard
  let baseMonths: DashboardMonth[] = data.map((row: any) => {
    const electricityKwh = Number(row.electricity_kw ?? 0);

    const dieselFromNew = Number(row.diesel_litres ?? 0);
    const petrolFromNew = Number(row.petrol_litres ?? 0);
    const gasKwh = Number(row.gas_kwh ?? 0);
    const legacyFuelLitres = Number(row.fuel_liters ?? 0);

    const hasNewFuel =
      dieselFromNew !== 0 || petrolFromNew !== 0 || gasKwh !== 0;

    const dieselLitres = hasNewFuel ? dieselFromNew : legacyFuelLitres;
    const petrolLitres = hasNewFuel ? petrolFromNew : 0;
    const fuelLitres = dieselLitres + petrolLitres;

    const refrigerantKg = Number(row.refrigerant_kg ?? 0);
    const refrigerantCode =
      (row.refrigerant_code as string | null) ?? 'GENERIC_HFC';

    return {
      monthLabel: row.month ?? 'Unknown month',
      electricityKwh,
      fuelLitres,
      refrigerantKg,
      totalCo2eKg: Number(row.total_co2e ?? 0),
      dieselLitres,
      petrolLitres,
      gasKwh,
      refrigerantCode,
    };
  });

  // Sort ascending by actual date
  baseMonths = baseMonths.sort((a, b) => {
    const da = new Date(a.monthLabel);
    const db = new Date(b.monthLabel);
    return da.getTime() - db.getTime();
  });

  const latestFirst = baseMonths.slice().reverse();

  const limit =
    period === '3m'
      ? 3
      : period === '6m'
      ? 6
      : period === '12m'
      ? 12
      : latestFirst.length;

  const periodMonths = latestFirst.slice(0, limit);

  const insightsMonths: InsightsMonth[] = periodMonths.map((m) => {
    const co2eKg = m.electricityKwh * EF_GRID_ELECTRICITY_KG_PER_KWH;
    return {
      monthLabel: m.monthLabel,
      kwh: m.electricityKwh,
      co2eKg,
    };
  });

  const totalKwh = insightsMonths.reduce((s, m) => s + m.kwh, 0);
  const totalCo2eKg = insightsMonths.reduce((s, m) => s + m.co2eKg, 0);

  const lastMonth = insightsMonths.length > 0 ? insightsMonths[0] : null;
  const prevMonth = insightsMonths.length > 1 ? insightsMonths[1] : null;

  // Share of footprint within this period
  const totalElec = periodMonths.reduce(
    (s, m) => s + m.electricityKwh * EF_GRID_ELECTRICITY_KG_PER_KWH,
    0
  );
  const totalFuel = periodMonths.reduce(
    (s, m) =>
      s +
      calcFuelCo2eKg({
        dieselLitres: m.dieselLitres ?? 0,
        petrolLitres: m.petrolLitres ?? 0,
        gasKwh: m.gasKwh ?? 0,
      }),
    0
  );
  const totalRef = periodMonths.reduce(
    (s, m) =>
      s +
      calcRefrigerantCo2e(
        m.refrigerantKg ?? 0,
        m.refrigerantCode ?? 'GENERIC_HFC'
      ),
    0
  );

  const denom = totalElec + totalFuel + totalRef || 1;
  const shareOfFootprintPercent = (totalElec / denom) * 100;

  return {
    months: insightsMonths,
    totalKwh,
    totalCo2eKg,
    lastMonth,
    prevMonth,
    shareOfFootprintPercent,
  };
}

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
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-slate-900"
    >
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

export default async function ElectricityInsightsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const rawPeriod = (searchParams?.period ?? 'all') as string;
  const period: PeriodKey =
    rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === '12m'
      ? (rawPeriod as PeriodKey)
      : 'all';

  const {
    months,
    totalKwh,
    totalCo2eKg,
    lastMonth,
    prevMonth,
    shareOfFootprintPercent,
  } = await getElectricityInsights(period);

  const hasData = months.length > 0;
  const periodLabel = PERIOD_LABELS[period];

  const monthChangePercent =
    lastMonth && prevMonth && prevMonth.co2eKg > 0
      ? ((lastMonth.co2eKg - prevMonth.co2eKg) / prevMonth.co2eKg) * 100
      : null;

  const chartMonths = months.slice().reverse(); // oldest → newest
  const chartValues = chartMonths.map((m) => m.co2eKg);

  const navItems = [
    {
      href: '/dashboard/emissions/electricity',
      label: 'Electricity Insights',
      active: true,
    },
    {
      href: '/dashboard/emissions/fuel',
      label: 'Fuel Insights',
      active: false,
    },
    {
      href: '/dashboard/emissions/refrigerant',
      label: 'Refrigerant Insights',
      active: false,
    },
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
            <Link
              href="/dashboard"
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              ← Back to dashboard
            </Link>
            <span className="hidden md:inline-block h-4 w-px bg-slate-200" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Hotspot · Electricity
            </p>
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
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Electricity Insights
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Understand how electricity contributes to your footprint in this
            period. Based on your logged electricity use and grid factors.
          </p>

          {/* Period filter */}
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 p-1 text-[11px]">
            {periodPills.map((p) => {
              const active = p.key === period;
              const href =
                p.key === 'all'
                  ? '/dashboard/emissions/electricity'
                  : `/dashboard/emissions/electricity?period=${p.key}`;
              return (
                <Link
                  key={p.key}
                  href={href}
                  className={
                    'px-3 py-1 rounded-full transition hover:shadow-sm hover:-translate-y-px ' +
                    (active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900')
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
            <p className="text-sm font-medium text-slate-800">
              No electricity data yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Add emissions on the dashboard first, then this view will show how
              electricity is driving your footprint.
            </p>
          </section>
        ) : (
          <>
            {/* Key stats */}
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Total electricity CO₂e · {periodLabel}
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {formatTonnes(totalCo2eKg)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Based on {formatNumber(totalKwh)} kWh of electricity used in
                  this period.
                </p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Share of footprint
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {shareOfFootprintPercent.toFixed(1)}%
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Portion of your total emissions in this period that comes from
                  electricity.
                </p>
              </div>

              <div className="rounded-xl bg-white border p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Latest month vs previous
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {monthChangePercent === null
                    ? 'n/a'
                    : `${
                        monthChangePercent >= 0 ? '+' : ''
                      }${monthChangePercent.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Change in electricity-related CO₂e between the last two
                  reported months.
                </p>
              </div>
            </section>

            {/* Trend + table */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              <article className="rounded-xl bg-white border p-6 shadow flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Trend over time
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Electricity CO₂e per month
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <Sparkline values={chartValues} />
                  <p className="text-[11px] text-slate-600">
                    Each point is the electricity-related CO₂e for that month.
                    You&apos;ll see the line move as you log more data or make
                    changes to usage.
                  </p>
                </div>

                <div className="mt-2 border-t border-slate-100 pt-3">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100">
                        <th className="py-1.5 text-left font-medium">Month</th>
                        <th className="py-1.5 text-right font-medium">
                          Electricity (kWh)
                        </th>
                        <th className="py-1.5 text-right font-medium">
                          CO₂e (kg)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m, idx) => (
                        <tr
                          key={m.monthLabel}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="py-1.5 text-[12px] text-slate-900">
                            {m.monthLabel}
                            {idx === 0 && (
                              <span className="ml-1 text-[10px] text-emerald-600">
                                • Latest
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right text-slate-700">
                            {formatNumber(m.kwh)}
                          </td>
                          <td className="py-1.5 text-right text-slate-700">
                            {m.co2eKg.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              {/* Recommended actions */}
              <aside className="rounded-xl bg-white border p-6 shadow flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Recommended actions
                </h2>
                <p className="text-[11px] text-slate-500 mb-1">
                  Quick, practical steps focused on electricity. Use these as a
                  starting point for your reduction plan.
                </p>

                <ul className="grid gap-2 text-[11px]">
                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">
                      Optimise core building settings
                    </p>
                    <p className="text-slate-600">
                      Standardise AC setpoints, lighting schedules and PC sleep
                      timers across all sites. Track impact in this view for the
                      next 2–3 months.
                    </p>
                  </li>

                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">
                      Identify outlier sites
                    </p>
                    <p className="text-slate-600">
                      Compare kWh per site or per m². Any site significantly
                      above the rest should get a focused walk-through and
                      maintenance check.
                    </p>
                  </li>

                  <li className="border rounded-lg px-3 py-2 bg-slate-50">
                    <p className="font-semibold text-slate-900 mb-0.5">
                      Create a monthly electricity review
                    </p>
                    <p className="text-slate-600">
                      Once a month, review this chart with operations/finance
                      and agree one small change to test before the next review.
                    </p>
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
