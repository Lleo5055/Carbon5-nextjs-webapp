// app/dashboard/emissions/view-emissions/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';

import Link from 'next/link';

// FIX: use browser supabase client (NOT supabaseServer)
import { supabase } from '../../../../lib/supabaseClient';
import Scope3ActionsCell from './Scope3ActionsCell';

import { calcRefrigerantCo2e } from '../../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { logActivity } from '../../../../lib/logActivity';

import RowActionsClient from './RowActionsClient';
const EMISSIONS_CACHE_KEY = 'view_emissions_report_v1';


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

const PLAN_CACHE_KEY = 'greenio_plan_v1';
const FREE_REPORT_CACHE_KEY = `greenio_free_report_used_${new Date().getFullYear()}`;

/* ---------- FIXED: Safe Supabase ---------- */
async function getCurrentPlan(): Promise<Plan> {
  // If user is an active team member, the owner must be on Growth+ (required
  // to add team members), so inherit at least 'growth'.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('owner_id')
      .eq('member_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membership?.owner_id) {
      // Owner is guaranteed Growth+; try to read their exact plan, fall back to 'growth'
      const { data: ownerProfile } = await supabase
        .from('user_plans')
        .select('plan')
        .eq('user_id', membership.owner_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const plan = (ownerProfile?.plan as Plan | null) ?? 'growth';
      try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
      return plan;
    }
  }

  const { data, error } = await supabase
    .from('user_plans')
    .select('plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error('View-emissions: error loading user plan', error);

  const plan = (data?.plan as Plan | null) ?? 'free';
  try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
  return plan;
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

  // Get country-aware factors from the first row's country_code
  const countryCode = data[0]?.country_code ?? 'GB';
  const ef = getFactorsForCountry(countryCode);

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
      totalCo2eKg:
        electricityKwh * ef.electricity +
        dieselLitres * ef.diesel +
        petrolLitres * ef.petrol +
        gasKwh * ef.gas +
        calcRefrigerantCo2e(refrigerantKg, refrigerantCode),
      dieselLitres,
      petrolLitres,
      gasKwh,
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
  
  const [plan, setPlan] = useState<Plan>('free');
  const [report, setReport] = useState<EmissionsReport>({
  periodLabel: '',
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
  scope3Rows: [],
});

const [hasLoadedOnce, setHasLoadedOnce] = useState(false);


const [userId, setUserId] = useState<string | null>(null);
const [snapshotLoading, setSnapshotLoading] = useState(false);
const [freeReportUsed, setFreeReportUsed] = useState(false);
// -----------------------------
// RESTORE CACHED REPORT (INSTANT PAINT)
// -----------------------------
useEffect(() => {
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
  });
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

  const hasData = months.length > 0 || scope3Rows.length > 0;
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
                    + ((m.gasKwh ?? 0) * ef.gas);
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
      a.download = 'leadership-snapshot.pdf';
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
                        Across {months.length} reported {months.length === 1 ? 'month' : 'months'}.
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
                            Gas: {gasSharePercent}% · Refrigerant:{' '}
                            {refrigerantSharePercent}%
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {hotspotContext} caused {hotspotSharePercent}% of
                            emissions.
                          </p>
                        </>
                      )}
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
                  {hotspotSharePercent === 0 && hasScope3InPeriod ? (
                    <p className="mt-4 text-xs text-slate-500">
                      All emissions this period are from Scope 3 activities. Add Scope 1 &amp; 2 data to see a source breakdown.
                    </p>
                  ) : (
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
          </>
        )}
      </div>
    </main>
  );
}