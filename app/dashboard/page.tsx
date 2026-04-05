// app/dashboard/page.tsx

'use client';

import HotspotPieChart from './HotspotPieChart';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

import { normaliseSharesTo100 } from '@/lib/normalisePercentages';

import OnboardingCard from './OnboardingCard';

import { calcRefrigerantCo2e } from '../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { computeBrsrCompleteness, type BrsrCompletenessResult } from '@/lib/brsrCompleteness';
import type { OrgWithHierarchy } from '@/lib/enterprise';
import ViewSwitcher from '@/app/dashboard/ViewSwitcher';
import { type EnterpriseViewState, loadViewState, saveViewState, getViewLabel, DEFAULT_VIEW } from '@/lib/enterpriseView';

// Safe absolute base URL for server-side fetch (Vercel SSR fix)
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';




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
  lpgKg?: number;
  cngKg?: number;
  fuelCo2eKg?: number;
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
    scope3SharePercent: number;
  };
  hotspot: 'Electricity' | 'Fuel' | 'Refrigerant' | null;
  scopeBreakdown: {
    scope1and2Co2eKg: number;
    scope3Co2eKg: number;
  };
  countryCode: string;
  efVersion: string;
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
  other: 1.82,
};

// EU SME annual baseline emissions (tonnes CO₂e / year)
// Based on EU average grid factor (~0.275 kg/kWh, EEA) and Eurostat SME energy data
const EU_SME_BASELINES: Record<string, number> = {
  logistics: 3.2,
  supply_chain: 2.8,
  manufacturing: 3.8,
  retail: 2.0,
  hospitality: 2.3,
  office: 1.5,
  education: 1.4,
  healthcare: 1.9,
  technology: 1.3,
  other: 1.7,
};

// India SME annual baseline emissions (tonnes CO₂e / year)
// Based on India grid factor (0.82 kg/kWh) and BEE industry data
const IN_SME_BASELINES: Record<string, number> = {
  logistics: 6.0,
  supply_chain: 4.5,
  manufacturing: 7.0,
  retail: 3.5,
  hospitality: 4.0,
  office: 2.2,
  education: 2.5,
  healthcare: 3.5,
  technology: 2.2,
  'it/software': 2.2,
  'it_&_technology': 2.2,
  other: 3.0,
};

function formatKg(v: number) {
  return `${v.toLocaleString()} kg CO₂e`;
}

function formatTonnes(v: number) {
  return `${(v / 1000).toFixed(2)} t CO₂e`;
}

// Shared label style for small section headings
const SECTION_LABEL = 'text-[10px] uppercase tracking-[0.16em] text-slate-500';

type ViewFilter =
  | { type: 'enterprise'; orgId: string }
  | { type: 'entity'; orgId: string; entityId: string; siteIds: string[] }
  | { type: 'site'; orgId: string; siteId: string }
  | null;

