// app/dashboard/page.tsx

'use client';

import HotspotPieChart from './HotspotPieChart';
import React from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';





import { normaliseSharesTo100 } from '@/lib/normalisePercentages';

import OnboardingCard from './OnboardingCard';

import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  calcFuelCo2eKg,
  calcRefrigerantCo2e,
} from '../../lib/emissionFactors';
// Safe absolute base URL for server-side fetch (Vercel SSR fix)
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';




console.log(
  '[DASHBOARD MODULE LOADED]',
  new Date().toISOString()
);

type DashboardMonth = {
  monthLabel: string;
  electricityKwh: number;
  fuelLitres: number;
  refrigerantKg: number;
  totalCo2eKg: number;
  // New UK fields (internal only)
  dieselLitres?: number;
  petrolLitres?: number;
  gasKwh?: number;
  refrigerantCode?: string | null;
  // Scope-aware fields
  scope1and2Co2eKg?: number;
  scope3Co2eKg?: number;
};

type DashboardData = {
  months: DashboardMonth[]; // latest first, already period-filtered
  totalCo2eKg: number; // now Scope 1+2+3
  lastMonth: DashboardMonth | null;
  prevMonth: DashboardMonth | null;
  breakdownBySource: {
    electricitySharePercent: number;
    fuelSharePercent: number;
    refrigerantSharePercent: number;
  };
  hotspot: 'Electricity' | 'Fuel' | 'Refrigerant' | null;
  scopeBreakdown: {
    scope1and2Co2eKg: number;
    scope3Co2eKg: number;
  };
};


type PeriodKey = '3m' | '6m' | '12m' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All data',
};
// UK SME annual baseline emissions (tonnes CO₂e / year)
// Conservative, public-sector aligned estimates
const UK_SME_BASELINES: Record<string, number> = {
  logistics: 3.5,
  supply_chain: 3.0,
  manufacturing: 4.0,
  retail: 2.2,
  hospitality: 2.5,
  office: 1.6,
  education: 1.5,
  healthcare: 2.0,
  technology: 1.4,
  other: 1.82, // fallback
};

function formatKg(v: number) {
  return `${v.toLocaleString()} kg CO₂e`;
}

function formatTonnes(v: number) {
  return `${(v / 1000).toFixed(2)} t CO₂e`;
}

// Shared label style for small section headings
const SECTION_LABEL = 'text-[10px] uppercase tracking-[0.16em] text-slate-500';

