// app/dashboard/emissions/view-emissions/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
// useLayoutEffect fires before paint (client only); fall back to useEffect on server to avoid SSR warning
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

import Link from 'next/link';

// FIX: use browser supabase client (NOT supabaseServer)
import { supabase } from '../../../../lib/supabaseClient';
import Scope3ActionsCell from './Scope3ActionsCell';

import { calcRefrigerantCo2e } from '../../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { logActivity } from '../../../../lib/logActivity';

import RowActionsClient from './RowActionsClient';
import SectionCActions from './SectionCActions';
const EMISSIONS_CACHE_KEY = 'view_emissions_report_v1';
const INDIA_ENV_CACHE_KEY  = 'greenio_india_env_v1';


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
  lpgKg?: number;
  cngKg?: number;
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
    lpgSharePercent: number;
    cngSharePercent: number;
    refrigerantSharePercent: number;
    scope3SharePercent: number;
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
    totalLpgKg: number;
    totalCngKg: number;
    totalRefKg: number;
    totalScope1Co2eKg: number;
    totalScope2Co2eKg: number;
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

const PLAN_CACHE_KEY = 'greenio_plan_v1';
const FREE_REPORT_CACHE_KEY = `greenio_free_report_used_${new Date().getFullYear()}`;

/* ---------- FIXED: Safe Supabase ---------- */
async function getCurrentPlan(): Promise<Plan> {
  const { data: { session } } = await supabase.auth.getSession(); // local, no network
  const user = session?.user;
  if (!user) return 'free';

  // Fire own plan + team membership lookup in parallel
  const [{ data: ownPlan, error }, { data: membership }] = await Promise.all([
    supabase.from('user_plans').select('plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('team_members').select('owner_id').eq('member_user_id', user.id).eq('status', 'active').maybeSingle(),
  ]);

  if (error) console.error('View-emissions: error loading user plan', error);

  if (membership?.owner_id && membership.owner_id !== user.id) {
    // Team member — owner's plan takes precedence (owner must be Growth+)
    const { data: ownerProfile } = await supabase
      .from('user_plans').select('plan').eq('user_id', membership.owner_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const plan = (ownerProfile?.plan as Plan | null) ?? 'growth';
    try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
    return plan;
  }

  const plan = (ownPlan?.plan as Plan | null) ?? 'free';
  try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
  return plan;
}

/* ---------- MAIN REPORT BUILDER ---------- */
async function getEmissionsReport(
  
  period: PeriodKey,
  customStart?: string | null,
  customEnd?: string | null
): Promise<EmissionsReport> {
  const [{ data, error }, { data: scope3Rows, error: scope3Error }] = await Promise.all([
    supabase.from('emissions').select('*').order('month', { ascending: true }),
    supabase.from('scope3_activities').select('*').order('month', { ascending: true }),
  ]);

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
        lpgSharePercent: 0,
        cngSharePercent: 0,
        refrigerantSharePercent: 0,
        scope3SharePercent: 0,
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
        totalLpgKg: 0,
        totalCngKg: 0,
        totalRefKg: 0,
        totalScope1Co2eKg: 0,
        totalScope2Co2eKg: 0,
      },
    };
  }

  if (scope3Error) {
    console.error('Error loading scope 3 activities for report', scope3Error);
  }

  // Get country-aware factors from the first row's country_code
  const countryCode = data[0]?.country_code ?? 'GB';
  const ef = getFactorsForCountry(countryCode);

  const allMonths: ReportMonth[] = data.map((row: any) => {
    const electricityKwh = Number(row.electricity_kw ?? 0);
    const dieselLitres = Number(row.diesel_litres ?? 0);
    const petrolLitres = Number(row.petrol_litres ?? 0);
    const gasKwh = Number(row.gas_kwh ?? 0);
    const lpgKg = Number(row.lpg_kg ?? 0);
    const cngKg = Number(row.cng_kg ?? 0);
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
      totalCo2eKg:
        electricityKwh * ef.electricity +
        dieselLitres * ef.diesel +
        petrolLitres * ef.petrol +
        gasKwh * ef.gas +
        lpgKg * ef.lpgKg +
        cngKg * ef.cngKg +
        calcRefrigerantCo2e(refrigerantKg, refrigerantCode),
      dieselLitres,
      petrolLitres,
      gasKwh,
      lpgKg,
      cngKg,
      refrigerantCode,
    };
  });

  allMonths.sort((a, b) => new Date(a.monthLabel).getTime() - new Date(b.monthLabel).getTime());

  const months =
    period === 'custom'
      ? applyCustomRange(allMonths, customStart, customEnd)
      : applyFixedPeriod(allMonths, period);

  // Filter scope3 by period independently of scope1/2 months
  // so scope3-only months are not excluded
  let scope3ForPeriod: any[];
  if (period === 'all') {
    scope3ForPeriod = scope3Rows ?? [];
  } else if (period === 'custom' && customStart && customEnd) {
    scope3ForPeriod = (scope3Rows ?? []).filter(
      (r: any) => r.month && r.month >= customStart && r.month <= customEnd
    );
  } else {
    const n = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - n);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
    scope3ForPeriod = (scope3Rows ?? []).filter(
      (r: any) => r.month && (r.month as string) >= cutoffStr
    );
  }

  const totalScope3Co2eKg = scope3ForPeriod.reduce(
    (sum: number, row: any) => sum + Number(row.co2e_kg ?? 0),
    0
  );

  // Merge scope3 into months; create stub entries for scope3-only months
  const monthMap = new Map<string, ReportMonth>(months.map((m) => [m.monthLabel, m]));
  scope3ForPeriod.forEach((row: any) => {
    const label = row.month as string | undefined;
    if (!label) return;
    if (!monthMap.has(label)) {
      const stub: ReportMonth = {
        id: `s3-${label}`,
        monthLabel: label,
        electricityKwh: 0,
        fuelLitres: 0,
        refrigerantKg: 0,
        totalCo2eKg: 0,
        dieselLitres: 0,
        petrolLitres: 0,
        gasKwh: 0,
        lpgKg: 0,
        cngKg: 0,
      };
      monthMap.set(label, stub);
      months.push(stub);
    }
    monthMap.get(label)!.totalCo2eKg += Number(row.co2e_kg ?? 0) || 0;
  });
  months.sort((a, b) => new Date(a.monthLabel).getTime() - new Date(b.monthLabel).getTime());

  const totalElecCo2 = months.reduce(
    (s, m) => s + m.electricityKwh * ef.electricity,
    0
  );
  const totalDieselCo2 = months.reduce(
    (s, m) => s + (m.dieselLitres ?? 0) * ef.diesel,
    0
  );
  const totalPetrolCo2 = months.reduce(
    (s, m) => s + (m.petrolLitres ?? 0) * ef.petrol,
    0
  );
  const totalGasCo2 = months.reduce(
    (s, m) => s + (m.gasKwh ?? 0) * ef.gas,
    0
  );
  const totalLpgCo2 = months.reduce(
    (s, m) => s + (m.lpgKg ?? 0) * ef.lpgKg,
    0
  );
  const totalCngCo2 = months.reduce(
    (s, m) => s + (m.cngKg ?? 0) * ef.cngKg,
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
      totalLpgCo2 +
      totalCngCo2 +
      totalRefCo2 +
      totalScope3Co2eKg || 1;

  const breakdownBySource = {
    electricitySharePercent: Math.round((totalElecCo2 / denom) * 1000) / 10,
    dieselSharePercent: Math.round((totalDieselCo2 / denom) * 1000) / 10,
    petrolSharePercent: Math.round((totalPetrolCo2 / denom) * 1000) / 10,
    gasSharePercent: Math.round((totalGasCo2 / denom) * 1000) / 10,
    lpgSharePercent: Math.round((totalLpgCo2 / denom) * 1000) / 10,
    cngSharePercent: Math.round((totalCngCo2 / denom) * 1000) / 10,
    refrigerantSharePercent: Math.round((totalRefCo2 / denom) * 1000) / 10,
    scope3SharePercent: Math.round((totalScope3Co2eKg / denom) * 1000) / 10,
  };

  const suggestions: string[] = [];
  const {
    electricitySharePercent,
    dieselSharePercent,
    petrolSharePercent,
    gasSharePercent,
    lpgSharePercent,
    cngSharePercent,
    refrigerantSharePercent,
    scope3SharePercent,
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
  if (lpgSharePercent > 15) {
    suggestions.push(
      'LPG usage is significant. Consider switching to piped natural gas or electrification where feasible.'
    );
  }
  if (cngSharePercent > 15) {
    suggestions.push(
      'CNG usage is significant. Review fleet and equipment efficiency or consider electrification options.'
    );
  }
  if (refrigerantSharePercent > 10) {
    suggestions.push(
      'Refrigerant leakage / top-ups are significant. Prioritise leak checks and preventative servicing.'
    );
  }
  if (scope3SharePercent > 15) {
    suggestions.push(
      'Scope 3 is a material part of your footprint. Engage key suppliers and review business travel policy.'
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
  const totalScope1Co2eKg = totalDieselCo2 + totalPetrolCo2 + totalGasCo2 + totalLpgCo2 + totalCngCo2 + totalRefCo2;
  const totalScope2Co2eKg = totalElecCo2;

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
  const totalLpgKg = months.reduce((s, m) => s + (m.lpgKg ?? 0), 0);
  const totalCngKg = months.reduce((s, m) => s + (m.cngKg ?? 0), 0);
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
      totalLpgKg,
      totalCngKg,
      totalRefKg,
      totalScope1Co2eKg,
      totalScope2Co2eKg,
    },
    scope3Rows,
  };
}

/* ---------- Trend Chart Component (unchanged) ---------- */
function MonthlyTrendChart({ months }: { months: ReportMonth[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

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

  const activeMonth = activeIdx !== null ? latest[activeIdx] : null;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="text-emerald-700"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <rect width={width} height={height} rx={10} className="fill-slate-50" />

        <line x1={padX} y1={topY} x2={width - padX} y2={topY} className="stroke-slate-200/70" strokeWidth={0.6} />
        <line x1={padX} y1={midY} x2={width - padX} y2={midY} className="stroke-slate-200/80" strokeWidth={0.6} strokeDasharray="2 3" />
        <line x1={padX} y1={baselineY} x2={width - padX} y2={baselineY} className="stroke-slate-200" strokeWidth={0.8} />

        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {latest.map((m, i) => {
          const x = padX + i * stepForPoints;
          const y = padY + innerH - (m.totalCo2eKg / max) * innerH;
          const isActive = activeIdx === i;
          return (
            <g key={m.id}
              onMouseEnter={() => setActiveIdx(i)}
              onTouchStart={(e) => { e.preventDefault(); setActiveIdx(activeIdx === i ? null : i); }}
              style={{ cursor: 'pointer' }}
            >
              {/* Larger invisible hit area for touch */}
              <circle cx={x} cy={y} r={16} fill="transparent" />
              <circle cx={x} cy={y} r={isActive ? 6 : 5} fill="white" stroke="currentColor" strokeWidth={isActive ? 2.5 : 1.6} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip bar — shown on hover (desktop) or tap (mobile) */}
      <div className="mt-1 h-6 flex items-center justify-center">
        {activeMonth ? (
          <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-3 py-0.5 rounded-full">
            {activeMonth.monthLabel}: {activeMonth.totalCo2eKg.toFixed(2)} kg CO₂e
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Tap a dot for exact value</span>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{first}</span>
        <span>{mid}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  
  const [plan, setPlan] = useState<Plan>('free');
  const [report, setReport] = useState<EmissionsReport>({
  periodLabel: '',
  months: [],
  breakdownBySource: {
    electricitySharePercent: 0,
    dieselSharePercent: 0,
    petrolSharePercent: 0,
    gasSharePercent: 0,
    lpgSharePercent: 0,
    cngSharePercent: 0,
    refrigerantSharePercent: 0,
    scope3SharePercent: 0,
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
    totalLpgKg: 0,
    totalCngKg: 0,
    totalRefKg: 0,
    totalScope1Co2eKg: 0,
    totalScope2Co2eKg: 0,
  },
  scope3Rows: [],
});

const [hasLoadedOnce, setHasLoadedOnce] = useState(false);


const [userId, setUserId] = useState<string | null>(null);
const [accessToken, setAccessToken] = useState<string | null>(null);
const [isIndia, setIsIndia] = useState<boolean | null>(null); // null = not yet determined
const [waterRows, setWaterRows] = useState<any[]>([]);
const [wasteRows, setWasteRows] = useState<any[]>([]);
const [airRows, setAirRows] = useState<any[]>([]);
type BrsrScorecardData = {
  rows: Array<{ group: string; auto: number; total: number }>;
  overallAuto: number;
  overallTotal: number;
};
type BrsrExtraData = {
  hasGhgPlan: boolean;
  hasRenew: boolean;
  hasRevenue: boolean;
  hasEmpCount: boolean;
  methodConfirmed: boolean;
};
const [brsrExtra, setBrsrExtra] = useState<BrsrExtraData | null>(null);

const brsrScorecard = useMemo<BrsrScorecardData | null>(() => {
  if (!isIndia || !brsrExtra) return null;
  const { hasGhgPlan, hasRenew, hasRevenue, hasEmpCount, methodConfirmed } = brsrExtra;
  const bGhgAuto    = 4 + (hasRevenue ? 1 : 0) + (hasEmpCount ? 1 : 0);
  const bEnergyAuto = 4 + (hasRevenue ? 1 : 0) + (hasEmpCount ? 1 : 0);
  const bWwaAuto    = (waterRows.length > 0 ? 1 : 0) + (wasteRows.length > 0 ? 1 : 0) + (airRows.length > 0 ? 1 : 0);
  const bAddlAuto   = 1 + (methodConfirmed ? 1 : 0) + (hasGhgPlan ? 1 : 0) + (hasRenew ? 1 : 0);
  return {
    rows: [
      { group: 'GHG Emissions (Scope 1, 2, 3)', auto: bGhgAuto,    total: 6 },
      { group: 'Energy Consumption',             auto: bEnergyAuto, total: 6 },
      { group: 'Water, Waste and Air',            auto: bWwaAuto,   total: 3 },
      { group: 'Additional disclosures',          auto: bAddlAuto,  total: 4 },
    ],
    overallAuto: bGhgAuto + bEnergyAuto + bWwaAuto + bAddlAuto,
    overallTotal: 19,
  };
}, [isIndia, brsrExtra, waterRows, wasteRows, airRows]);
const [snapshotLoading, setSnapshotLoading] = useState(false);
const [freeReportUsed, setFreeReportUsed] = useState(false);
// -----------------------------
// RESTORE CACHED REPORT (INSTANT PAINT — runs before browser paint)
// -----------------------------
useIsomorphicLayoutEffect(() => {
  try {
    const cached = sessionStorage.getItem(EMISSIONS_CACHE_KEY);
    if (cached) {
      const parsed: EmissionsReport = JSON.parse(cached);
      if (parsed.months) {
        parsed.months.sort((a, b) => new Date(a.monthLabel).getTime() - new Date(b.monthLabel).getTime());
      }
      setReport(parsed);
    }
  } catch (e) {
    console.warn('Failed to restore emissions cache', e);
  }
}, []);

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
// AUTH USER (CLIENT ONLY)
// getSession() reads from localStorage — no network round-trip, instant
// -----------------------------
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUserId(session?.user?.id ?? null);
    setAccessToken(session?.access_token ?? null);
  });
}, []);

// Restore India cache before paint so isIndia is known on frame 1
useIsomorphicLayoutEffect(() => {
  try {
    const cached = sessionStorage.getItem(INDIA_ENV_CACHE_KEY);
    if (cached) {
      const { isIndia: ci, waterRows: w, wasteRows: ws, airRows: a, brsrExtra: be } = JSON.parse(cached);
      if (ci) {
        setIsIndia(true);
        setWaterRows(w ?? []);
        setWasteRows(ws ?? []);
        setAirRows(a ?? []);
        if (be) setBrsrExtra(be);
      } else {
        setIsIndia(false);
      }
    }
  } catch {}
}, []);

// Load India env data — refresh from DB independently
useEffect(() => {
  let mounted = true;

  // Refresh from DB in background — single parallel round-trip for India users
  async function loadIndia() {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid || !mounted) return;

    // Fire all queries at once — discard India-specific results if not IN
    const [profileRes, waterRes, wasteRes, airRes, brsrRes, profileExtraRes] = await Promise.all([
      supabase.from('profiles').select('country, india_water_enabled, india_waste_enabled, india_air_enabled').eq('id', uid).maybeSingle(),
      supabase.from('water_entries').select('*').eq('account_id', uid).order('period_year', { ascending: true }).order('period_month', { ascending: true }),
      supabase.from('waste_entries').select('*').eq('account_id', uid).order('period_year', { ascending: true }).order('period_month', { ascending: true }),
      supabase.from('air_emissions').select('*').eq('account_id', uid).order('period_year', { ascending: false }),
      supabase.from('brsr_profile').select('has_ghg_reduction_plan,renewable_elec_pct').eq('account_id', uid).maybeSingle(),
      supabase.from('profiles').select('employee_count,annual_revenue,methodology_confirmed').eq('id', uid).maybeSingle(),
    ]);
    if (!mounted) return;

    const profile = profileRes.data;
    if (profile?.country !== 'IN') {
      setIsIndia(false);
      try { sessionStorage.setItem(INDIA_ENV_CACHE_KEY, JSON.stringify({ isIndia: false })); } catch {}
      return;
    }

    setIsIndia(true);
    const water  = { data: profile.india_water_enabled ? (waterRes.data ?? []) : [] };
    const waste  = { data: profile.india_waste_enabled ? (wasteRes.data ?? []) : [] };
    const air    = { data: profile.india_air_enabled   ? (airRes.data   ?? []) : [] };
    if (!mounted) return;

    const w = water.data ?? [];
    const ws = waste.data ?? [];
    const a = air.data ?? [];
    setWaterRows(w);
    setWasteRows(ws);
    setAirRows(a);

    // Store raw BRSR/profile fields — scorecard is derived via useMemo
    const brsrProf = brsrRes.data;
    const profData = profileExtraRes.data;
    const be: BrsrExtraData = {
      hasGhgPlan:      !!brsrProf?.has_ghg_reduction_plan,
      hasRenew:        Number(brsrProf?.renewable_elec_pct ?? 0) > 0,
      hasRevenue:      Number(profData?.annual_revenue ?? 0) > 0,
      hasEmpCount:     Number(profData?.employee_count ?? 0) > 0,
      methodConfirmed: !!profData?.methodology_confirmed,
    };
    setBrsrExtra(be);

    try {
      sessionStorage.setItem(INDIA_ENV_CACHE_KEY, JSON.stringify({ isIndia: true, waterRows: w, wasteRows: ws, airRows: a, brsrExtra: be }));
    } catch {}
  }
  loadIndia();
  return () => { mounted = false; };
}, []);

// Seed plan + free report limit from sessionStorage for instant UI on revisit
useEffect(() => {
  try {
    const cached = sessionStorage.getItem(PLAN_CACHE_KEY) as Plan | null;
    if (cached && ['free', 'growth', 'pro', 'enterprise'].includes(cached)) {
      setPlan(cached);
    }
    if (sessionStorage.getItem(FREE_REPORT_CACHE_KEY) === '1') {
      setFreeReportUsed(true);
    }
  } catch {}
}, []);

// Check free report usage — runs once plan and userId are both known
useEffect(() => {
  if (plan !== 'free' || !userId) return;
  let cancelled = false;
  async function check() {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', userId!)
      .eq('action', 'export_pdf')
      .gte('created_at', yearStart);
    if (cancelled) return;
    if ((count ?? 0) >= 1) {
      setFreeReportUsed(true);
      try { sessionStorage.setItem(FREE_REPORT_CACHE_KEY, '1'); } catch {}
    } else {
      // DB says 0 downloads — clear any stale cache so user can still get their 1 free report
      setFreeReportUsed(false);
      try { sessionStorage.removeItem(FREE_REPORT_CACHE_KEY); } catch {}
    }
  }
  check();
  return () => { cancelled = true; };
}, [plan, userId]);

// -----------------------------
// DATA LOAD (CLIENT ONLY)
// -----------------------------
useEffect(() => {
  let mounted = true;

  async function load() {
    // Kick off both fetches concurrently
    const planPromise = getCurrentPlan();
    const reportPromise = getEmissionsReport(period, customStart, customEnd);

    // Set plan as soon as it resolves — don't wait for the slow report fetch
    const p = await planPromise;
    if (!mounted) return;
    setPlan(p);

    const r = await reportPromise;
    if (!mounted) return;
    setReport(r);
    setHasLoadedOnce(true);
    sessionStorage.setItem(EMISSIONS_CACHE_KEY, JSON.stringify(r));
  }

  load();

  return () => {
    mounted = false;
  };
}, [period, customStart, customEnd]);



  // -----------------------------
  // LOADING GATE
  // -----------------------------
  

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
  const isProPlus  = plan === 'pro' || plan === 'enterprise';

  const hasData = months.length > 0 || (scope3Rows?.length ?? 0) > 0;
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
  const { totalDieselLitres, totalPetrolLitres, totalGasKwh, totalLpgKg, totalCngKg, totalScope1Co2eKg, totalScope2Co2eKg } = totals;

  const {
    electricitySharePercent,
    dieselSharePercent,
    petrolSharePercent,
    gasSharePercent,
    lpgSharePercent,
    cngSharePercent,
    refrigerantSharePercent,
    scope3SharePercent,
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

  // ── CSV export (client-side) ──
  function handleExportCsv() {
    const header = ['Month', 'Electricity_kWh', 'Diesel_L', 'Petrol_L', 'Gas_kWh', 'Refrigerant_kg', 'Total_CO2e_kg'];
    const lines = report.months.map((r) =>
      [
        r.monthLabel,
        String(r.electricityKwh ?? 0),
        String(r.dieselLitres ?? 0),
        String(r.petrolLitres ?? 0),
        String(r.gasKwh ?? 0),
        String(r.refrigerantKg ?? 0),
        (r.totalCo2eKg ?? 0).toFixed(2),
      ].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emissions-export.csv';
    a.click();
    URL.revokeObjectURL(url);
    logActivity('export_csv', 'report', { period: report.periodLabel });
  }

  // ── XLS export (POST pre-fetched data) ──
  async function handleExportXls() {
    const rows = report.months.map((r) => ({
      month: r.monthLabel,
      electricity_kw: r.electricityKwh ?? 0,
      diesel_litres: r.dieselLitres ?? 0,
      petrol_litres: r.petrolLitres ?? 0,
      gas_kwh: r.gasKwh ?? 0,
      refrigerant_kg: r.refrigerantKg ?? 0,
      total_co2e: r.totalCo2eKg ?? 0,
    }));
    const res = await fetch('/api/export/xls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      alert('Failed to generate Excel export. Please try again.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emissions-export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    logActivity('export_xls', 'report', { period: report.periodLabel });
  }

  // ── Leadership Snapshot ──
  async function handleSnapshot() {
    if (!userId || !report) return;
    setSnapshotLoading(true);
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, industry, country, employee_count, annual_revenue')
        .eq('id', userId)
        .maybeSingle();

      // Fetch AI benchmarking (optional)
      const { data: aiBench } = await supabase
        .from('ai_benchmarking')
        .select('benchmarking')
        .eq('user_id', userId)
        .maybeSingle();

      // Compute CO2e per source from months using country-aware factors
      const countryCode = profile?.country ?? 'GB';
      const ef = getFactorsForCountry(countryCode);
      let elecCo2eKg = 0, fuelCo2eKg = 0, refrigCo2eKg = 0;
      for (const m of report.months) {
        elecCo2eKg += (m.electricityKwh ?? 0) * ef.electricity;
        fuelCo2eKg += ((m.dieselLitres ?? 0) * ef.diesel)
                    + ((m.petrolLitres ?? 0) * ef.petrol)
                    + ((m.gasKwh ?? 0) * ef.gas)
                    + ((m.lpgKg ?? 0) * ef.lpgKg)
                    + ((m.cngKg ?? 0) * ef.cngKg);
        refrigCo2eKg += calcRefrigerantCo2e(m.refrigerantKg ?? 0, m.refrigerantCode ?? 'GENERIC_HFC');
      }

      // Build trend months — send raw YYYY-MM, PDF engine formats labels
      const trendMonths = report.months.map(m => ({
        label: m.monthLabel,
        totalKg: m.totalCo2eKg,
      }));

      // Scope 3 by category
      const scope3ByCat: Record<string, number> = {};
      for (const row of (report.scope3Rows ?? [])) {
        const cat = String(row.category ?? 'other');
        scope3ByCat[cat] = (scope3ByCat[cat] ?? 0) + Number(row.co2e_kg ?? 0);
      }

      // AI insights
      const bench = (aiBench?.benchmarking as any);
      const insights: string[] = Array.isArray(bench?.insights) ? bench.insights : [];
      const aiSummary: string = bench?.summary ?? '';

      // ── Performance metrics (mirrors dashboard page logic) ──
      const perfMonths = [...report.months].sort(
        (a, b) => new Date(a.monthLabel).getTime() - new Date(b.monthLabel).getTime()
      );
      const lastCo2 = perfMonths[perfMonths.length - 1]?.totalCo2eKg ?? 0;
      const prevCo2 = perfMonths[perfMonths.length - 2]?.totalCo2eKg ?? 0;
      const hasPrevMo = prevCo2 > 0;
      const moPct = hasPrevMo ? ((lastCo2 - prevCo2) / prevCo2) * 100 : 0;
      const perfStatus: string | null = !hasPrevMo ? null : moPct <= -5 ? 'Falling' : moPct <= 5 ? 'Flat' : 'Rising';
      const perfDesc: string | null = !hasPrevMo ? null
        : moPct <= -5 ? 'On track - emissions falling vs previous month.'
        : moPct <= 5  ? 'Flat - little month-on-month movement.'
        : 'Scope for improvement - emissions rising vs previous month.';
      const totalTonnesSnap = report.totals.totalCo2eKg / 1000;
      const indRaw = (profile?.industry ?? '').toLowerCase().replace(/\s+/g, '_');
      const indKey = indRaw.includes('logistic') || indRaw.includes('transport') ? 'logistics'
        : indRaw.includes('supply') ? 'supply_chain'
        : indRaw.includes('manufact') || indRaw.includes('product') ? 'manufacturing'
        : indRaw.includes('retail') || indRaw.includes('shop') ? 'retail'
        : indRaw.includes('hospit') || indRaw.includes('hotel') || indRaw.includes('restaur') ? 'hospitality'
        : indRaw.includes('tech') || indRaw.includes('software') ? 'technology'
        : indRaw.includes('health') || indRaw.includes('pharma') ? 'healthcare'
        : indRaw.includes('educ') || indRaw.includes('school') ? 'education'
        : indRaw.includes('office') || indRaw.includes('consult') || indRaw.includes('finance') ? 'office'
        : 'other';
      const SME_BL: Record<string, number> = {
        logistics: 3.5, supply_chain: 3.0, manufacturing: 4.0, retail: 2.2,
        hospitality: 2.5, office: 1.6, education: 1.5, healthcare: 2.0, technology: 1.4, other: 1.82,
      };
      const indBaseline = SME_BL[indKey] ?? 1.82;
      const indRatio = totalTonnesSnap / (indBaseline || 1);
      const indScore = indRatio <= 0.8 ? 40 : indRatio <= 1.0 ? 35 : indRatio <= 1.5 ? 25 : indRatio <= 2.0 ? 15 : 5;
      const trScore = perfStatus === 'Falling' ? 30 : perfStatus === 'Flat' ? 20 : perfStatus === 'Rising' ? 10 : 15;
      const refrigPctSnap = report.breakdownBySource.refrigerantSharePercent;
      const riskScoreSnap = 30 - Math.min(30, refrigPctSnap);
      const perfScore = Math.min(100, Math.max(15, indScore + trScore + riskScoreSnap));
      const perfStars = perfScore >= 80 ? 5 : perfScore >= 60 ? 4 : perfScore >= 40 ? 3 : perfScore >= 20 ? 2 : 1;
      const perfRisk = refrigPctSnap >= 60 ? 'High' : refrigPctSnap >= 20 ? 'Medium' : 'Low';
      const perfCompliance = report.months.length > 0 ? 'On track' : 'Not started';

      // POST to snapshot endpoint (no server-side DB calls needed)
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          companyName:   profile?.company_name ?? '',
          industry:      profile?.industry ?? '',
          countryCode,
          periodLabel:   report.periodLabel,
          elecCo2eKg,
          fuelCo2eKg,
          refrigCo2eKg,
          scope3Kg:      report.totals.totalScope3Co2eKg,
          trendMonths,
          employeeCount: profile?.employee_count ?? 0,
          annualRevenue: profile?.annual_revenue ?? 0,
          insights,
          aiSummary,
          scope3ByCat,
          performanceData: {
            score: perfScore,
            stars: perfStars,
            statusLabel: perfStatus,
            statusDescription: perfDesc,
            riskLevel: perfRisk,
            trendStability: perfStatus ?? 'n/a',
            monthlyCompliance: perfCompliance,
          },
        }),
      });
      if (res.status === 403) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? 'Leadership Snapshot requires a Pro plan.');
        return;
      }
      if (!res.ok) throw new Error('Snapshot generation failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const snapshotCompany = (profile?.company_name ?? 'Greenio').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      a.download = `${snapshotCompany}-snapshot.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      logActivity('snapshot', 'report', { period: report.periodLabel });
    } catch (err) {
      console.error('Snapshot error:', err);
    } finally {
      setSnapshotLoading(false);
    }
  }

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
                <form method="GET" action="/api/report" target="_blank"
                  onSubmit={() => {
                    logActivity('export_pdf', 'report', { period: report.periodLabel });
                    // Lock in-session immediately so user can't double-click; DB check persists across refreshes
                    if (isFreePlan) setFreeReportUsed(true);
                  }}>
  <input type="hidden" name="userId" value={userId ?? ''} />
  <input type="hidden" name="token" value={accessToken ?? ''} />

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

  <button
  type="submit"
  disabled={!userId || (isFreePlan && freeReportUsed)}
  className={`h-[32px] px-4 rounded-full border text-xs font-medium ${
    !userId || (isFreePlan && freeReportUsed)
      ? 'bg-slate-50 text-slate-400 border-dashed border-slate-300 cursor-not-allowed'
      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white'
  }`}
>
  {isFreePlan && freeReportUsed ? 'Emission Report (Growth+)' : 'Emission Report'}
</button>

</form>

                {/* Leadership Snapshot — Pro+ only */}
                {isProPlus ? (
                  <button
                    type="button"
                    onClick={handleSnapshot}
                    disabled={!userId || snapshotLoading}
                    className={`h-[32px] px-4 rounded-full border text-xs font-medium flex items-center justify-center ${
                      !userId
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    {snapshotLoading ? 'Generating...' : 'Leadership Snapshot'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="h-[32px] px-4 rounded-full border text-xs font-medium bg-slate-50 text-slate-400 border-dashed border-slate-300 cursor-not-allowed"
                  >
                    Leadership Snapshot (Pro)
                  </button>
                )}

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
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={!hasData}
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportXls}
                      disabled={!hasData}
                      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Export Excel
                    </button>
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
                  Free plan: 1 PDF report/year · CSV &amp; Excel unlock on{' '}
                  <a href="/billing" className="font-medium underline">Growth</a>
                  {' '}· Leadership Snapshot on{' '}
                  <a href="/billing" className="font-medium underline">Pro</a>.
                </p>
              )}
              {!isFreePlan && !isProPlus && (
                <p className="text-[11px] text-slate-500 mt-1 text-right">
                  Leadership Snapshot unlocks on{' '}
                  <a href="/billing" className="font-medium underline">Pro</a>.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* NO DATA */}
        {hasLoadedOnce && !hasData ? (
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
            {/* KPI CARDS — full width */}
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
                    Across {months.length} reported {months.length === 1 ? 'month' : 'months'}.
                  </p>
                  {hasScope3InPeriod && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Includes {formatKg(totalScope3)} Scope 3 in this period.
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
                  {hotspotSharePercent === 0 && hasScope3InPeriod ? (
                    <>
                      <p className="text-lg font-medium mt-3">Scope 3 Activities</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        No Scope 1 &amp; 2 emissions logged yet.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Scope 3 accounts for 100% of emissions this period.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium mt-3">{hotspot}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Electricity: {electricitySharePercent}% · Diesel:{' '}
                        {dieselSharePercent}% · Petrol: {petrolSharePercent}% ·
                        Gas: {gasSharePercent}%{isIndia && lpgSharePercent > 0 ? ` · LPG: ${lpgSharePercent}%` : ''}{isIndia && cngSharePercent > 0 ? ` · CNG: ${cngSharePercent}%` : ''} · Refrigerant:{' '}
                        {refrigerantSharePercent}%
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {hotspotContext} caused {hotspotSharePercent}% of emissions.
                      </p>
                    </>
                  )}
                </div>
              </article>
            </div>

            {/* TREND + SIDEBAR */}
            <section className="grid lg:grid-cols-3 gap-6 items-start">
              {/* LEFT COL: Trend + BRSR Scorecard (India only) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
              {/* TREND */}
              <article className="rounded-xl bg-white border p-6 shadow">
                <h2 className="text-sm font-semibold">
                  Trend by month (CO₂e)
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Shows last 12 months. Tap or hover a dot for exact values.
                </p>
                <div className="mt-4">
                  <MonthlyTrendChart months={months} />
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-3 text-center">Explore by source</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { href: '/dashboard/emissions/electricity', label: 'Electricity', color: '#0EA5E9' },
                      { href: '/dashboard/emissions/fuel',        label: 'Fuel',        color: '#F97316' },
                      { href: '/dashboard/emissions/refrigerant', label: 'Refrigerant', color: '#22C55E' },
                      { href: '/dashboard/emissions/scope3',      label: 'Scope 3',     color: '#A855F7' },
                    ].map(({ href, label, color }) => (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all hover:opacity-80 hover:shadow-sm"
                        style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}40` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </article>

              {/* EMISSIONS BY SCOPE — non-India only (null = unknown, so hide until resolved) */}
              {isIndia === false && (hasData || !hasLoadedOnce) && (
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold text-slate-900 mb-4">Emissions by scope</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {hasData ? (
                      <>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
                          <p className="text-lg font-semibold text-emerald-900">{(totalScope1Co2eKg / 1000).toFixed(2)} tCO₂e</p>
                          <p className="text-[11px] text-emerald-700 mt-1">Scope 1: Direct emissions</p>
                          <p className="text-[10px] text-emerald-600 mt-0.5 opacity-75">Fuel &amp; refrigerant</p>
                        </div>
                        <div className="rounded-lg bg-sky-50 border border-sky-100 p-4">
                          <p className="text-lg font-semibold text-sky-900">{(totalScope2Co2eKg / 1000).toFixed(2)} tCO₂e</p>
                          <p className="text-[11px] text-sky-700 mt-1">Scope 2: Indirect</p>
                          <p className="text-[10px] text-sky-600 mt-0.5 opacity-75">Purchased electricity</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
                          <p className="text-lg font-semibold text-amber-900">{(totalScope3 / 1000).toFixed(2)} tCO₂e</p>
                          <p className="text-[11px] text-amber-700 mt-1">Scope 3: Value chain</p>
                          <p className="text-[10px] text-amber-600 mt-0.5 opacity-75">Supply chain &amp; travel</p>
                        </div>
                      </>
                    ) : (
                      <>
                        {(['bg-emerald-50 border-emerald-100', 'bg-sky-50 border-sky-100', 'bg-amber-50 border-amber-100'] as const).map((cls, i) => (
                          <div key={i} className={`rounded-lg border p-4 animate-pulse ${cls}`}>
                            <div className="h-5 w-24 rounded bg-slate-200" />
                            <div className="h-3 w-32 rounded bg-slate-200 mt-2" />
                            <div className="h-2.5 w-20 rounded bg-slate-200 mt-1.5" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </article>
              )}

              {/* BRSR COMPLETENESS SCORECARD — India only */}
              {isIndia && brsrScorecard && (
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold text-slate-900 mb-4">BRSR Completeness Scorecard</h2>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-2 px-3 text-left font-medium rounded-tl-lg">Indicator group</th>
                        <th className="py-2 px-3 text-center font-medium">Auto-filled</th>
                        <th className="py-2 px-3 text-center font-medium">Needs input</th>
                        <th className="py-2 px-3 text-center font-medium rounded-tr-lg">Completeness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brsrScorecard.rows.map((row, i) => {
                        const pct = Math.round((row.auto / row.total) * 100);
                        const pctColor = pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
                        return (
                          <tr key={row.group} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="py-2 px-3 text-slate-700">{row.group}</td>
                            <td className="py-2 px-3 text-center tabular-nums text-slate-700">{row.auto} / {row.total}</td>
                            <td className="py-2 px-3 text-center tabular-nums text-slate-500">{row.total - row.auto} / {row.total}</td>
                            <td className={`py-2 px-3 text-center font-semibold tabular-nums ${pctColor}`}>{pct}%</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-emerald-50 border-t border-emerald-100">
                        <td className="py-2 px-3 font-semibold text-slate-900">Overall BRSR Essential Indicators</td>
                        <td className="py-2 px-3 text-center font-semibold tabular-nums text-slate-900">{brsrScorecard.overallAuto} / {brsrScorecard.overallTotal}</td>
                        <td className="py-2 px-3 text-center font-semibold tabular-nums text-slate-700">{brsrScorecard.overallTotal - brsrScorecard.overallAuto} / {brsrScorecard.overallTotal}</td>
                        {(() => {
                          const p = Math.round((brsrScorecard.overallAuto / brsrScorecard.overallTotal) * 100);
                          const c = p === 100 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
                          return <td className={`py-2 px-3 text-center font-semibold tabular-nums ${c}`}>{p}%</td>;
                        })()}
                      </tr>
                    </tbody>
                  </table>
                </article>
              )}
              </div>{/* end left col */}

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Breakdown */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">Emissions breakdown</h2>
                  {hotspotSharePercent === 0 && hasScope3InPeriod ? (
                    <p className="mt-4 text-xs text-slate-500">
                      All emissions this period are from Scope 3 activities. Add Scope 1 &amp; 2 data to see a source breakdown.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2 text-xs leading-relaxed">
                      {[
                        { label: 'Electricity', pct: electricitySharePercent, has: totals.totalElecKwh > 0 },
                        { label: 'Diesel',      pct: dieselSharePercent,      has: totals.totalDieselLitres > 0 },
                        { label: 'Petrol',      pct: petrolSharePercent,      has: totals.totalPetrolLitres > 0 },
                        { label: 'Gas',         pct: gasSharePercent,         has: totalGasKwh > 0 },
                        { label: 'LPG',         pct: lpgSharePercent,         has: totalLpgKg > 0 },
                        { label: 'CNG',         pct: cngSharePercent,         has: totalCngKg > 0 },
                        { label: 'Refrigerant', pct: refrigerantSharePercent, has: totals.totalRefKg > 0 },
                        { label: 'Scope 3',     pct: scope3SharePercent,      has: totalScope3 > 0 },
                      ].filter(r => r.has).map(({ label, pct, has }) => (
                        <div key={label} className="flex justify-between items-baseline">
                          <span className="text-slate-600">{label}</span>
                          <span className="text-right tabular-nums min-w-[3ch]">
                            {has && pct === 0 ? '< 0.1%' : `${pct}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                {/* Fuel detail */}
                <article className="rounded-xl bg-white border p-6 shadow">
                  <h2 className="text-sm font-semibold">Fuel detail</h2>
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
                    {isIndia && totalLpgKg > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">LPG</span>
                        <span className="tabular-nums">
                          {totalLpgKg.toLocaleString()} kg
                        </span>
                      </div>
                    )}
                    {isIndia && totalCngKg > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">CNG</span>
                        <span className="tabular-nums">
                          {totalCngKg.toLocaleString()} kg
                        </span>
                      </div>
                    )}
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
                      {isIndia && <th className="p-2 text-left">LPG (kg)</th>}
                      {isIndia && <th className="p-2 text-left">CNG (kg)</th>}
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
                          {isIndia && <td className="p-2">{m.lpgKg ?? 0}</td>}
                          {isIndia && <td className="p-2">{m.cngKg ?? 0}</td>}
                          <td className="p-2">{m.refrigerantKg}</td>
                          <td className="p-2">
                            {formatKgValue(m.totalCo2eKg)}
                          </td>
                          <td className="p-2">
                            {typeof m.id === 'string' && m.id.startsWith('s3-') ? (
                              <span className="text-xs text-slate-400">Scope 3 only</span>
                            ) : (
                              <RowActionsClient
                                id={m.id}
                                monthLabel={m.monthLabel}
                              />
                            )}
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

            <section className="rounded-xl bg-white border p-6 shadow">
              <h2 className="text-sm font-semibold mb-3">
                Scope 3 activity log (optional)
              </h2>

              {(scope3Rows?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">
                  No Scope 3 activities recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 text-left">Month</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-left">Label</th>
                        <th className="p-2 text-left">Activity</th>
                        <th className="p-2 text-left">CO₂e (kg)</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(scope3Rows ?? []).map((row) => {
                        const now = new Date();
                        const currentMonth = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
                        const isCurrentMonth = row.month === currentMonth;
                        return (
                          <tr
                            key={row.id}
                            className={`border-b last:border-0 border-[rgb(240,240,240)] ${isCurrentMonth ? 'bg-slate-50' : ''}`}
                          >
                            <td className="p-2 font-medium text-slate-900">{row.month}</td>
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
                            <td className="p-2">
                              {row.co2e_kg?.toFixed(1)}
                            </td>
                            <td className="p-2">
                              <Scope3ActionsCell row={row} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ============================== */}
            {/* SECTION C — PRINCIPLE 6        */}
            {/* ============================== */}
            {isIndia && (waterRows.length > 0 || wasteRows.length > 0 || airRows.length > 0) && (
              <section className="rounded-xl bg-white border p-6 shadow">
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 font-semibold">BRSR — Section C</p>
                  <h2 className="text-sm font-semibold text-slate-900 mt-0.5">Principle 6: Environmental Responsibility</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Water, Waste and Air data for BRSR reporting. Not included in CO₂e totals above.</p>
                </div>

                {/* WATER */}
                {waterRows.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold text-slate-700 mb-2">Water consumption</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2 text-left">Period</th>
                            <th className="p-2 text-left">Source</th>
                            <th className="p-2 text-left">Withdrawn (kL)</th>
                            <th className="p-2 text-left">Consumed (kL)</th>
                            <th className="p-2 text-left">Discharged (kL)</th>
                            <th className="p-2 text-left">CO₂e (kg)</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {waterRows.map((row, i) => (
                            <tr key={row.id ?? i} className="border-b last:border-0 border-[rgb(240,240,240)]">
                              <td className="p-2 font-medium text-slate-900">{MONTHS_SHORT[(row.period_month ?? 1) - 1]} {row.period_year}</td>
                              <td className="p-2 capitalize text-slate-600">{(row.source_type ?? 0).replace(/_/g, ' ')}</td>
                              <td className="p-2">{row.volume_withdrawn_kl?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.volume_consumed_kl?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.volume_discharged_kl?.toLocaleString() ?? 0}</td>
                              <td className="p-2 font-medium">{row.co2e_kg?.toFixed(1) ?? 0}</td>
                              <td className="p-2"><SectionCActions id={row.id} table="water_entries" label={`${MONTHS_SHORT[(row.period_month ?? 1) - 1]} ${row.period_year}`} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* WASTE */}
                {wasteRows.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold text-slate-700 mb-2">Waste disposal</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2 text-left">Period</th>
                            <th className="p-2 text-left">Total (kg)</th>
                            <th className="p-2 text-left">Landfill (kg)</th>
                            <th className="p-2 text-left">Recycled (kg)</th>
                            <th className="p-2 text-left">Incinerated (kg)</th>
                            <th className="p-2 text-left">Hazardous (kg)</th>
                            <th className="p-2 text-left">CO₂e (kg)</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wasteRows.map((row, i) => (
                            <tr key={row.id ?? i} className="border-b last:border-0 border-[rgb(240,240,240)]">
                              <td className="p-2 font-medium text-slate-900">{MONTHS_SHORT[(row.period_month ?? 1) - 1]} {row.period_year}</td>
                              <td className="p-2">{row.total_kg?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.landfill_kg?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.recycled_kg?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.incinerated_kg?.toLocaleString() ?? 0}</td>
                              <td className="p-2">{row.hazardous_kg?.toLocaleString() ?? 0}</td>
                              <td className="p-2 font-medium">{row.co2e_kg?.toFixed(1) ?? 0}</td>
                              <td className="p-2"><SectionCActions id={row.id} table="waste_entries" label={`${MONTHS_SHORT[(row.period_month ?? 1) - 1]} ${row.period_year}`} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* AIR */}
                {airRows.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 mb-2">Air emissions (annual)</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <colgroup>
                          <col style={{ width: '17%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '18%' }} />
                        </colgroup>
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2 text-left">FY</th>
                            <th className="p-2 text-left">NOx (t)</th>
                            <th className="p-2 text-left">SOx (t)</th>
                            <th className="p-2 text-left">PM (t)</th>
                            <th className="p-2 text-left">Other</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {airRows.map((row, i) => (
                            <tr key={row.id ?? i} className="border-b last:border-0 border-[rgb(240,240,240)]">
                              <td className="p-2 font-medium text-slate-900">FY {row.period_year}–{String(row.period_year + 1).slice(2)}</td>
                              <td className="p-2">{row.nox_tonnes ?? 0}</td>
                              <td className="p-2">{row.sox_tonnes ?? 0}</td>
                              <td className="p-2">{row.pm_tonnes ?? 0}</td>
                              <td className="p-2">{row.other_pollutant_name ? `${row.other_pollutant_name}: ${row.other_pollutant_tonnes ?? 0} t` : '—'}</td>
                              <td className="p-2"><SectionCActions id={row.id} table="air_emissions" label={`FY ${row.period_year}–${String(row.period_year + 1).slice(2)}`} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}