async function getDashboardData(
  supabase: typeof import('../../lib/supabaseClient').supabase,

  period: PeriodKey,
  userId: string | undefined,
  viewFilter?: ViewFilter
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
        scope3SharePercent: 0,
      },
      hotspot: null,
      scopeBreakdown: {
        scope1and2Co2eKg: 0,
        scope3Co2eKg: 0,
      },
      countryCode: 'GB',
      efVersion: '',
    };
  }

  const [
    { data: emissionsData, error: emissionsError },
    { data: scope3Data, error: scope3Error },
    { data: latestInsight },
  ] = await Promise.all([
    (() => {
      let q = supabase.from('emissions').select('*')
      if (viewFilter?.type === 'enterprise') {
        q = q.eq('org_id', viewFilter.orgId)
      } else if (viewFilter?.type === 'entity') {
        q = q.in('site_id', viewFilter.siteIds)
      } else if (viewFilter?.type === 'site') {
        q = q.eq('site_id', viewFilter.siteId)
      }
      return q.order('month', { ascending: true })
    })(),
    supabase.from('scope3_activities').select('*'),
    supabase.from('ai_insights').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (emissionsError) {
    console.error('Error loading emissions for dashboard', emissionsError);
  }

  if (scope3Error) {
    console.error('Error loading scope 3 for dashboard', scope3Error);
  }

  // For entity/site views, scope3 has no site attribution so we attribute by month:
  // only include scope3 entries whose month appears in this entity/site's emissions.
  const filteredScope3Data = (viewFilter?.type === 'entity' || viewFilter?.type === 'site') && scope3Data && emissionsData
    ? (() => {
        const emissionMonths = new Set(emissionsData.map((r: any) => r.month));
        return scope3Data.filter((r: any) => emissionMonths.has(r.month));
      })()
    : scope3Data;

  const hasEmissions = emissionsData && emissionsData.length > 0;
  const hasScope3 = filteredScope3Data && filteredScope3Data.length > 0;

  const countryCode = (emissionsData?.[0] as any)?.country_code ?? 'GB';
  const ef = getFactorsForCountry(countryCode);

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
        scope3SharePercent: 0,
      },
      hotspot: null,
      scopeBreakdown: {
        scope1and2Co2eKg: 0,
        scope3Co2eKg: 0,
      },
      countryCode,
      efVersion: ef.version,
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
      const lpgKg = Number(row.lpg_kg ?? 0);
      const cngKg = Number(row.cng_kg ?? 0);
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
      const fuelCo2eKg =
        dieselLitres * ef.diesel +
        petrolLitres * ef.petrol +
        gasKwh * ef.gas +
        lpgKg * ef.lpgKg +
        cngKg * ef.cngKg;

      const baseTotalCo2e =
        electricityKwh * ef.electricity +
        fuelCo2eKg +
        calcRefrigerantCo2e(refrigerantKg, refrigerantCode);

      monthMap.set(monthLabel, {
        monthLabel,
        electricityKwh,
        fuelLitres,
        refrigerantKg,
        totalCo2eKg: baseTotalCo2e, // will add Scope 3 on top later
        dieselLitres,
        petrolLitres,
        gasKwh,
        lpgKg,
        cngKg,
        fuelCo2eKg,
        refrigerantCode,
        scope1and2Co2eKg: baseTotalCo2e,
        scope3Co2eKg: 0,
      });
    });
  }

  // ---- Scope 3 from scope3_activities table ----
  if (filteredScope3Data) {
    filteredScope3Data.forEach((row: any) => {
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

  // Country-aware breakdown (Scopes 1+2 only)
  const totalElec = periodMonths.reduce(
    (s, m) => s + m.electricityKwh * ef.electricity,
    0
  );

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
    (s, m) =>
      s +
      calcRefrigerantCo2e(
        m.refrigerantKg ?? 0,
        m.refrigerantCode ?? 'GENERIC_HFC'
      ),
    0
  );

  const denom = totalElec + totalFuel + totalRef + scope3TotalCo2eKg || 1;

  const rawShares = {
    electricity: (totalElec / denom) * 100,
    fuel: (totalFuel / denom) * 100,
    refrigerant: (totalRef / denom) * 100,
    scope3: (scope3TotalCo2eKg / denom) * 100,
  };

  const normalised = normaliseSharesTo100(rawShares);

  const breakdownBySource = {
    electricitySharePercent: normalised.electricity,
    fuelSharePercent: normalised.fuel,
    refrigerantSharePercent: normalised.refrigerant,
    scope3SharePercent: normalised.scope3,
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
      scope3SharePercent: normalised.scope3,
    },
    hotspot,
    scopeBreakdown: {
      scope1and2Co2eKg: totalCo2eKg - scope3TotalCo2eKg,
      scope3Co2eKg: scope3TotalCo2eKg,
    },
    countryCode,
    efVersion: ef.version,
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
  | 'fuelCo2eKg'
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
  if (!prev || prev === 0 || current == null) return null;
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

  const router = useRouter();

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
    // Seed isPro from cache so nav link renders correctly on first paint
    if (sessionStorage.getItem('greenio_is_pro') === '1') setIsPro(true);
    if (sessionStorage.getItem('greenio_is_enterprise') === '1') setIsEnterprise(true);
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
// Initialise from sessionStorage for instant render (stale-while-revalidate)
const [state, setState] = React.useState<{
  dashData: DashboardData;
  profile: any;
  finalActions: { title: string; description: string }[];
} | null>(() => {
  try {
    const cached = sessionStorage.getItem('dashboard_state');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed ?? null;
  } catch { return null; }
});

const [isTeamMember, setIsTeamMember] = React.useState(false);
const [isPro, setIsPro] = React.useState(false);
const [isEnterprise, setIsEnterprise] = React.useState(false);
// null = not yet known (hides all country-specific content until confirmed)
const [isIndia, setIsIndia] = React.useState<boolean | null>(null);
const [isGB, setIsGB] = React.useState<boolean | null>(null);
const EU_COUNTRIES_SET = React.useMemo(() => new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']), []);
const [isEU, setIsEU] = React.useState<boolean | null>(null);
const [brsrResult, setBrsrResult] = React.useState<BrsrCompletenessResult | null>(() => {
  try {
    const c = sessionStorage.getItem('greenio_brsr_result_v1');
    return c ? JSON.parse(c) : null;
  } catch { return null; }
});
const [indiaEnvTotals, setIndiaEnvTotals] = React.useState<{
  totalWaterKl: number;
  waterCo2eKg: number;
  totalWasteKg: number;
  wasteCo2eKg: number;
  latestAirFY: number | null;
  noxT: number | null;
  soxT: number | null;
  pmT: number | null;
} | null>(() => {
  try {
    const c = sessionStorage.getItem('greenio_india_env_totals_v1');
    return c ? JSON.parse(c) : null;
  } catch { return null; }
});
const [emailVerified, setEmailVerified] = React.useState(true); // default true to avoid flash
const [resendingVerification, setResendingVerification] = React.useState(false);
const [verificationSent, setVerificationSent] = React.useState(false);
const [showProfileMenu, setShowProfileMenu] = React.useState(false);
const [enterpriseView, setEnterpriseView] = React.useState<EnterpriseViewState>(() => {
  try { return loadViewState(); } catch { return DEFAULT_VIEW; }
});
const [orgEntities, setOrgEntities] = React.useState<{ id: string; name: string }[]>([]);
const [orgSites, setOrgSites] = React.useState<{ id: string; name: string; entity_id: string }[]>([]);
const [orgData, setOrgData] = React.useState<OrgWithHierarchy | null>(null);
const [consolidationData, setConsolidationData] = React.useState<any>(null);
const [automations, setAutomations] = React.useState({
  reminder_enabled: false,
  snapshot_enabled: false,
  refrigerant_watch_enabled: false,
});
const [automationsSaving, setAutomationsSaving] = React.useState<string | null>(null);

async function toggleAutomation(key: 'reminder_enabled' | 'snapshot_enabled' | 'refrigerant_watch_enabled') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const newVal = !automations[key];
  setAutomations(prev => ({ ...prev, [key]: newVal }));
  setAutomationsSaving(key);
  await supabase.from('notification_settings').upsert(
    { user_id: session.user.id, [key]: newVal, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  setAutomationsSaving(null);
}
function handleViewChange(newView: EnterpriseViewState) {
  const viewWithOrg: EnterpriseViewState = { ...newView, orgId: enterpriseView.orgId };
  // Attach siteIds for entity view so insights pages can filter without extra API calls
  if (viewWithOrg.mode === 'entity' && viewWithOrg.entityId) {
    viewWithOrg.siteIds = orgSites
      .filter(s => s.entity_id === viewWithOrg.entityId)
      .map(s => s.id);
  } else {
    delete viewWithOrg.siteIds;
  }
  setEnterpriseView(viewWithOrg);
  saveViewState(viewWithOrg);
  refreshDashboardData(viewWithOrg);
  if (viewWithOrg.mode === 'enterprise' && viewWithOrg.orgId) {
    refreshConsolidationData(viewWithOrg.orgId, new Date().getFullYear());
  }
}
async function refreshDashboardData(view: EnterpriseViewState) {
  if (!view.orgId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  let filter: ViewFilter = null;
  if (view.mode === 'enterprise') {
    filter = { type: 'enterprise', orgId: view.orgId };
  } else if (view.mode === 'entity' && view.entityId) {
    // Use view.siteIds if already computed (by handleViewChange); fallback to orgSites lookup
    const siteIds = view.siteIds?.length
      ? view.siteIds
      : orgSites.filter((s) => s.entity_id === view.entityId).map((s) => s.id);
    filter = { type: 'entity', orgId: view.orgId, entityId: view.entityId, siteIds };
  } else if (view.mode === 'site' && view.siteId) {
    filter = { type: 'site', orgId: view.orgId, siteId: view.siteId };
  }
  const newDashData = await getDashboardData(supabase, period, session.user.id, filter);
  setState((prev) => (prev ? { ...prev, dashData: newDashData } : prev));
}
async function refreshConsolidationData(orgId: string, _financialYear: number, siteList?: { id: string; name: string; entity_id: string }[]) {
  try {
    const [{ data: emissions, error }, { data: scope3Rows }] = await Promise.all([
      supabase.from('emissions').select('*').eq('org_id', orgId),
      supabase.from('scope3_activities').select('month, co2e_kg'),
    ]);
    if (error || !emissions) return;

    const sites = siteList ?? orgSites;
    const siteToEntity = new Map<string, string>();
    for (const s of sites) siteToEntity.set(s.id, s.entity_id);

    const EF = { diesel: 0.25268, petrol: 0.23646, gas: 0.18254, lpg: 1.5551, cng: 2.5407, refrigerant: 1774, electricity: 0.233 };
    const safe = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

    // Map entity → months covered by its emissions (for scope3 attribution)
    const entityMonths = new Map<string, Set<string>>();
    const entityTotals = new Map<string, { co2e: number; s1: number; s2: number }>();
    for (const r of emissions) {
      const eid = r.site_id ? (siteToEntity.get(r.site_id) ?? '_none') : '_none';
      const s1 = safe(r.diesel_litres) * EF.diesel + safe(r.petrol_litres) * EF.petrol + safe(r.gas_kwh) * EF.gas + safe(r.lpg_kg) * EF.lpg + safe(r.cng_kg) * EF.cng + safe(r.refrigerant_kg) * EF.refrigerant;
      const s2 = safe(r.electricity_kwh ?? r.electricity_kw) * EF.electricity;
      const co2e = safe(r.total_co2e ?? r.total_co2e_kg);
      const et = entityTotals.get(eid) ?? { co2e: 0, s1: 0, s2: 0 };
      et.co2e += co2e; et.s1 += s1; et.s2 += s2;
      entityTotals.set(eid, et);
      if (r.month) {
        const ms = entityMonths.get(eid) ?? new Set<string>();
        ms.add(r.month);
        entityMonths.set(eid, ms);
      }
    }

    // Add scope3 to each entity using month-based attribution
    for (const r of (scope3Rows ?? [])) {
      if (!r.month) continue;
      const amount = safe(r.co2e_kg);
      if (!amount) continue;
      entityMonths.forEach((months, eid) => {
        if (months.has(r.month)) {
          const et = entityTotals.get(eid) ?? { co2e: 0, s1: 0, s2: 0 };
          et.co2e += amount;
          entityTotals.set(eid, et);
        }
      });
    }

    const by_entity = sites
      .reduce<string[]>((acc, s) => { if (!acc.includes(s.entity_id)) acc.push(s.entity_id); return acc; }, [])
      .map(eid => {
        const et = entityTotals.get(eid) ?? { co2e: 0, s1: 0, s2: 0 };
        const s3 = Math.round((et.co2e - et.s1 - et.s2) * 100) / 100;
        return { entity_id: eid, total_co2e: Math.round(et.co2e * 100) / 100, scope1_co2e: Math.round(et.s1 * 100) / 100, scope2_co2e: Math.round(et.s2 * 100) / 100, scope3_co2e: s3 > 0 ? s3 : 0 };
      });

    setConsolidationData({ by_entity });
  } catch {}
}
const profileMenuRef = React.useRef<HTMLDivElement>(null);

// Resolve isIndia from sessionStorage immediately on mount (client-only)
React.useEffect(() => {
  try {
    const cached = sessionStorage.getItem('dashboard_state');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.profile?.country !== undefined) {
        setIsIndia(parsed.profile.country === 'IN');
        setIsGB(parsed.profile.country === 'GB');
        setIsEU(EU_COUNTRIES_SET.has(parsed.profile.country ?? ''));
      }
    }
  } catch {}
}, []);

// Close profile menu on scroll or outside click
React.useEffect(() => {
  const close = () => setShowProfileMenu(false);
  const handleClickOutside = (e: MouseEvent) => {
    if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
      setShowProfileMenu(false);
    }
  };
  window.addEventListener('scroll', close, true);
  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    window.removeEventListener('scroll', close, true);
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);




React.useEffect(() => {
  let cancelled = false;

  async function load() {
    const { data: { session } } = await supabase.auth.getSession(); // local, no network
    const user = session?.user;
    if (!user || cancelled) return;

    // Check if the link was meant for a specific account (e.g. from alert email)
    const uidParam = new URLSearchParams(window.location.search).get('uid');
    if (uidParam && uidParam !== user.id) {
      window.location.replace(`/login?next=/dashboard?uid=${uidParam}&hint=wrong_account`);
      return;
    }

    // Partner accounts must not access the main dashboard
    if (user.user_metadata?.account_type === 'partner') {
      window.location.replace('/partner-portal');
      return;
    }

    if (!user.email_confirmed_at) setEmailVerified(false);

    // Fire team membership, own plan, and dashboard data all at once
    const [{ data: memberRow }, { data: ownPlanRow }, dashData] = await Promise.all([
      supabase.from('team_members').select('id, owner_id').eq('member_user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('user_plans').select('plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      getDashboardData(supabase, period, user.id, null),
    ]);
    if (cancelled) return;

    if (memberRow) setIsTeamMember(true);

    // Resolve plan — team members inherit owner's plan
    let planRow = ownPlanRow;
    if (memberRow?.owner_id && memberRow.owner_id !== user.id) {
      const { data: ownerPlan } = await supabase
        .from('user_plans').select('plan').eq('user_id', memberRow.owner_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      planRow = ownerPlan;
    }
    const proUser = ['pro', 'enterprise'].includes(planRow?.plan ?? '');
    if (proUser) setIsPro(true);
    const enterpriseUser = planRow?.plan === 'enterprise';
    if (enterpriseUser) setIsEnterprise(true);
    try { sessionStorage.setItem('greenio_is_pro', proUser ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('greenio_is_enterprise', enterpriseUser ? '1' : '0'); } catch {}

    // Enterprise users with no organisation yet → enterprise onboarding
    let enterpriseStateSet = false;
    if (!cancelled && planRow?.plan === 'enterprise' && !memberRow) {
      const { getUserOrgs, getOrgWithHierarchy } = await import('@/lib/enterprise');
      const orgs = await getUserOrgs(user.id);
      if (!cancelled && orgs.length === 0) {
        router.push('/enterprise/onboarding');
        return;
      }
      if (!cancelled && orgs.length > 0) {
        const orgData = await getOrgWithHierarchy(orgs[0].id);
        if (!cancelled && orgData) {
          setOrgData(orgData);
          const ents = orgData.entities.map((e) => ({ id: e.id, name: e.name }));
          const siteList: { id: string; name: string; entity_id: string }[] = [];
          for (const e of orgData.entities) {
            for (const s of (e.sites ?? [])) {
              siteList.push({ id: s.id, name: s.name, entity_id: e.id });
            }
          }
          setOrgEntities(ents);
          setOrgSites(siteList);
          refreshConsolidationData(orgData.id, new Date().getFullYear(), siteList);
          // Restore saved view state — attach orgId, keep mode/entity/site selection
          const savedView = loadViewState();
          const initView: EnterpriseViewState = { ...savedView, orgId: orgData.id };
          // Rehydrate siteIds for entity view from the loaded org hierarchy
          if (initView.mode === 'entity' && initView.entityId) {
            initView.siteIds = siteList.filter(s => s.entity_id === initView.entityId).map(s => s.id);
          }
          setEnterpriseView(initView);
          saveViewState(initView);
          let initFilter: ViewFilter = { type: 'enterprise', orgId: orgData.id };
          if (initView.mode === 'entity' && initView.entityId) {
            initFilter = { type: 'entity', orgId: orgData.id, entityId: initView.entityId, siteIds: initView.siteIds ?? [] };
          } else if (initView.mode === 'site' && initView.siteId) {
            initFilter = { type: 'site', orgId: orgData.id, siteId: initView.siteId };
          }
          const entDashData = await getDashboardData(supabase, period, user.id, initFilter);
          if (!cancelled) {
            setState({ dashData: entDashData, profile: null, finalActions: [] });
            enterpriseStateSet = true;
          }
        }
      }
    }

    // Only set the unfiltered dashData for non-enterprise users; enterprise already set correct filtered state above
    if (!cancelled && !enterpriseStateSet) {
      setState({
        dashData,
        profile: null,
        finalActions: [],
      });
    }
if (!cancelled && !enterpriseStateSet) {
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
  .select('onboarding_complete, industry, company_name, country, india_water_enabled, india_waste_enabled, india_air_enabled')
  .eq('id', user.id)
  .single()
  .then(async ({ data, error }) => {
    if (error) {
      console.error('Failed to load profile:', error);
      return;
    }

    if (!cancelled && data) {
      setState((prev) =>
        prev
          ? { ...prev, profile: data }
          : prev
      );
    }

    // 2b️⃣ BRSR completeness — India accounts only (non-blocking)
    setIsIndia(data?.country === 'IN');
    setIsGB(data?.country === 'GB');
    setIsEU(EU_COUNTRIES_SET.has(data?.country ?? ''));
    if (data?.country === 'IN' && !cancelled) {
      const [brsrRes, scope1Res, scope2Res, scope3Res, waterRes, wasteRes] = await Promise.all([
        supabase.from('brsr_profile').select('industry_sector,permanent_employees,permanent_workers,is_listed_company,renewable_elec_pct,has_ghg_reduction_plan').eq('account_id', user.id).maybeSingle(),
        // Scope 1: any row with at least one combustion/refrigerant source
        supabase.from('emissions').select('id').eq('user_id', user.id).or('diesel_litres.gt.0,petrol_litres.gt.0,gas_kwh.gt.0,lpg_kg.gt.0,cng_kg.gt.0,refrigerant_kg.gt.0').limit(1),
        // Scope 2: any row with electricity
        supabase.from('emissions').select('id').eq('user_id', user.id).gt('electricity_kw', 0).limit(1),
        supabase.from('scope3_activities').select('id').eq('user_id', user.id).limit(1),
        data.india_water_enabled ? supabase.from('water_entries').select('id').eq('account_id', user.id).limit(1) : Promise.resolve({ data: [] as any[] }),
        data.india_waste_enabled ? supabase.from('waste_entries').select('id').eq('account_id', user.id).limit(1) : Promise.resolve({ data: [] as any[] }),
      ]);
      const result = computeBrsrCompleteness(
        brsrRes.data ?? null,
        {
          hasScope1: (scope1Res.data?.length ?? 0) > 0,
          hasScope2: (scope2Res.data?.length ?? 0) > 0,
          hasScope3: (scope3Res.data?.length ?? 0) > 0,
          hasWater:  (waterRes.data?.length ?? 0) > 0,
          hasWaste:  (wasteRes.data?.length ?? 0) > 0,
        },
        { waterEnabled: !!data.india_water_enabled, wasteEnabled: !!data.india_waste_enabled }
      );
      if (!cancelled) {
        setBrsrResult(result);
        try { sessionStorage.setItem('greenio_brsr_result_v1', JSON.stringify(result)); } catch {}
      }

      // Fetch full env rows — used for dashboard card totals AND prefilled into
      // the greenio_india_env_v1 cache so view-emissions loads instantly
      const [waterAll, wasteAll, airAll] = await Promise.all([
        data.india_water_enabled
          ? supabase.from('water_entries').select('*').eq('account_id', user.id).order('period_year', { ascending: true }).order('period_month', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        data.india_waste_enabled
          ? supabase.from('waste_entries').select('*').eq('account_id', user.id).order('period_year', { ascending: true }).order('period_month', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        data.india_air_enabled
          ? supabase.from('air_emissions').select('*').eq('account_id', user.id).order('period_year', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (!cancelled) {
        const waterData = waterAll.data ?? [];
        const wasteData = wasteAll.data ?? [];
        const airData   = airAll.data ?? [];
        const latestAir = airData[0] ?? null;
        const hasEnvData = waterData.length > 0 || wasteData.length > 0 || latestAir;
        if (hasEnvData) {
          const envTotals = {
            totalWaterKl: waterData.reduce((s: number, r: any) => s + (r.volume_withdrawn_kl ?? 0), 0),
            waterCo2eKg:  waterData.reduce((s: number, r: any) => s + (r.co2e_kg ?? 0), 0),
            totalWasteKg: wasteData.reduce((s: number, r: any) => s + (r.total_kg ?? 0), 0),
            wasteCo2eKg:  wasteData.reduce((s: number, r: any) => s + (r.co2e_kg ?? 0), 0),
            latestAirFY: latestAir?.period_year ?? null,
            noxT: latestAir?.nox_tonnes ?? null,
            soxT: latestAir?.sox_tonnes ?? null,
            pmT:  latestAir?.pm_tonnes  ?? null,
          };
          setIndiaEnvTotals(envTotals);
          try { sessionStorage.setItem('greenio_india_env_totals_v1', JSON.stringify(envTotals)); } catch {}
        }
        // Prefill view-emissions cache so Section C renders instantly on navigation
        try {
          sessionStorage.setItem('greenio_india_env_v1', JSON.stringify({
            isIndia: true,
            waterRows: waterData,
            wasteRows: wasteData,
            airRows:   airData,
          }));
        } catch {}
      }
    }
  });


    // 3️⃣ Load AI actions — with localStorage cache keyed by data fingerprint
    const aiCacheKey = `greenio_ai_recs_v1_${user.id}`;
    const aiFingerprint = [
      dashData.totalCo2eKg.toFixed(2),
      dashData.months.length,
      dashData.breakdownBySource.electricitySharePercent.toFixed(1),
      dashData.breakdownBySource.fuelSharePercent.toFixed(1),
      dashData.breakdownBySource.refrigerantSharePercent.toFixed(1),
    ].join('|');

    let cacheHit = false;
    try {
      const cached = JSON.parse(localStorage.getItem(aiCacheKey) ?? 'null');
      if (cached?.fingerprint === aiFingerprint && Array.isArray(cached?.actions) && cached.actions.length > 0) {
        cacheHit = true;
        if (!cancelled) {
          setState((prev) => {
            if (!prev) return prev;
            const next = { ...prev, finalActions: cached.actions };
            try { sessionStorage.setItem('dashboard_state', JSON.stringify(next)); } catch {}
            return next;
          });
        }
      }
    } catch {}

    if (!cacheHit) {
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
            setState((prev) => {
              if (!prev) return prev;
              const next = { ...prev, finalActions: json.actions };
              try { sessionStorage.setItem('dashboard_state', JSON.stringify(next)); } catch {}
              return next;
            });
            try {
              localStorage.setItem(aiCacheKey, JSON.stringify({ fingerprint: aiFingerprint, actions: json.actions }));
            } catch {}
          }
        })
        .catch(() => {});
    }
  }

  // 4️⃣ Background prefetch — populates cache so org/team/partner pages load instantly
  async function prefetchForNavigation() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) return;

      // Full profile → organisation page reads greenio_profile_cache
      supabase.from('profiles').select('*').eq('id', uid).single().then(({ data: p }) => {
        if (!p) return;
        try {
          sessionStorage.setItem('greenio_profile_cache', JSON.stringify({
            form: {
              company_name: p.company_name ?? '', industry: p.industry ?? '',
              country: p.country ?? '', city: p.city ?? '', address: p.address ?? '',
              postcode: p.postcode ?? '', company_size: p.company_size ?? '',
              secr_required: !!p.secr_required, data_confirmed_by_user: !!p.data_confirmed_by_user,
              sustainability_stage: p.sustainability_stage ?? '', contact_name: p.contact_name ?? '',
              contact_email: p.contact_email ?? '', has_company_vehicles: !!p.has_company_vehicles,
              renewable_energy_tariff: !!p.renewable_energy_tariff,
              annual_revenue: p.annual_revenue ?? '', employee_count: p.employee_count ?? '',
              annual_output_units: p.annual_output_units ?? '',
              methodology_confirmed: !!p.methodology_confirmed,
              energy_efficiency_actions: p.energy_efficiency_actions ?? '',
            },
            isTeamMember: false,
          }));
        } catch {}
      });

      // Team members → team page reads greenio_team_data_v1
      fetch('/api/team/members', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (json?.members) {
            try { sessionStorage.setItem('greenio_team_data_v1', JSON.stringify({ members: json.members, ownerEmail: session.user?.email ?? '' })); } catch {}
          }
        })
        .catch(() => {});

      // Enterprise org → /organisation/enterprise reads greenio_enterprise_org_v1
      if (sessionStorage.getItem('greenio_is_enterprise') === '1') {
        const { getUserOrgs, getOrgWithHierarchy } = await import('@/lib/enterprise');
        getUserOrgs(uid).then(orgs => {
          if (!orgs[0]) return;
          getOrgWithHierarchy(orgs[0].id).then(orgData => {
            if (!orgData) return;
            fetch(`/api/org/members?org_id=${orgData.id}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : [])
              .then(members => {
                try { sessionStorage.setItem('greenio_enterprise_org_v1', JSON.stringify({ orgData, members })); } catch {}
              })
              .catch(() => {
                try { sessionStorage.setItem('greenio_enterprise_org_v1', JSON.stringify({ orgData, members: [] })); } catch {}
              });
          });
        });
      }
    } catch {}
  }

  load();
  prefetchForNavigation();

  // Load automation settings
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    supabase
      .from('notification_settings')
      .select('reminder_enabled, snapshot_enabled, refrigerant_watch_enabled')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAutomations({
          reminder_enabled: !!data.reminder_enabled,
          snapshot_enabled: !!data.snapshot_enabled,
          refrigerant_watch_enabled: !!data.refrigerant_watch_enabled,
        });
      });
  });

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
const industryLabel: string | null =
  profile?.industry
    ? profile.industry
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

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

    automationCards.push({
      title: 'Refrigerant leak watch',
      description:
        'Create an alert whenever refrigerant makes up an unusually high share of your footprint so ops can investigate leaks quickly.',
      cadence: 'On change in refrigerant data',
      tag: 'High impact',
    });
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* EMAIL VERIFICATION BANNER */}
        {!emailVerified && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-base">✉</span>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Please verify your email address.</span>
                {' '}Check your inbox for a confirmation link from Greenio.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {verificationSent ? (
                <span className="text-xs text-emerald-700 font-medium">Sent ✓</span>
              ) : (
                <button
                  disabled={resendingVerification}
                  onClick={async () => {
                    setResendingVerification(true);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user?.email) {
                      await supabase.auth.resend({ type: 'signup', email: session.user.email });
                    }
                    setResendingVerification(false);
                    setVerificationSent(true);
                  }}
                  className="rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {resendingVerification ? 'Sending…' : 'Resend email'}
                </button>
              )}
              <button
                onClick={() => setEmailVerified(true)}
                className="text-amber-400 hover:text-amber-600 text-base leading-none"
                aria-label="Dismiss"
              >✕</button>
            </div>
          </div>
        )}

        {isEnterprise && (
          <section className="rounded-xl bg-white border border-indigo-100 px-4 py-4 shadow">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-500">Enterprise</p>
                {enterpriseView.mode === 'site' && enterpriseView.entityName && (
                  <p className="text-[12px] text-slate-500 mt-0.5">{enterpriseView.entityName}</p>
                )}
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {enterpriseView.mode === 'enterprise'
                    ? 'Consolidated View'
                    : getViewLabel(enterpriseView)}
                </p>
                {orgData && enterpriseView.mode === 'enterprise' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {orgData.entities.length}{' '}{orgData.entities.length === 1 ? 'entity' : 'entities'}{' · '}{orgData.entities.flatMap(e => e.sites).length}{' '}{orgData.entities.flatMap(e => e.sites).length === 1 ? 'site' : 'sites'}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {isEnterprise && enterpriseView.mode === 'enterprise' && orgData && dashData.totalCo2eKg === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>⚠</span>
            <p className="text-[11px]">
              No emissions data found for the current period across all entities.
              <a href='/dashboard/emissions' className='ml-1 underline font-medium'>Add emissions →</a>
            </p>
          </div>
        )}

        {/* ONBOARDING CARD — hidden for team members who don't own the account */}
        {!isTeamMember && profile && !profile.onboarding_complete && (
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
         <div className="absolute top-4 right-4 z-50" ref={profileMenuRef}>
  <details className="relative" open={showProfileMenu} onToggle={(e) => setShowProfileMenu((e.target as HTMLDetailsElement).open)}>
    <summary className="list-none cursor-pointer flex items-center justify-center
        w-9 h-9 rounded-full bg-white shadow-sm border border-slate-200
        text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition">
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
      {isPro ? (
        <Link
          href={isEnterprise ? '/organisation/enterprise' : '/organisation'}
          className="block px-4 py-2 hover:bg-slate-100"
          onClick={() => setShowProfileMenu(false)}
        >
          Organisation
        </Link>
      ) : (
        <Link href="/profile" className="block px-4 py-2 hover:bg-slate-100" onClick={() => setShowProfileMenu(false)}>
          Profile
        </Link>
      )}
      {!isEnterprise && (
        <Link href="/dashboard/team" className="block px-4 py-2 hover:bg-slate-100" onClick={() => setShowProfileMenu(false)}>
          Team
        </Link>
      )}
      <Link href="/billing" className="block px-4 py-2 hover:bg-slate-100" onClick={() => setShowProfileMenu(false)}>
        Billing
      </Link>
      <Link href="/logout" className="block px-4 py-2 text-rose-600 hover:bg-slate-100" onClick={() => setShowProfileMenu(false)}>
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

            {/* Enterprise view switcher */}
            {isEnterprise && orgEntities.length > 0 && (
              <ViewSwitcher
                entities={orgEntities}
                sites={orgSites}
                value={enterpriseView}
                onChange={handleViewChange}
              />
            )}

            {/* EF transparency — tap/click to expand full source attribution */}
            <details className="mt-3 ml-4">
              <summary className="inline-flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer list-none select-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 flex-shrink-0">
                  <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 4.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM8 10.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z" clipRule="evenodd" />
                </svg>
                Using {dashData.countryCode} emission factors
              </summary>
              <p className="mt-1 text-[10px] text-slate-500 leading-relaxed max-w-xs">{dashData.efVersion}</p>
            </details>
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

                {/* COMPLIANCE & REGULATORY CARD — India only */}
                {isIndia === true && (
                <section className="rounded-xl bg-white border p-6 shadow">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-3">
                    Compliance & Regulatory
                  </p>
                  <div className="space-y-2">
                    <Link
                      href="/dashboard/brsr-profile"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600 group-hover:text-emerald-400">📋</span>
                        BRSR Profile
                      </span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </Link>
                    {isIndia === true && (
                      <Link
                        href="/dashboard/ccts"
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-emerald-600 group-hover:text-emerald-400">🌱</span>
                          CCTS Dashboard
                        </span>
                        <span className="text-slate-400 group-hover:text-slate-300">→</span>
                      </Link>
                    )}
                  </div>
                </section>
                )}

                {/* COMPLIANCE & REGULATORY CARD — UK (GB) only */}
                {isGB === true && (
                <section className="rounded-xl bg-white border p-6 shadow">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-3">
                    Compliance &amp; Regulatory
                  </p>
                  <div className="space-y-2">
                    <Link
                      href="/dashboard/secr-profile"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600 group-hover:text-emerald-400">📋</span>
                        SECR Profile
                      </span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </Link>
                    <Link
                      href="/dashboard/uk-ets"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600 group-hover:text-emerald-400">🌱</span>
                        UK ETS Dashboard
                      </span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </Link>
                  </div>
                </section>
                )}

                {/* COMPLIANCE & REGULATORY CARD — EU only */}
                {isEU === true && (
                <section className="rounded-xl bg-white border p-6 shadow">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-3">
                    Compliance &amp; Regulatory
                  </p>
                  <div className="space-y-2">
                    <Link
                      href="/dashboard/csrd-profile"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600 group-hover:text-emerald-400">📋</span>
                        CSRD Profile
                      </span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </Link>
                    <Link
                      href="/dashboard/eu-ets"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-900 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600 group-hover:text-emerald-400">🌱</span>
                        EU ETS Dashboard
                      </span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </Link>
                  </div>
                </section>
                )}

{/* Right side: tiny KPI + progress bar — hidden for India accounts */}
          {isIndia === false && <div className="w-full md:w-64 lg:w-72 rounded-xl bg-white/80 border border-slate-200 px-4 py-3 shadow-sm backdrop-blur">
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
          </div>}
                {/* BRSR COMPLETENESS — India accounts only */}
                {brsrResult && (
                  <section className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">BRSR Readiness</p>
                        <p className="mt-0.5 text-xs text-slate-500">{brsrResult.completedCount}/{brsrResult.totalCount} checks complete</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">
                        {brsrResult.score}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-[width]"
                        style={{ width: `${brsrResult.score}%` }}
                      />
                    </div>
                    <ul className="space-y-1.5">
                      {brsrResult.checks.filter(c => !c.complete).slice(0, 4).map(check => (
                        <li key={check.key}>
                          <a href={check.linkTo} className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-emerald-700 group">
                            <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0" />
                            <span className="group-hover:underline underline-offset-2">{check.label}</span>
                          </a>
                        </li>
                      ))}
                      {brsrResult.checks.filter(c => c.complete).map(check => (
                        <li key={check.key} className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span>{check.label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* INDIA ENV CARD — Water / Waste / Air */}
                {indiaEnvTotals && (
                  <section className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Sec. C · Principle 6</p>
                    <div className="space-y-2.5">
                      {indiaEnvTotals.totalWaterKl > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">Water withdrawn</span>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-800">{indiaEnvTotals.totalWaterKl.toLocaleString()} kL</p>
                            <p className="text-[10px] text-slate-400">{indiaEnvTotals.waterCo2eKg.toFixed(1)} kg CO₂e</p>
                          </div>
                        </div>
                      )}
                      {indiaEnvTotals.totalWasteKg > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">Waste generated</span>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-800">{indiaEnvTotals.totalWasteKg.toLocaleString()} kg</p>
                            <p className="text-[10px] text-slate-400">{indiaEnvTotals.wasteCo2eKg.toFixed(1)} kg CO₂e (landfill)</p>
                          </div>
                        </div>
                      )}
                      {indiaEnvTotals.latestAirFY && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-slate-600">Air emissions (FY{String(indiaEnvTotals.latestAirFY).slice(2)}–{String(indiaEnvTotals.latestAirFY + 1).slice(2)})</span>
                          <p className="text-xs font-semibold text-slate-800 text-right">
                            {[
                              indiaEnvTotals.noxT != null ? `NOx ${indiaEnvTotals.noxT}t` : null,
                              indiaEnvTotals.soxT != null ? `SOx ${indiaEnvTotals.soxT}t` : null,
                              indiaEnvTotals.pmT != null ? `PM ${indiaEnvTotals.pmT}t` : null,
                            ].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                    <Link href="/dashboard/emissions/view-emissions" className="block text-[11px] text-emerald-700 hover:underline pt-1">
                      View Principle 6 tables →
                    </Link>
                  </section>
                )}

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
{isEnterprise && enterpriseView.mode === 'enterprise' && !orgData ? (
                <section className="rounded-xl bg-white border p-6 shadow animate-pulse">
                  <div className="h-3 w-32 bg-slate-100 rounded mb-4" />
                  <div className="space-y-3">
                    {[1,2].map(i => <div key={i} className="h-8 bg-slate-50 rounded" />)}
                  </div>
                </section>
                ) : isEnterprise && enterpriseView.mode === 'enterprise' && orgData ? (
                <section className="rounded-xl bg-white border p-6 shadow">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Entity overview
                    </h2>
                    <span className="text-[11px] text-slate-400">Click a row to drill into that entity</span>
                  </div>
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2 text-left font-medium text-slate-500">Entity</th>
                          <th className="p-2 text-right font-medium text-slate-500">Scope 1 (kg)</th>
                          <th className="p-2 text-right font-medium text-slate-500">Scope 2 (kg)</th>
                          <th className="p-2 text-right font-medium text-slate-500">Scope 3 (kg)</th>
                          <th className="p-2 text-right font-medium text-slate-500">Total CO₂e (kg)</th>
                          <th className="p-2 text-right font-medium text-slate-500">Sites</th>
                          <th className="p-2 text-right font-medium text-slate-500">Compliance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgData.entities.map(entity => {
                          const flagEmoji = (code: string) =>
                            code.toUpperCase().split('').map((c: string) =>
                              String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
                            ).join('');
                          const complianceLabel =
                            entity.secr_required ? 'SECR' :
                            entity.csrd_required ? 'CSRD' :
                            entity.brsr_required ? 'BRSR' : '—';
                          const complianceColor =
                            entity.secr_required || entity.csrd_required || entity.brsr_required
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-500';
                          return (
                            <tr
                              key={entity.id}
                              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition cursor-pointer"
                              onClick={() => handleViewChange({
                                mode: 'entity',
                                orgId: enterpriseView.orgId ?? orgData.id,
                                entityId: entity.id,
                                entityName: entity.name,
                              })}
                            >
                              <td className="p-2">
                                <span className="mr-1">{flagEmoji(entity.country_code)}</span>
                                <span className="font-medium text-slate-900">{entity.name}</span>
                              </td>
                              {(() => {
                                const entityData = consolidationData?.by_entity?.find(
                                  (e: any) => e.entity_id === entity.id
                                );
                                const s1 = entityData?.scope1_co2e != null ? entityData.scope1_co2e.toFixed(2) : '—';
                                const s2 = entityData?.scope2_co2e != null ? entityData.scope2_co2e.toFixed(2) : '—';
                                const s3 = entityData?.scope3_co2e != null ? entityData.scope3_co2e.toFixed(2) : '—';
                                const total = entityData?.total_co2e != null ? entityData.total_co2e.toFixed(2) : '—';
                                return (
                                  <>
                                    <td className="p-2 text-right text-slate-600">{s1}</td>
                                    <td className="p-2 text-right text-slate-600">{s2}</td>
                                    <td className="p-2 text-right text-slate-600">{s3}</td>
                                    <td className="p-2 text-right font-medium text-slate-900">{total}</td>
                                  </>
                                );
                              })()}
                              <td className="p-2 text-right text-slate-500">{entity.sites.length}</td>
                              <td className="p-2 text-right">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${complianceColor}`}>
                                  {complianceLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                ) : (
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
                            Fuel CO₂e (kg)
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
                            'fuelCo2eKg'
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
                                  row.fuelCo2eKg ?? 0,
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
                )}

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
                            ? "Once you've logged 12+ months, we'll show year-on-year movement here."
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
    Comparison against a typical {industryLabel ? `${industryLabel} ` : ''}SME, scaled to the selected period.
  </p>


  {months.length > 0 ? (() => {
    // --- SME BASELINE (annual, tonnes CO2e) — country-aware ---
    const industryKey = normaliseIndustry(profile?.industry);
    const EU_COUNTRIES = ['DE','FR','IT','ES','NL','BE','AT','SE','DK','FI','PL','PT','IE','CZ','RO','HU','SK','HR','BG','SI','EE','LV','LT','LU','MT','CY'];
    const isEU = EU_COUNTRIES.includes(dashData.countryCode);
    const smeBaselines = dashData.countryCode === 'IN' ? IN_SME_BASELINES : isEU ? EU_SME_BASELINES : UK_SME_BASELINES;
    const smeLabel = dashData.countryCode === 'IN' ? 'Indian' : isEU ? 'European' : 'UK';

const annualBaselineTonnes =
  smeBaselines[industryKey] ??
  smeBaselines.other;


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
          compared to a typical {smeLabel} SME.
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
                {hasData && (
                  <section className="rounded-xl bg-white border p-6 shadow">
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Automations</p>
                      <h2 className="text-sm font-semibold text-slate-900 mt-1">Keep things moving automatically</h2>
                      <p className="text-[11px] text-slate-500 mt-1">Toggle on to activate real email reminders and alerts.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {([
                        {
                          key: 'reminder_enabled' as const,
                          title: 'Monthly logging reminder',
                          description: 'Nudge the data owner on a fixed day each month to upload bills, mileage and refrigerant top-ups so this dashboard stays current.',
                          cadence: 'Once per month',
                          tag: 'Suggested',
                          tagColor: 'bg-slate-900 text-white',
                        },
                        {
                          key: 'snapshot_enabled' as const,
                          title: 'Leadership snapshot email',
                          description: 'Automatically send a one-page summary of total CO₂e, trend and hotspot to your leadership team at the end of each month.',
                          cadence: '1st of every month',
                          tag: 'Suggested',
                          tagColor: 'bg-slate-900 text-white',
                        },
                        {
                          key: 'refrigerant_watch_enabled' as const,
                          title: 'Refrigerant leak watch',
                          description: 'Create an alert whenever refrigerant makes up an unusually high share of your footprint so ops can investigate leaks quickly.',
                          cadence: 'On change in refrigerant data',
                          tag: 'High impact',
                          tagColor: 'bg-orange-600 text-white',
                        },
                      ] as const).map(({ key, title, description, cadence, tag, tagColor }) => {
                        const isOn = automations[key];
                        const saving = automationsSaving === key;
                        return (
                          <article key={key} className={`border rounded-lg px-4 py-4 flex flex-col justify-between transition ${isOn ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="text-xs font-semibold text-slate-900 leading-tight">{title}</h3>
                                <span className={`shrink-0 inline-flex items-center rounded-full text-[9px] px-2 py-0.5 font-medium ${tagColor}`}>{tag}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">{description}</p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-[10px] text-slate-500 min-w-0 flex-1">
                                Cadence: <span className="font-medium text-slate-900">{cadence}</span>
                              </p>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => toggleAutomation(key)}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isOn ? 'bg-emerald-600' : 'bg-slate-300'} ${saving ? 'opacity-50' : ''}`}
                              >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isOn ? 'left-[18px]' : 'left-0.5'}`} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-xl bg-white border p-8 shadow">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold mb-3">Get started</p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Add your first emissions data</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Log a month of electricity, fuel, or gas usage to start building your carbon baseline and unlock benchmarking.
                </p>
                <div className="space-y-3">
                  {[
                    { href: '/dashboard/emissions', label: 'Log electricity, fuel or gas', icon: '⚡' },
                    { href: '/dashboard/emissions/scope3', label: 'Log Scope 3 activities (travel, supply chain)', icon: '🚗' },
                    { href: '/organisation', label: 'Complete your company profile', icon: '🏢' },
                  ].map(({ href, label, icon }) => (
                    <a key={href} href={href} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-900 hover:text-white transition-colors group">
                      <span>{icon}</span>
                      <span className="flex-1">{label}</span>
                      <span className="text-slate-400 group-hover:text-slate-300">→</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}