async function getDashboardData(
  supabase: typeof import('../../lib/supabaseClient').supabase,

  period: PeriodKey,
  userId: string | undefined
): Promise<DashboardData> {

  // ✅ ADD THIS BLOCK — EXACTLY HERE
  if (!userId) {
    return {
      months: [],
      totalCo2eKg: 0,
      lastMonth: null,
      prevMonth: null,
      breakdownBySource: {
        electricitySharePercent: 0,
        fuelSharePercent: 0,
        refrigerantSharePercent: 0,
      },
      hotspot: null,
      scopeBreakdown: {
        scope1and2Co2eKg: 0,
        scope3Co2eKg: 0,
      },
    };
  }

  console.log(
    '[DASHBOARD RUN]',
    new Date().toISOString(),
    'period=',
    period
  );

console.log(
  '[DASHBOARD RENDER]',
  new Date().toISOString()
);


  // 1. Load emissions
  const { data: emissionsData, error: emissionsError } = await supabase
    .from('emissions')
.select('*')

    .order('month', { ascending: true });

  // 1B. Load latest AI insight
  const { data: latestInsight } = await supabase
    .from('ai_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Load Scope 3
  const { data: scope3Data, error: scope3Error } = await supabase
    .from('scope3_activities')
.select('*')



  if (emissionsError) {
    console.error('Error loading emissions for dashboard', emissionsError);
  }

  if (scope3Error) {
    console.error('Error loading scope 3 for dashboard', scope3Error);
  }

  const hasEmissions = emissionsData && emissionsData.length > 0;
  const hasScope3 = scope3Data && scope3Data.length > 0;

  if (!hasEmissions && !hasScope3) {
    return {
      months: [],
      totalCo2eKg: 0,
      lastMonth: null,
      prevMonth: null,
      breakdownBySource: {
        electricitySharePercent: 0,
        fuelSharePercent: 0,
        refrigerantSharePercent: 0,
      },
      hotspot: null,
      scopeBreakdown: {
        scope1and2Co2eKg: 0,
        scope3Co2eKg: 0,
      },
    };
  }

  const monthMap = new Map<string, DashboardMonth>();

  // ---- Scope 1+2 from emissions table ----
  if (emissionsData) {
    emissionsData.forEach((row: any) => {
      const electricityKwh = Number(row.electricity_kw ?? 0);

      // UK fuel split
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

      const monthLabel = row.month ?? 'Unknown month';
      const baseTotalCo2e = Number(row.total_co2e ?? 0); // Scope 1+2 only

      monthMap.set(monthLabel, {
        monthLabel,
        electricityKwh,
        fuelLitres,
        refrigerantKg,
        totalCo2eKg: baseTotalCo2e, // will add Scope 3 on top later
        dieselLitres,
        petrolLitres,
        gasKwh,
        refrigerantCode,
        scope1and2Co2eKg: baseTotalCo2e,
        scope3Co2eKg: 0,
      });
    });
  }

  // ---- Scope 3 from scope3_activities table ----
  if (scope3Data) {
    scope3Data.forEach((row: any) => {
      const monthLabel = row.month ?? 'Unknown month';
      const amount = Number(row.co2e_kg ?? 0);
      if (!amount) return;

      let entry = monthMap.get(monthLabel);
      if (!entry) {
        entry = {
          monthLabel,
          electricityKwh: 0,
          fuelLitres: 0,
          refrigerantKg: 0,
          totalCo2eKg: 0,
          dieselLitres: 0,
          petrolLitres: 0,
          gasKwh: 0,
          refrigerantCode: 'GENERIC_HFC',
          scope1and2Co2eKg: 0,
          scope3Co2eKg: 0,
        };
        monthMap.set(monthLabel, entry);
      }

      entry.scope3Co2eKg = (entry.scope3Co2eKg ?? 0) + amount;
      entry.totalCo2eKg += amount;
    });
  }

  // Convert map → array
  let months: DashboardMonth[] = Array.from(monthMap.values());

  // Sort by actual date ascending (oldest first)
  months = months.sort((a, b) => {
    const da = new Date(a.monthLabel);
    const db = new Date(b.monthLabel);
    return da.getTime() - db.getTime();
  });

  // Latest first
  const latestFirst = months.slice().reverse();

  // Apply period limit (3 / 6 / 12 / all months from the most recent)
  const limit =
    period === '3m'
      ? 3
      : period === '6m'
      ? 6
      : period === '12m'
      ? 12
      : latestFirst.length;

  const periodMonths = latestFirst.slice(0, limit);

  const scope1and2TotalCo2eKg = periodMonths.reduce(
    (sum, m) => sum + (m.scope1and2Co2eKg ?? 0),
    0
  );
  const scope3TotalCo2eKg = periodMonths.reduce(
    (sum, m) => sum + (m.scope3Co2eKg ?? 0),
    0
  );
  const totalCo2eKg = scope1and2TotalCo2eKg + scope3TotalCo2eKg;

  const lastMonth = periodMonths.length > 0 ? periodMonths[0] : null;
  const prevMonth = periodMonths.length > 1 ? periodMonths[1] : null;

  // UK-aligned breakdown using helpers (Scopes 1+2 only)
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

  const rawShares = {
  electricity: (totalElec / denom) * 100,
  fuel: (totalFuel / denom) * 100,
  refrigerant: (totalRef / denom) * 100,
};

const normalised = normaliseSharesTo100(rawShares);

const breakdownBySource = {
  electricitySharePercent: normalised.electricity,
  fuelSharePercent: normalised.fuel,
  refrigerantSharePercent: normalised.refrigerant,
};


  let hotspot: DashboardData['hotspot'] = null;
  const { electricitySharePercent, fuelSharePercent, refrigerantSharePercent } =
    breakdownBySource;

  if (
    refrigerantSharePercent >= fuelSharePercent &&
    refrigerantSharePercent >= electricitySharePercent &&
    (refrigerantSharePercent > 0 ||
      fuelSharePercent > 0 ||
      electricitySharePercent > 0)
  ) {
    hotspot = 'Refrigerant';
  } else if (
    fuelSharePercent >= electricitySharePercent &&
    fuelSharePercent > 0
  ) {
    hotspot = 'Fuel';
  } else if (electricitySharePercent > 0) {
    hotspot = 'Electricity';
  }

  return {
    months: periodMonths,
    totalCo2eKg,
    lastMonth: lastMonth || null,
    prevMonth: prevMonth || null,
    breakdownBySource: {
      electricitySharePercent,
      fuelSharePercent,
      refrigerantSharePercent,
    },
    hotspot,
    scopeBreakdown: {
      scope1and2Co2eKg: totalCo2eKg - scope3TotalCo2eKg,
      scope3Co2eKg: scope3TotalCo2eKg,
    },
  };
}

/** Simple actions panel: Add emission + View emissions. */
function AddEmissionsPanel() {
  const primaryButton =
    'inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition bg-slate-900 text-white border-slate-900 hover:bg-slate-800';
  const secondaryButton =
    'inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white';

  return (
    <section className="rounded-xl bg-white border p-6 shadow">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
          Emissions
        </p>
        <h2 className="text-sm font-semibold text-slate-900 mt-1">
          Quick actions
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Add a new emission entry or review your existing records.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Link href="/dashboard/emissions" className={primaryButton}>
          + Add emission
        </Link>

        <Link
          href="/dashboard/emissions/view-emissions"
          className={secondaryButton}
        >
          View emissions
        </Link>
      </div>
    </section>
  );
}

/** Tiny sparkline using inline SVG, driven by real values. */
function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) {
    return (
      <div className="h-10 flex items-center text-[11px] text-slate-400">
        Not enough data
      </div>
    );
  }

  const width = 120;
  const height = 40;
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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NumericFieldKey =
  | 'electricityKwh'
  | 'fuelLitres'
  | 'refrigerantKg'
  | 'totalCo2eKg';

