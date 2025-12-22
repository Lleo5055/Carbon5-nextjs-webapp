// app/dashboard/emissions/view-emissions/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';

import Link from 'next/link';

// FIX: use browser supabase client (NOT supabaseServer)
import { supabase } from '../../../../lib/supabaseClient';
import Scope3ActionsCell from './Scope3ActionsCell';

import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  EF_DIESEL_KG_PER_LITRE,
  EF_PETROL_KG_PER_LITRE,
  EF_NATURAL_GAS_KG_PER_KWH,
  calcRefrigerantCo2e,
} from '../../../../lib/emissionFactors';

import RowActionsClient from './RowActionsClient';

type ReportMonth = {
  id: number | string;
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

type PeriodKey = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';

type EmissionsReport = {
  periodLabel: string;
  months: ReportMonth[];
  breakdownBySource: {
    electricitySharePercent: number;
    dieselSharePercent: number;
    petrolSharePercent: number;
    gasSharePercent: number;
    refrigerantSharePercent: number;
  };
  suggestions: string[];
  availableMonths: string[];
  totals: {
    totalCo2eKg: number;
    totalScope1and2Co2eKg: number;
    totalScope3Co2eKg: number;
    totalElecKwh: number;
    totalDieselLitres: number;
    totalPetrolLitres: number;
    totalGasKwh: number;
    totalRefKg: number;
  };
  scope3Rows?: any[] | null;
};

type Plan = 'free' | 'growth' | 'pro' | 'enterprise';

/* ---------- Formatting helpers ---------- */
function formatKg(v: number) {
  return `${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatKgValue(v: number) {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTonnes(v: number) {
  return `${(v / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} t CO₂e`;
}

/* ---------- Label helpers ---------- */
function labelForPeriod(
  period: PeriodKey,
  customStart?: string | null,
  customEnd?: string | null
): string {
  if (period === 'custom' && customStart && customEnd) {
    return `${customStart} – ${customEnd}`;
  }
  switch (period) {
    case '1m':
      return 'Last 1 month';
    case '3m':
      return 'Last 3 months';
    case '6m':
      return 'Last 6 months';
    case '12m':
      return 'Last 12 months';
    case 'all':
    default:
      return 'All data';
  }
}

/* ---------- Period filtering ---------- */
function applyFixedPeriod(
  allMonths: ReportMonth[],
  period: PeriodKey
): ReportMonth[] {
  if (period === 'all' || period === 'custom') return allMonths;

  const countMap: Record<PeriodKey, number> = {
    all: allMonths.length,
    custom: allMonths.length,
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12,
  };

  return allMonths.slice(-(countMap[period] ?? allMonths.length));
}

function applyCustomRange(
  allMonths: ReportMonth[],
  customStart?: string | null,
  customEnd?: string | null
): ReportMonth[] {
  if (!customStart || !customEnd) return allMonths;

  const labels = allMonths.map((m) => m.monthLabel);
  const startIdx = labels.indexOf(customStart);
  const endIdx = labels.indexOf(customEnd);

  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    return allMonths;
  }

  return allMonths.slice(startIdx, endIdx + 1);
}

/* ---------- FIXED: Safe Supabase ---------- */
async function getCurrentPlan(): Promise<Plan> {
  const { data, error } = await supabase
    .from('user_plans')
    .select('plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error('View-emissions: error loading user plan', error);

  return (data?.plan as Plan | null) ?? 'free';
}

/* ---------- MAIN REPORT BUILDER ---------- */
async function getEmissionsReport(
  
  period: PeriodKey,
  customStart?: string | null,
  customEnd?: string | null
): Promise<EmissionsReport> {
  // ✅ FIX: use supabase directly
  const db = supabase;
console.log('[VIEW-EMISSIONS] getEmissionsReport START');

const { data: sessionData } = await supabase.auth.getSession();

  const { data, error } = await db
    .from('emissions')
    .select('*')
    .order('month', { ascending: true });

  const { data: scope3Rows, error: scope3Error } = await db
    .from('scope3_activities')
    .select('*')
    .order('month', { ascending: true });

  if (error || !data) {
    if (error) console.error('Error loading emissions for report', error);

    return {
      periodLabel: labelForPeriod(period, customStart, customEnd),
      months: [],
      breakdownBySource: {
        electricitySharePercent: 0,
        dieselSharePercent: 0,
        petrolSharePercent: 0,
        gasSharePercent: 0,
        refrigerantSharePercent: 0,
      },
      suggestions: [],
      availableMonths: [],
      totals: {
        totalCo2eKg: 0,
        totalScope1and2Co2eKg: 0,
        totalScope3Co2eKg: 0,
        totalElecKwh: 0,
        totalDieselLitres: 0,
        totalPetrolLitres: 0,
        totalGasKwh: 0,
        totalRefKg: 0,
      },
    };
  }

  if (scope3Error) {
    console.error('Error loading scope 3 activities for report', scope3Error);
  }

  const allMonths: ReportMonth[] = data.map((row: any) => {
    const electricityKwh = Number(row.electricity_kw ?? 0);
    const dieselLitres = Number(row.diesel_litres ?? 0);
    const petrolLitres = Number(row.petrol_litres ?? 0);
    const gasKwh = Number(row.gas_kwh ?? 0);
    const refrigerantKg = Number(row.refrigerant_kg ?? 0);

    const refrigerantCode =
      (row.refrigerant_code as string | null) ??
      (row.refrigerant_type as string | null) ??
      'GENERIC_HFC';

    const legacyFuelLitres = Number(row.fuel_liters ?? 0);
    const computedFuelLitres =
      dieselLitres + petrolLitres > 0
        ? dieselLitres + petrolLitres
        : legacyFuelLitres;

    return {
      id: row.id ?? `${row.month ?? ''}-${Math.random()}`,
      monthLabel: row.month ?? 'Unknown month',
      electricityKwh,
      fuelLitres: computedFuelLitres,
      refrigerantKg,
      totalCo2eKg: Number(row.total_co2e ?? 0),
      dieselLitres,
      petrolLitres,
      gasKwh,
      refrigerantCode,
    };
  });

  const months =
    period === 'custom'
      ? applyCustomRange(allMonths, customStart, customEnd)
      : applyFixedPeriod(allMonths, period);

  const includedMonthLabels = new Set(months.map((m) => m.monthLabel));
  const scope3ForPeriod = (scope3Rows ?? []).filter(
    (row: any) => row.month && includedMonthLabels.has(row.month as string)
  );

  const totalScope3Co2eKg = scope3ForPeriod.reduce(
    (sum, row: any) => sum + Number(row.co2e_kg ?? 0),
    0
  );

  if (scope3ForPeriod.length > 0) {
    const monthMap = new Map<string, ReportMonth>(
      months.map((m) => [m.monthLabel, m])
    );
    scope3ForPeriod.forEach((row: any) => {
      const label = row.month as string | undefined;
      if (!label) return;
      const m = monthMap.get(label);
      if (!m) return;
      const add = Number(row.co2e_kg ?? 0) || 0;
      m.totalCo2eKg += add;
    });
  }

  const totalElecCo2 = months.reduce(
    (s, m) => s + m.electricityKwh * EF_GRID_ELECTRICITY_KG_PER_KWH,
    0
  );
  const totalDieselCo2 = months.reduce(
    (s, m) => s + (m.dieselLitres ?? 0) * EF_DIESEL_KG_PER_LITRE,
    0
  );
  const totalPetrolCo2 = months.reduce(
    (s, m) => s + (m.petrolLitres ?? 0) * EF_PETROL_KG_PER_LITRE,
    0
  );
  const totalGasCo2 = months.reduce(
    (s, m) => s + (m.gasKwh ?? 0) * EF_NATURAL_GAS_KG_PER_KWH,
    0
  );
  const totalRefCo2 = months.reduce(
    (s, m) =>
      s + calcRefrigerantCo2e(m.refrigerantKg ?? 0, m.refrigerantCode ?? ''),
    0
  );

  const denom =
    totalElecCo2 +
      totalDieselCo2 +
      totalPetrolCo2 +
      totalGasCo2 +
      totalRefCo2 || 1;

  const breakdownBySource = {
    electricitySharePercent: Math.round((totalElecCo2 / denom) * 1000) / 10,
    dieselSharePercent: Math.round((totalDieselCo2 / denom) * 1000) / 10,
    petrolSharePercent: Math.round((totalPetrolCo2 / denom) * 1000) / 10,
    gasSharePercent: Math.round((totalGasCo2 / denom) * 1000) / 10,
    refrigerantSharePercent: Math.round((totalRefCo2 / denom) * 1000) / 10,
  };

  const suggestions: string[] = [];
  const {
    electricitySharePercent,
    dieselSharePercent,
    petrolSharePercent,
    gasSharePercent,
    refrigerantSharePercent,
  } = breakdownBySource;

  if (electricitySharePercent > 25) {
    suggestions.push(
      'Electricity is a major driver. Review lighting, HVAC setpoints and idle equipment.'
    );
  }
  if (dieselSharePercent > 20) {
    suggestions.push(
      'Diesel usage is high. Optimise routing, reduce idling and consider driver training.'
    );
  }
  if (petrolSharePercent > 15) {
    suggestions.push(
      'Petrol vehicles are contributing significantly. Look at pooling, switching to diesel or EV where practical.'
    );
  }
  if (gasSharePercent > 15) {
    suggestions.push(
      'Gas for heating is material. Check thermostat schedules, insulation and night/weekend setpoints.'
    );
  }
  if (refrigerantSharePercent > 10) {
    suggestions.push(
      'Refrigerant leakage / top-ups are significant. Prioritise leak checks and preventative servicing.'
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Footprint is fairly balanced. Pick one source and run a 2–3 month pilot to see measurable change.'
    );
  }

  const availableMonths = Array.from(
    new Set(allMonths.map((m) => m.monthLabel))
  );

  const totalCo2eKg = months.reduce((s, m) => s + m.totalCo2eKg, 0);
  const totalScope1and2Co2eKg = totalCo2eKg - totalScope3Co2eKg;

  const totalElecKwh = months.reduce((s, m) => s + m.electricityKwh, 0);
  const totalDieselLitres = months.reduce(
    (s, m) => s + (m.dieselLitres ?? 0),
    0
  );
  const totalPetrolLitres = months.reduce(
    (s, m) => s + (m.petrolLitres ?? 0),
    0
  );
  const totalGasKwh = months.reduce((s, m) => s + (m.gasKwh ?? 0), 0);
  const totalRefKg = months.reduce((s, m) => s + (m.refrigerantKg ?? 0), 0);

  return {
    periodLabel: labelForPeriod(period, customStart, customEnd),
    months,
    breakdownBySource,
    suggestions,
    availableMonths,
    totals: {
      totalCo2eKg,
      totalScope1and2Co2eKg,
      totalScope3Co2eKg,
      totalElecKwh,
      totalDieselLitres,
      totalPetrolLitres,
      totalGasKwh,
      totalRefKg,
    },
    scope3Rows,
  };
}

/* ---------- Trend Chart Component (unchanged) ---------- */
function MonthlyTrendChart({ months }: { months: ReportMonth[] }) {
  if (!months || months.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-[11px] text-slate-400">
        No data yet for this view.
      </div>
    );
  }

  const latest = months.slice(-12);
  const values = latest.map((m) => m.totalCo2eKg);
  const max = Math.max(...values) || 1;

  const width = 400;
  const height = 120;
  const padX = 28;
  const padY = 16;

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const stepForPoints =
    latest.length > 1 ? innerW / (latest.length - 1) : innerW / 2;

  const points = latest
    .map((m, i) => {
      const x = padX + i * stepForPoints;
      const y = padY + innerH - (m.totalCo2eKg / max) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const first = latest[0]?.monthLabel ?? '';
  const last = latest[latest.length - 1]?.monthLabel ?? '';
  const mid =
    latest.length >= 3 ? latest[Math.floor(latest.length / 2)].monthLabel : '';

  const baselineY = padY + innerH;
  const midY = padY + innerH / 2;
  const topY = padY;

  const tooltipText = (m: ReportMonth) =>
    `${m.monthLabel}: ${m.totalCo2eKg.toFixed(2)} kg CO₂e`;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="text-emerald-700"
      >
        <rect width={width} height={height} rx={10} className="fill-slate-50" />

        <line
          x1={padX}
          y1={topY}
          x2={width - padX}
          y2={topY}
          className="stroke-slate-200/70"
          strokeWidth={0.6}
        />
        <line
          x1={padX}
          y1={midY}
          x2={width - padX}
          y2={midY}
          className="stroke-slate-200/80"
          strokeWidth={0.6}
          strokeDasharray="2 3"
        />
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          className="stroke-slate-200"
          strokeWidth={0.8}
        />

        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {latest.map((m) => {
          const x = padX + latest.indexOf(m) * stepForPoints;
          const y = padY + innerH - (m.totalCo2eKg / max) * innerH;

          return (
            <g key={m.id}>
              <circle
                cx={x}
                cy={y}
                r={5}
                fill="white"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <title>{tooltipText(m)}</title>
              </circle>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        <span>{first}</span>
        <span>{mid}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

/* ---------- MAIN PAGE ---------- */
interface Props {
  searchParams?: {
    period?: string;
    start?: string;
    end?: string;
    deleted?: string;
    deletedMonth?: string;
  };
}

export default function ViewEmissionsPage({ searchParams }: Props) {
  // -----------------------------
  // STATE
  // -----------------------------
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>('free');
  const [report, setReport] = useState<EmissionsReport | null>(null);
const [userId, setUserId] = useState<string | null>(null);

  // -----------------------------
  // PARAMS (must come BEFORE useEffect)
  // -----------------------------
  const raw = (searchParams?.period ?? 'all') as PeriodKey;
  const period: PeriodKey = ['1m', '3m', '6m', '12m', 'all', 'custom'].includes(
    raw
  )
    ? raw
    : 'all';

  const customStart = searchParams?.start ?? null;
  const customEnd = searchParams?.end ?? null;

  const deletedMonth = searchParams?.deletedMonth ?? null;
  const showDeletedToast =
    searchParams?.deleted === '1' && typeof deletedMonth === 'string';

  

// -----------------------------
// AUTH USER (CLIENT ONLY)  ✅ EDIT 2 GOES HERE
// -----------------------------
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUserId(data.user?.id ?? null);
  });
}, []);

// -----------------------------
// DATA LOAD (CLIENT ONLY)
// -----------------------------
useEffect(() => {
  let mounted = true;

  async function load() {
    setLoading(true);

    const p = await getCurrentPlan();
    const r = await getEmissionsReport(period, customStart, customEnd);

    if (!mounted) return;

    setPlan(p);
    setReport(r);
    setLoading(false);
  }

  load();

  return () => {
    mounted = false;
  };
}, [period, customStart, customEnd]);


  // -----------------------------
  // LOADING GATE
  // -----------------------------
  if (loading || !report) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs text-slate-500">Loading emissions…</p>
      </main>
    );
  }

  // -----------------------------
  // SAFE DESTRUCTURE (report is now guaranteed)
  // -----------------------------
  const {
    months,
    breakdownBySource,
    suggestions,
    periodLabel,
    availableMonths,
    totals,
    scope3Rows,
  } = report;

  const isFreePlan = plan === 'free';

  const hasData = months.length > 0;
  const totalCo2e = totals.totalCo2eKg;
  const totalScope3 = totals.totalScope3Co2eKg ?? 0;
  const hasScope3InPeriod = totalScope3 > 0;

  const avg = hasData ? totalCo2e / months.length : 0;

  const latest =
    months[months.length - 1] ??
    ({
      id: 'placeholder',
      monthLabel: '-',
      electricityKwh: 0,
      fuelLitres: 0,
      refrigerantKg: 0,
      totalCo2eKg: 0,
    } as ReportMonth);

  const latestMonthLabel = latest.monthLabel;

  // -----------------------------
  // REMAINING LOGIC (unchanged)
  // -----------------------------
  const { totalElecKwh, totalDieselLitres, totalPetrolLitres, totalGasKwh } =
    totals;

  const {
    electricitySharePercent,
    dieselSharePercent,
    petrolSharePercent,
    gasSharePercent,
    refrigerantSharePercent,
  } = breakdownBySource;

  type Hotspot = 'Electricity' | 'Diesel' | 'Petrol' | 'Gas' | 'Refrigerant';

  const sourceShares: { key: Hotspot; value: number }[] = [
    { key: 'Electricity', value: electricitySharePercent },
    { key: 'Diesel', value: dieselSharePercent },
    { key: 'Petrol', value: petrolSharePercent },
    { key: 'Gas', value: gasSharePercent },
    { key: 'Refrigerant', value: refrigerantSharePercent },
  ];

  const mainSource = sourceShares.reduce((best, current) =>
    current.value > best.value ? current : best
  );

  const hotspot: Hotspot = mainSource.key;
  const hotspotSharePercent = mainSource.value;

  const hotspotContextMap: Record<Hotspot, string> = {
    Electricity: 'Electricity use',
    Diesel: 'Diesel fleet',
    Petrol: 'Petrol vehicles',
    Gas: 'Gas for heating',
    Refrigerant: 'Refrigerant leakage / cooling gases',
  };

  const hotspotContext = hotspotContextMap[hotspot];

  const opts = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: '12m', label: '12M' },
    { key: 'all', label: 'All' },
  ] as const;

  const defaultStart =
    customStart && availableMonths.includes(customStart)
      ? customStart
      : availableMonths[0] ?? '';

  const defaultEnd =
    customEnd && availableMonths.includes(customEnd)
      ? customEnd
      : availableMonths[availableMonths.length - 1] ?? '';

  // -----------------------------
  // JSX RETURN (your existing JSX continues here)
  // -----------------------------
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Success toast */}
      {showDeletedToast && deletedMonth && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span>Deleted emissions for {deletedMonth}.</span>
            <Link
              href="/dashboard/emissions/view-emissions"
              className="underline-offset-2 hover:underline"
            >
              Dismiss
            </Link>
          </div>
        </div>
      )}

      {/* ⬇️ REST OF YOUR JSX STAYS EXACTLY THE SAME ⬇️ */}


      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* Top Header */}
        <section className="rounded-xl bg-white border p-6 shadow">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] uppercase text-slate-500">
                Emissions report
              </p>
              <h1 className="text-2xl font-semibold text-slate-900 mt-1">
                Your emissions history
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Review your monthly footprint, switch periods, and export a
                clean PDF whenever you need it.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800">
                  {periodLabel}
                </span>
                {hasData && (
                  <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                    {months.length === 1
                      ? '1 month of data'
                      : `${months.length} months of data`}
                  </span>
                )}
                {hasScope3InPeriod && (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Includes Scope 3 where logged
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filters + Actions Row */}
          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {/* Left filters */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-500 mr-1">Quick view:</span>

              {opts.map((opt) => {
                const active = opt.key === period;
                return (
                  <Link
                    key={opt.key}
                    href={`/dashboard/emissions/view-emissions?period=${opt.key}`}
                    className={
                      active
                        ? 'px-3 py-1 rounded-full bg-slate-900 text-white'
                        : 'px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-900 hover:text-white'
                    }
                  >
                    {opt.label}
                  </Link>
                );
              })}

              {/* Custom date range */}
              {availableMonths.length > 0 && (
                <form
                  method="GET"
                  action="/dashboard/emissions/view-emissions"
                  className="flex flex-wrap items-center gap-2 mt-1"
                >
                  <input type="hidden" name="period" value="custom" />
                  <span className="text-slate-500">Custom range:</span>

                  <select
                    name="start"
                    defaultValue={defaultStart}
                    className="border rounded-full px-3 py-1 bg-white"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <span>to</span>

                  <select
                    name="end"
                    defaultValue={defaultEnd}
                    className="border rounded-full px-3 py-1 bg-white"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="px-4 py-1 rounded-full bg-slate-900 text-white"
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            {/* Actions (right side) */}
            <div className="flex flex-col items-stretch gap-1 lg:items-end">
              <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                {/* PDF */}
                <form method="GET" action="/api/report" target="_blank">
  <input type="hidden" name="userId" value={userId ?? ''} />

  <input
    type="hidden"
    name="periodType"
    value={period === 'custom' ? 'custom' : 'quick'}
  />
  <input type="hidden" name="period" value={period} />

  {period === 'custom' && (
    <>
      <input type="hidden" name="start" value={customStart ?? ''} />
      <input type="hidden" name="end" value={customEnd ?? ''} />
    </>
  )}

  <button type="submit" className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white">
    Emission Report
  </button>
</form>

                {/* Leadership Snapshot */}
                <a
                  href="/api/snapshot"
                  target="_blank"
                  className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                >
                  Leadership Snapshot
                </a>

                {/* CSV / Excel */}
                {isFreePlan ? (
                  <>
                    <button
                      type="button"
                      disabled
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-slate-50 text-slate-400 border-dashed border-slate-300 cursor-not-allowed"
                    >
                      Export CSV (Growth+)
                    </button>
                    <button
                      type="button"
                      disabled
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-slate-50 text-slate-400 border-dashed border-slate-300 cursor-not-allowed"
                    >
                      Export Excel (Growth+)
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href="/api/export/csv?period=all"
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                    >
                      Export CSV
                    </a>
                    <a
                      href="/api/export/xls?period=all"
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                    >
                      Export Excel
                    </a>
                  </>
                )}

                {/* Add emission */}
                <Link
                  href="/dashboard/emissions"
                  className="h-[32px] px-3 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center hover:bg-slate-800"
                >
                  + Add emission
                </Link>

                {/* Dashboard */}
                <Link
                  href="/dashboard"
                  className="h-[32px] px-3 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                >
                  Dashboard
                </Link>
              </div>

              {isFreePlan && (
                <p className="text-[11px] text-slate-500 mt-1 text-right">
                  On the Free plan you get PDF reports. CSV and Excel exports
                  unlock on <span className="font-medium">Growth</span> and
                  above.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* NO DATA */}
        {!hasData ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">
              No data available.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Add some activity from your dashboard to generate your first
              report.
            </p>
          </section>
        ) : (
          <>
            {/* MAIN CONTENT */}
            <section className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="grid sm:grid-cols-3 gap-5 items-stretch">
                  {/* TOTAL */}
                  <article className="rounded-xl bg-white border p-6 shadow flex flex-col justify-between h-full">
                    <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      <span className="text-[11px]">📊</span>
                      <span>Total CO₂e</span>
                    </p>
                    <div>
                      <p className="text-3xl font-semibold mt-3">
                        {formatKg(totalCo2e)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Across {months.length} reported months.
                      </p>

                      {hasScope3InPeriod && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Includes {formatKg(totalScope3)} Scope 3 in this
                          period.
                        </p>
                      )}
                    </div>
                  </article>

                  {/* LATEST */}
                  <article className="rounded-xl bg-white border p-6 shadow flex flex-col justify-between h-full">
                    <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      <span className="text-[11px]">🗓️</span>
                      <span>Latest month</span>
                    </p>
                    <div>
                      <p className="text-sm font-medium mt-3">
                        {latest.monthLabel}
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {formatTonnes(latest.totalCo2eKg)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Avg: {formatKgValue(avg)} kg/month
                      </p>
                    </div>
                  </article>

                  {/* HOTSPOT */}
                  <article className="rounded-xl bg-white border p-6 shadow flex flex-col justify-between h-full">
                    <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      <span className="text-[11px]">🔥</span>
                      <span>Main hotspot</span>
                    </p>
                    <div>
                      <p className="text-lg font-medium mt-3">{hotspot}</p>

                      <p className="text-[11px] text-slate-500 mt-1">
                        Electricity: {electricitySharePercent}% · Diesel:{' '}
                        {dieselSharePercent}% · Petrol: {petrolSharePercent}% ·
                        Gas: {gasSharePercent}% · Refrigerant:{' '}
                        {refrigerantSharePercent}%
                      </p>

                      <p className="text-[11px] text-slate-500 mt-1">
                        {hotspotContext} caused {hotspotSharePercent}% of
                        emissions.
                      </p>
                    </div>
                  </article>
                </div>

                {/* TREND */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">
                    Trend by month (CO₂e)
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Shows last 12 months. Hover dots for exact values.
                  </p>
                  <div className="mt-4">
                    <MonthlyTrendChart months={months} />
                  </div>
                </article>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Breakdown */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">Emissions breakdown</h2>
                  <div className="mt-4 space-y-2 text-xs leading-relaxed">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Electricity</span>
                      <span className="text-right tabular-nums min-w-[3ch]">
                        {electricitySharePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Diesel</span>
                      <span className="text-right tabular-nums min-w-[3ch]">
                        {dieselSharePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Petrol</span>
                      <span className="text-right tabular-nums min-w-[3ch]">
                        {petrolSharePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Gas</span>
                      <span className="text-right tabular-nums min-w-[3ch]">
                        {gasSharePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Refrigerant</span>
                      <span className="text-right tabular-nums min-w-[3ch]">
                        {refrigerantSharePercent}%
                      </span>
                    </div>
                  </div>
                </article>

                {/* Fuel detail */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">Fuel detail (UK)</h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Volumes for selected period.
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Diesel</span>
                      <span className="tabular-nums">
                        {totalDieselLitres.toLocaleString()} L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Petrol</span>
                      <span className="tabular-nums">
                        {totalPetrolLitres.toLocaleString()} L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gas</span>
                      <span className="tabular-nums">
                        {totalGasKwh.toLocaleString()} kWh
                      </span>
                    </div>
                  </div>
                </article>

                {/* Suggestions */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">Suggested actions</h2>
                  {suggestions.length === 0 ? (
                    <p className="text-xs text-slate-600 mt-2">
                      Add more data to get tailored recommendations.
                    </p>
                  ) : (
                    <ul className="mt-2 text-xs space-y-1">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-slate-700"
                        >
                          <span className="mt-[2px] text-[10px]">
                            {i === 0 ? '⚡' : '🔧'}
                          </span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            </section>

            {/* TABLE */}
            <section className="rounded-xl bg-white border p-6 shadow">
              <h2 className="text-sm font-semibold mb-3">
                All emissions (CO₂e totals include Scope 3 where logged)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Month</th>
                      <th className="p-2 text-left">Electricity (kWh)</th>
                      <th className="p-2 text-left">Diesel (L)</th>
                      <th className="p-2 text-left">Petrol (L)</th>
                      <th className="p-2 text-left">Gas (kWh)</th>
                      <th className="p-2 text-left">Refrigerant (kg)</th>
                      <th className="p-2 text-left">Total CO₂e (kg)</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const isLatest = m.monthLabel === latestMonthLabel;
                      return (
                        <tr
                          key={m.id}
                          className={`border-b last:border-0 border-[rgb(240,240,240)] ${
                            isLatest ? 'bg-slate-50' : ''
                          }`}
                        >
                          <td className="p-2 font-medium text-slate-900">
                            {m.monthLabel}
                          </td>
                          <td className="p-2">{m.electricityKwh}</td>
                          <td className="p-2">{m.dieselLitres ?? 0}</td>
                          <td className="p-2">{m.petrolLitres ?? 0}</td>
                          <td className="p-2">{m.gasKwh ?? 0}</td>
                          <td className="p-2">{m.refrigerantKg}</td>
                          <td className="p-2">
                            {formatKgValue(m.totalCo2eKg)}
                          </td>
                          <td className="p-2">
                            <RowActionsClient
                              id={m.id}
                              monthLabel={m.monthLabel}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            {/* ============================== */}
            {/* SCOPE 3 ACTIVITY LOG  */}
            {/* ============================== */}

            <section className="mt-10">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">
                Scope 3 activity log (optional)
              </h2>

              {(scope3Rows?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">
                  No Scope 3 activities recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          Month
                        </th>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          Category
                        </th>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          Label
                        </th>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          Activity
                        </th>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          CO₂e (kg)
                        </th>
                        <th className="p-2 text-left uppercase text-[10px] text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(scope3Rows ?? []).map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="p-2">{row.month}</td>
                          <td className="p-2 capitalize">
                            {row.category.replaceAll('_', ' ')}
                          </td>
                          <td className="p-2">{row.label || '—'}</td>
                          <td className="p-2">
                            {row.data?.activity_value}{' '}
                            <span className="text-slate-400">
                              {row.data?.unit}
                            </span>
                          </td>
                          <td className="p-2 font-medium">
                            {row.co2e_kg?.toFixed(1)}
                          </td>

                          <td className="p-2">
                            <Scope3ActionsCell row={row} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