function getFieldChangeForIndex(
  months: DashboardMonth[],
  index: number,
  field: NumericFieldKey
): number | null {
  if (index === months.length - 1) return null; // no older month
  const current = months[index][field];
  const prev = months[index + 1][field];
  if (!prev || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

// Value + trend arrow, with locale formatting
function renderValueWithTrend(
  value: number,
  change: number | null,
  decimals: number = 0
): JSX.Element {
  const display =
    decimals > 0
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : value.toLocaleString();

  if (change === null) {
    return <span>{display}</span>;
  }

  const isUp = change > 0.5;
  const isDown = change < -0.5;
  let arrow = '→';
  let color = 'text-slate-400';

  if (isUp) {
    arrow = '▲';
    color = 'text-rose-500';
  } else if (isDown) {
    arrow = '▼';
    color = 'text-emerald-600';
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{display}</span>
      <span className={`text-[10px] ${color}`}>{arrow}</span>
    </span>
  );
}
function normaliseIndustry(raw?: string | null): string {
  if (!raw) return 'other';

  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_'); // "supply chain" → "supply_chain"
}

export default function DashboardPage() {

  // 🔒 Hydration + cache guard
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);



  // Restore cached dashboard immediately (no white flash)
  React.useEffect(() => {
    if (!mounted) return;

    const cached = sessionStorage.getItem('dashboard_state');
    if (cached && !state) {
      setState(JSON.parse(cached));
    }
  }, [mounted]);

  // STEP 6.2 — READ PERIOD (CLIENT-SAFE)
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );

  const rawPeriod = searchParams.get('period') ?? 'all';

  const period: PeriodKey =
  rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === '12m'
    ? (rawPeriod as PeriodKey)
    : 'all';

// STEP 6.3 — LOAD DATA (CLIENT, SAME AS EMISSIONS HISTORY)
const [state, setState] = React.useState<{
  dashData: DashboardData;
  profile: any;
  finalActions: { title: string; description: string }[];
} | null>(null);




React.useEffect(() => {
  let cancelled = false;

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || cancelled) return;

    // 1️⃣ Load dashboard data first (fast path)
    const dashData = await getDashboardData(
      supabase,
      period,
      user.id
    );

    if (!cancelled) {
      setState({
        dashData,
        profile: null,
        finalActions: [],
      });
    }
if (!cancelled) {
  sessionStorage.setItem(
    'dashboard_state',
    JSON.stringify({
      dashData,
      profile: null,
      finalActions: [],
    })
  );
}

    // 2️⃣ Load profile (non-blocking)
supabase
  .from('profiles')
  .select('onboarding_complete, industry, company_name')
  .eq('id', user.id) // ✅ IMPORTANT: load the logged-in user's profile
  .single()
  .then(({ data, error }) => {
    if (error) {
      console.error('Failed to load profile:', error);
      return;
    }

    if (!cancelled && data) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              profile: data,
            }
          : prev
      );
    }
  });


    // 3️⃣ Load AI actions (non-blocking)
    fetch('/api/ai/recommended-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        electricity: dashData.breakdownBySource.electricitySharePercent,
        fuel: dashData.breakdownBySource.fuelSharePercent,
        refrigerant: dashData.breakdownBySource.refrigerantSharePercent,
        months: dashData.months.length,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.actions) {
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  finalActions: json.actions,
                }
              : prev
          );
        }
      })
      .catch(() => {});
  }

  load();

  return () => {
    cancelled = true;
  };
}, [period]);

// STEP 6.4 — HARD STOP
if (!mounted || !state) {
  return null;
}



const { dashData, profile, finalActions } = state;


  // 👇 everything else continues BELOW (state, useEffect, render, etc.)




 
  // --- FETCH AUTH USER ---
  



  // Load AI benchmarking
  

  // Load onboarding status
  

  // Dummy refresh (Dashboard is a server component so no useRouter here)
  const refresh = () => {};

  // --------------------------------------
  // NORMALISED VARIABLES FROM dashData
  // --------------------------------------
  const hasData = dashData.months.length > 0;

  const months = dashData.months;
  const lastMonth = dashData.lastMonth;
  const prevMonth = dashData.prevMonth;
  const breakdownBySource = dashData.breakdownBySource;
  // Make these available to the entire page
  const {
    electricitySharePercent = 0,
    fuelSharePercent = 0,
    refrigerantSharePercent = 0,
  } = breakdownBySource || {};
  

  // --- FALLBACK WHEN AI RETURNS NOTHING ---
  

  const hotspot = dashData.hotspot;
  const scopeBreakdown = dashData.scopeBreakdown;
const industryLabel =
  profile?.industry
    ? profile.industry
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())

    : 'UK SME';

  // --------------------------------------
  // PERIOD LABEL
  // --------------------------------------
  const periodLabel = PERIOD_LABELS[period];

  // --------------------------------------
  // LAST MONTH + PREVIOUS MONTH NUMBERS
  // --------------------------------------
  const lastMonthLabel = lastMonth?.monthLabel ?? '--';
  const lastMonthCo2eKg = lastMonth?.totalCo2eKg ?? 0;
  const prevMonthCo2eKg = prevMonth?.totalCo2eKg ?? 0;

  // --------------------------------------
  // Month-over-month change
  // --------------------------------------
  const hasPrevMonth = prevMonthCo2eKg > 0;

  const monthChangePercent = hasPrevMonth
    ? ((lastMonthCo2eKg - prevMonthCo2eKg) / prevMonthCo2eKg) * 100
    : 0;

  // --------------------------------------
  // Status description
  // --------------------------------------
  const statusDescription = !hasPrevMonth
    ? null
    : monthChangePercent <= -5
    ? 'On track - emissions falling vs previous month.'
    : monthChangePercent <= 5
    ? 'Flat - little month-on-month movement.'
    : 'Scope for improvement - emissions rising vs previous month.';

  // --------------------------------------
  // Status pill label
  // --------------------------------------
  const statusPillLabel = !hasPrevMonth
    ? null
    : monthChangePercent <= -5
    ? 'Falling'
    : monthChangePercent <= 5
    ? 'Flat'
    : 'Rising';

  // --------------------------------------
  // Reporting completeness (always 100% for now)
  // --------------------------------------
  // --------------------------------------
  // PERFORMANCE SCORE (NEW FULL LOGIC)
  // --------------------------------------

  // REQUIREMENTS:
  // - dashData.totalCo2eKg (you kg)
  // - ai?.industry_average_tonnes (industry t)
  // - months (for trend)
  // - refrigerantSharePercent (for risk)
  const trendLabel =
    monthChangePercent <= -5
      ? 'Falling'
      : monthChangePercent <= 5
      ? 'Flat'
      : 'Rising';

  // --------------------------------------
  // PERFORMANCE SCORE (FINAL LOGIC)
  // --------------------------------------

  let performanceScore100 = 0;
  let performanceStars = 1;

  try {
    // 1️⃣ INDUSTRY SCORE (0–40)
    const industryKey = normaliseIndustry(profile?.industry);
const industryTonnes =
  UK_SME_BASELINES[industryKey] ?? UK_SME_BASELINES.other;

const youTonnes = dashData.totalCo2eKg / 1000;

    let industryScore = 0;
    const ratio = youTonnes / industryTonnes;

    if (ratio <= 0.8) industryScore = 40;
    else if (ratio <= 1.0) industryScore = 35;
    else if (ratio <= 1.5) industryScore = 25;
    else if (ratio <= 2.0) industryScore = 15;
    else industryScore = 5;

    // 2️⃣ TREND SCORE (0–30)
    let trendScore = 15; // neutral baseline
    if (trendLabel === 'Falling') trendScore = 30;
    else if (trendLabel === 'Flat') trendScore = 20;
    else if (trendLabel === 'Rising') trendScore = 10;

    // 3️⃣ RISK SCORE (0–30)
    const riskPenalty = Math.min(30, refrigerantSharePercent);
    const riskScore = 30 - riskPenalty;

    // 4️⃣ TOTAL SCORE (CLAMPED 15–100)
    performanceScore100 = industryScore + trendScore + riskScore;

    if (performanceScore100 < 15) performanceScore100 = 15;
    if (performanceScore100 > 100) performanceScore100 = 100;

    // 5️⃣ STAR RATING (1–5) — fixed buckets
    if (performanceScore100 >= 80) performanceStars = 5;
    else if (performanceScore100 >= 60) performanceStars = 4;
    else if (performanceScore100 >= 40) performanceStars = 3;
    else if (performanceScore100 >= 20) performanceStars = 2;
    else performanceStars = 1;
  } catch (err) {
    console.error('Performance score calculation failed:', err);
    performanceScore100 = 20;
    performanceStars = 1;
  }


  const recommendations: { title: string; description: string }[] = [];

  if (hasData) {
    if (months.length < 6 && period === 'all') {
      recommendations.push({
        title: 'Strengthen your baseline',
        description:
          'You have fewer than 6 months of data. Add older bills so your baseline is more robust before you set formal targets.',
      });
    }

    if (hotspot === 'Electricity') {
      recommendations.push({
        title: 'Launch a quick electricity pilot',
        description:
          'Pick one site and trial 2–3 changes (AC setpoints, lighting timers, switching off idle loads). Track the impact over the next few months.',
      });
    } else if (hotspot === 'Fuel') {
      recommendations.push({
        title: 'Run a driver & routing optimisation test',
        description:
          'Choose a small group of vehicles, optimise routes and reduce idling, then compare fuel-related CO₂e month-on-month.',
      });
    } else if (hotspot === 'Refrigerant') {
      recommendations.push({
        title: 'Prioritise leak checks on critical units',
        description:
          'Identify AC or cold-room units with top-ups and schedule a focused leak inspection. Log any refrigerant use so leaks stay visible.',
      });
    }

    recommendations.push({
      title: 'Create a monthly update ritual',
      description:
        'Pick one fixed day each month to update this dashboard so leadership always sees an up-to-date footprint.',
    });

    recommendations.push({
      title: 'Share a simple baseline report',
      description:
        'Use the emissions report view to walk finance and leadership through your current hotspots and agree on one or two priorities.',
    });
  }

  const hotspotLabel =
    hotspot === 'Electricity'
      ? '⚡ Electricity'
      : hotspot === 'Fuel'
      ? '🚚 Fuel'
      : hotspot === 'Refrigerant'
      ? '❄ Refrigerant'
      : 'Not enough data yet';

  const hotspotTextClass =
    hotspot === 'Electricity'
      ? 'text-amber-600'
      : hotspot === 'Fuel'
      ? 'text-emerald-700'
      : hotspot === 'Refrigerant'
      ? 'text-sky-700'
      : 'text-slate-900';

  // Reporting completeness (for header + performance breakdown)
  const reportingCompleteness = hasData ? 100 : 0;

  // Analytics for Trend & risk – use last up to 6 months in this period
  const lastSixMonths = hasData ? months.slice(0, 6) : [];
  const sparkValues = lastSixMonths
    .slice()
    .reverse()
    .map((m) => m.totalCo2eKg);

  let yoyChange: number | null = null;
  if (months.length >= 13) {
    const current = months[0].totalCo2eKg;
    const lastYear = months[12].totalCo2eKg;
    if (lastYear > 0) {
      yoyChange = ((current - lastYear) / lastYear) * 100;
    }
  }

  const refrigerantShare = refrigerantSharePercent || 0;
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  let riskClasses = 'bg-emerald-50 border border-emerald-100 text-emerald-700';

  if (refrigerantShare >= 60) {
    riskLevel = 'High';
    riskClasses = 'bg-rose-50 border border-rose-100 text-rose-700';
  } else if (refrigerantShare >= 20) {
    riskLevel = 'Medium';
    riskClasses = 'bg-amber-50 border border-amber-100 text-amber-700';
  }

  // Prepare rows for the activity table, keeping original index
  const tableRows = months.map((m, index) => ({ ...m, index })).slice(0, 3);

  const periodPills: { key: PeriodKey; label: string }[] = [
    { key: '3m', label: 'Last 3 months' },
    { key: '6m', label: 'Last 6 months' },
    { key: '12m', label: 'Last 12 months' },
    { key: 'all', label: 'All data' },
  ];

  // Helper text for recent activity scope
  const recentScopeText =
    period === 'all'
      ? 'Showing your full history in this view.'
      : period === '3m'
      ? 'Showing up to the last 3 months in this view.'
      : period === '6m'
      ? 'Showing up to the last 6 months in this view.'
      : 'Showing up to the last 12 months in this view.';

  // ---- AUTOMATIONS CONFIG (UI only for now) ----
  type AutomationCard = {
    title: string;
    description: string;
    cadence: string;
    tag: string;
  };

  const automationCards: AutomationCard[] = [];

  if (hasData) {
    // Core monthly logging reminder
    automationCards.push({
      title: 'Monthly logging reminder',
      description:
        'Nudge the data owner on a fixed day each month to upload bills, mileage and refrigerant top-ups so this dashboard stays current.',
      cadence: 'Once per month',
      tag: 'Suggested',
    });

    // Leadership snapshot
    automationCards.push({
      title: 'Leadership snapshot email',
      description:
        'Automatically send a one-page summary of total CO₂e, trend and hotspot to your leadership team at the end of each month.',
      cadence: 'End of month',
      tag: 'Suggested',
    });

    // Refrigerant-specific automation if risk is not low
    if (riskLevel !== 'Low') {
      automationCards.push({
        title: 'Refrigerant leak watch',
        description:
          'Create an alert whenever refrigerant makes up an unusually high share of your footprint so ops can investigate leaks quickly.',
        cadence: 'On change in refrigerant data',
        tag: 'High impact',
      });
    } else {
      automationCards.push({
        title: 'Quarterly target review',
        description:
          'Every quarter, prompt you to compare actual emissions vs your internal targets and adjust actions for the next period.',
        cadence: 'Every 3 months',
        tag: 'Planning',
      });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* ONBOARDING CARD */}
        {profile && !profile.onboarding_complete && (
          <section className="rounded-xl bg-pink-50 border border-amber-200 px-4 py-4 shadow">
            <p className="text-xs font-semibold text-black-800">
              Complete your setup
            </p>
            <p className="text-[11px] text-black-700 mt-1">
              Finish setting up your company profile to unlock personalisation.
            </p>

            <a
              href="/onboarding"
              className="mt-3 inline-flex items-center px-4 py-2 rounded-full text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
            >
              Continue onboarding →
            </a>
          </section>
        )}

        {/* HEADER - aligned with emissions headers */}
        <section className="relative rounded-xl border border-slate-200 shadow bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50 px-4 py-5 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* PROFILE ICON (top-right) */}
         <div className="absolute top-4 right-4 z-50"> 
  <details className="relative">
    <summary className="list-none cursor-pointer flex items-center justify-center 
        w-9 h-9 rounded-full bg-white shadow-sm border border-slate-200 
        text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition">

      {/* NEW SETTINGS ICON */}
      <svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 24 24" 
  fill="currentColor" 
  className="w-6 h-6 text-slate-700"
>
  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm-7 9c0-3.866 3.582-7 8-7 .778 0 1.528.099 2.236.282a6.46 6.46 0 00-.236 1.718c0 .586.078 1.152.223 1.691A9.987 9.987 0 0112 22H5zm16.707-5.293l-1.414-1.414-1.293.647a4.018 4.018 0 00-.707-.408l-.193-1.445h-2l-.193 1.445c-.246.111-.479.249-.707.408l-1.293-.647-1.414 1.414.647 1.293c-.159.228-.297.461-.408.707l-1.445.193v2l1.445.193c.111.246.249.479.408.707l-.647 1.293 1.414 1.414 1.293-.647c.228.159.461.297.707.408l.193 1.445h2l.193-1.445c.246-.111.479-.249.707-.408l1.293.647 1.414-1.414-.647-1.293c.159-.228.297-.461.408-.707l1.445-.193v-2l-1.445-.193a4.06 4.06 0 00-.408-.707l.647-1.293zM18 19a1 1 0 110-2 1 1 0 010 2z"/>
</svg>



    </summary>

    <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 
        rounded-lg shadow-lg py-1 text-sm">

      <Link href="/profile" className="block px-4 py-2 hover:bg-slate-100">
        Profile
      </Link>

      <Link href="/billing" className="block px-4 py-2 hover:bg-slate-100">
        Billing
      </Link>

      <Link href="/logout" className="block px-4 py-2 text-rose-600 hover:bg-slate-100">
        Logout
      </Link>

    </div>
  </details>
</div>




          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Dashboard
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1">
              Welcome back.
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Overview of your carbon footprint and hotspots.
            </p>

            {/* Period filter pills */}
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/70 border border-slate-200 p-1 text-[11px]">
              {periodPills.map((p) => {
                const active = p.key === period;
                const href =
                  p.key === 'all' ? '/dashboard' : `/dashboard?period=${p.key}`;
                return (
                  <Link
                    key={p.key}
                    href={href}
                    className={
                      'px-3 py-1 rounded-full transition transform hover:shadow-sm hover:-translate-y-px ' +
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
          </div>

          
        </section>

        {/* MAIN LAYOUT: LEFT SIDEBAR + RIGHT CONTENT */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT: SIDEBAR – Emissions, Main hotspot, Summary */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
            {/* Emissions / quick actions at the top */}
            <AddEmissionsPanel />

            {hasData && (
              <>
                {/* Main hotspot card – moved into sidebar */}
                <section className="rounded-xl bg-white border p-6 shadow flex flex-col gap-3">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Main hotspot
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold ${hotspotTextClass}`}
                      >
                        {hotspotLabel}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Click a slice for detail
                    </span>
                  </header>

                  <div className="mt-1">
                    <HotspotPieChart breakdown={breakdownBySource} />
                  </div>
                </section>
{/* Right side: tiny KPI + progress bar */}
          <div className="w-full md:w-64 lg:w-72 rounded-xl bg-white/80 border border-slate-200 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Last update
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {hasData ? lastMonthLabel : 'No data yet'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Reporting completeness
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {reportingCompleteness}%
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-900 transition-[width]"
                  style={{ width: `${reportingCompleteness}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {hasData
                  ? 'You have a usable baseline. Keep logging monthly to stay at 100%.'
                  : 'Log your first few months of data to start building a baseline.'}
              </p>
            </div>
          </div>
                {/* Summary – now purely numbers / narrative */}
                <section className="rounded-xl bg-white border p-6 shadow flex flex-col gap-4">
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Summary
                      </h2>

                      <p className="mt-0.5 text-xs text-slate-500">
                        You&apos;re viewing{' '}
                        <span className="font-medium text-slate-900">
                          {months.length}
                        </span>{' '}
                        month{months.length === 1 ? '' : 's'} of data.
                      </p>
                    </div>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                      • Live
                    </span>
                  </header>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Movement this period
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Latest month is{' '}
                        {prevMonth
                          ? `${
                              monthChangePercent >= 0 ? '+' : ''
                            }${monthChangePercent.toFixed(1)}% vs previous`
                          : 'the first month in this view'}
                        .
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Total in view
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        <span className="text-[11px] font-medium tabular-nums text-slate-900">
                          {formatTonnes(dashData.totalCo2eKg)}
                        </span>{' '}
                        across this period.
                      </p>
                      {scopeBreakdown.scope3Co2eKg > 0 && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Including {formatTonnes(scopeBreakdown.scope3Co2eKg)}{' '}
                          from Scope 3 activities.
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                    Keep logging monthly to unlock deeper trend and risk views.
                  </p>
                </section>
              </>
            )}
          </aside>

          {/* RIGHT: MAIN CONTENT */}
          <div className="flex-1 space-y-6 w-full">
            {hasData ? (
              <>
                {/* RECENT ACTIVITY TABLE (ONLY 3 ROWS, WITH TRENDS) */}
                <section className="rounded-xl bg-white border p-6 shadow">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Recent activity (by month)
                    </h2>
                    <Link
                      href="/dashboard/emissions/view-emissions"
                      className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                    >
                      View full history →
                    </Link>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {recentScopeText}
                  </p>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2 text-left font-medium text-slate-500">
                            Month
                          </th>
                          <th className="p-2 text-right font-medium text-slate-500">
                            Electricity (kWh)
                          </th>
                          <th className="p-2 text-right font-medium text-slate-500">
                            Fuel (litres)
                          </th>
                          <th className="p-2 text-right font-medium text-slate-500">
                            Refrigerant (kg)
                          </th>
                          <th className="p-2 text-right font-medium text-slate-500">
                            Total CO₂e (kg)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => {
                          const elecChange = getFieldChangeForIndex(
                            months,
                            row.index,
                            'electricityKwh'
                          );
                          const fuelChange = getFieldChangeForIndex(
                            months,
                            row.index,
                            'fuelLitres'
                          );
                          const refChange = getFieldChangeForIndex(
                            months,
                            row.index,
                            'refrigerantKg'
                          );
                          const totalChange = getFieldChangeForIndex(
                            months,
                            row.index,
                            'totalCo2eKg'
                          );

                          return (
                            <tr
                              key={row.index}
                              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition"
                            >
                              <td className="p-2">
                                <span className="text-[12px] font-medium text-slate-900">
                                  {row.monthLabel}
                                </span>
                              </td>
                              <td className="p-2 text-right">
                                {renderValueWithTrend(
                                  row.electricityKwh,
                                  elecChange,
                                  0
                                )}
                              </td>
                              <td className="p-2 text-right">
                                {renderValueWithTrend(
                                  row.fuelLitres,
                                  fuelChange,
                                  0
                                )}
                              </td>
                              <td className="p-2 text-right">
                                {renderValueWithTrend(
                                  row.refrigerantKg,
                                  refChange,
                                  0
                                )}
                              </td>
                              <td className="p-2 text-right">
                                {renderValueWithTrend(
                                  row.totalCo2eKg,
                                  totalChange,
                                  2 // 2 decimal places for total CO2e
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* TOTALS + TREND & RISK  +  PERFORMANCE & BENCHMARKING */}
                <section className="grid md:grid-cols-2 gap-4">
                  {/* LEFT CARD: TOTALS + LAST MONTH + TREND & RISK (moved here) */}
                  <article className="rounded-xl bg-white border p-6 shadow flex flex-col gap-4">
                    {/* Total CO2e */}
                    <div>
                      <p className={SECTION_LABEL}>
                        Total CO₂e · {periodLabel}
                      </p>
                      <p className="text-3xl font-semibold mt-3">
                        {formatTonnes(dashData.totalCo2eKg)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Total for this period across{' '}
                        {months.length === 1
                          ? 'this month'
                          : `${months.length} months`}
                        .
                      </p>
                    </div>

                    {/* Last reported month */}
                    <div className="pt-4 border-t border-slate-100">
                      <p className={SECTION_LABEL}>Last reported month</p>
                      <p className="text-sm font-medium mt-2">
                        {lastMonthLabel}
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {formatTonnes(lastMonthCo2eKg)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        vs previous month:{' '}
                        {prevMonth
                          ? `${
                              monthChangePercent >= 0 ? '+' : ''
                            }${monthChangePercent.toFixed(1)}%`
                          : 'n/a'}
                      </p>
                    </div>

                    {/* Trend & risk (moved from sidebar) */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Trend (last 6 months in view)
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <Sparkline values={sparkValues} />
                          <p className="text-[11px] text-slate-600">
                            {sparkValues.length >= 2
                              ? 'Quick view of how your total footprint has been moving in this period.'
                              : 'Add more months of data to unlock a trend view.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Year-on-year change
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          {yoyChange === null
                            ? 'Once you’ve logged 12+ months, we’ll show year-on-year movement here.'
                            : `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(
                                1
                              )}% vs the same month last year.`}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Refrigerant risk
                        </p>
                        <div className="mt-2 flex items-start gap-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium ${riskClasses}`}
                          >
                            {riskLevel} risk
                          </span>
                          <p className="text-slate-600">
                            Refrigerant currently accounts for{' '}
                            <span className="font-semibold">
                              {refrigerantShare.toFixed(1)}%
                            </span>{' '}
                            of your footprint. High values can indicate leaks or
                            inefficient cooling assets.
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* RIGHT CARD: PERFORMANCE + AI INSIGHTS + BENCHMARKING */}
                  <article className="rounded-xl bg-white border p-6 shadow flex flex-col">
                    {/* PERFORMANCE */}
<div className="flex items-center justify-between gap-2">
  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
    <span>Performance</span>
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
      Beta
    </span>
  </p>
  {performanceScore100 !== null && (
    <p className="text-[10px] text-slate-500">
      Score (0–100):{' '}
      <span className="font-semibold text-slate-900">
        {performanceScore100}
      </span>
    </p>
  )}
</div>

{statusPillLabel && (
  <p className="mt-4 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-slate-200 text-slate-800">
    {statusPillLabel}
  </p>
)}

{statusDescription && (
  <p className="mt-3 text-[11px] text-slate-600">
    {statusDescription}
  </p>
)}

{performanceStars !== null &&
  performanceScore100 !== null && (
    <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-600">
      <span>Performance score:</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={
              i <= performanceStars
                ? 'text-yellow-400'
                : 'text-slate-300'
            }
          >
            ★
          </span>
        ))}
      </div>
    </div>
  )}

{/* SCORE BREAKDOWN – stat cards */}
<div className="mt-6 grid grid-cols-2 gap-3 text-[11px] text-slate-600">
  <div className="border border-slate-100 rounded-lg px-3 py-2 bg-slate-50">
    <p className="font-medium text-slate-900">
      Risk signals
    </p>
    <p className="text-slate-500">
      {riskLevel}
    </p>
  </div>

  <div className="border border-slate-100 rounded-lg px-3 py-2 bg-slate-50">
    <p className="font-medium text-slate-900">
      Trend stability
    </p>
    <p className="text-slate-500">
      {statusPillLabel ?? 'n/a'}
    </p>
  </div>

  <div className="border border-slate-100 rounded-lg px-3 py-2 bg-slate-50 col-span-2 md:col-span-1">
    <p className="font-medium text-slate-900">
      Monthly compliance
    </p>
    <p className="text-slate-500">
      {hasData ? 'On track' : 'Not started'}
    </p>
  </div>
</div>
                    {/* BENCHMARKING */}
<div className="mt-6 pt-5 border-t border-slate-100">
  <h2 className="text-sm font-semibold text-slate-900 mb-2">
    Benchmarking
  </h2>

  <p className="text-xs text-slate-600 mb-3">
  Comparison against a typical {industryLabel} SME, scaled to the selected period.
</p>


  {months.length > 0 ? (() => {
    // --- UK SME BASELINE (annual, tonnes CO2e) ---
    const industryKey = normaliseIndustry(profile?.industry);

const annualBaselineTonnes =
  UK_SME_BASELINES[industryKey] ??
  UK_SME_BASELINES.other;


    // --- YOUR EMISSIONS (period-based) ---
    const youTonnes = dashData.totalCo2eKg / 1000;

    // --- SCALE BASELINE TO PERIOD ---
    const industryForPeriod =
  annualBaselineTonnes * (months.length / 12);


    // --- DIFFERENCE ---
    const diffPercent =
      industryForPeriod > 0
        ? ((youTonnes - industryForPeriod) / industryForPeriod) * 100
        : 0;

    // --- LABEL ---
    let label = 'In line with average';
    let labelClass = 'bg-slate-100 text-slate-700 border-slate-200';

    if (diffPercent <= -10) {
      label = 'Better than average';
      labelClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
    } else if (diffPercent >= 10) {
      label = 'Above average';
      labelClass = 'bg-rose-50 text-rose-700 border-rose-100';
    }

    // --- BAR WIDTHS ---
    const maxVal = Math.max(youTonnes, industryForPeriod, 0.01);
    const youWidth = Math.min(100, (youTonnes / maxVal) * 100);
    const industryWidth = Math.min(100, (industryForPeriod / maxVal) * 100);

    return (
      <>
        <p className="text-sm text-slate-700 mb-3">
          Over this period, your total emissions are{' '}
          <span className="font-semibold">
            {diffPercent >= 0 ? '+' : ''}
            {diffPercent.toFixed(1)}%
          </span>{' '}
          compared to a typical UK SME.
        </p>

        <div className="space-y-3 mb-3">
          <div>
  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
    {industryLabel} Industry average
  </p>

  <div className="mt-1 flex items-center gap-2">
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-slate-300"
        style={{ width: `${industryWidth}%` }}
      />
    </div>
    <span className="text-[11px] font-medium tabular-nums text-slate-600">
      {industryForPeriod.toFixed(2)} t CO₂e
    </span>
  </div>
</div>


          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              You
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${youWidth}%` }}
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums text-slate-900">
                {youTonnes.toFixed(2)} t CO₂e
              </span>
            </div>
          </div>
        </div>

        <div
          className={`inline-flex items-center mt-1 text-[10px] font-medium px-3 py-1 rounded-full border ${labelClass}`}
        >
          {label}
        </div>
      </>
    );
  })() : (
    <p className="text-xs text-slate-500">
      Add emissions data to enable benchmarking.
    </p>
  )}
</div>


                  </article>
                </section>
                

                {/* RECOMMENDED NEXT ACTIONS (AI + fallback) */}
                {finalActions.length > 0 && (
                  <section className="rounded-xl bg-white border p-6 shadow">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-3">
                      Recommended next actions
                    </p>

                    <ul className="grid gap-2 text-[11px] md:grid-cols-2">
                      {finalActions.map((item, idx) => {
                        const words = item.title.split(' ');
                        const first = words.shift();
                        const rest = words.join(' ');

                        return (
                          <li
                            key={idx}
                            className="border rounded-lg px-3 py-2 bg-slate-50"
                          >
                            <p className="font-semibold text-slate-900 mb-0.5">
                              <span className="text-indigo-700">{first}</span>{' '}
                              {rest}
                            </p>
                            <p className="text-slate-600">{item.description}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* AUTOMATIONS – KEEP THINGS MOVING AUTOMATICALLY */}
                {automationCards.length > 0 && (
                  <section className="rounded-xl bg-white border p-6 shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Automations
                        </p>
                        <h2 className="text-sm font-semibold text-slate-900 mt-1">
                          Keep things moving automatically
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Turn these into real reminders or workflows later. For
                          now, use them as a playbook for what to automate
                          first.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {automationCards.map((auto, idx) => (
                        <article
                          key={idx}
                          className="border border-slate-100 rounded-lg bg-slate-50 px-3 py-3 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-xs font-semibold text-slate-900">
                                {auto.title}
                              </h3>
                              <span className="inline-flex items-center rounded-full bg-slate-900 text-white text-[9px] px-2 py-0.5">
                                {auto.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {auto.description}
                            </p>
                          </div>
                          <p className="mt-3 text-[10px] text-slate-500">
                            Cadence:{' '}
                            <span className="font-medium text-slate-900">
                              {auto.cadence}
                            </span>
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-xl bg-white border p-8 text-center shadow">
                <p className="text-sm font-medium text-slate-800">
                  No emissions data yet.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the "+ Add emission" action on the left to log your first
                  activities.
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
