'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { isEnterpriseUser, getUserOrgs } from '@/lib/enterprise';

// ── Types ──────────────────────────────────────────────────────────────────────

type SiteRow = {
  site_id: string;
  site_name: string;
  city: string | null;
  total_co2e: number;
  has_data: boolean;
  record_count: number;
};

type EntityRow = {
  entity_id: string;
  entity_name: string;
  country_code: string;
  total_co2e: number;
  scope1_co2e: number;
  scope2_co2e: number;
  employee_count: number | null;
  co2e_per_employee: number | null;
  sites: SiteRow[];
};

type MonthRow = {
  month_key: string;
  month_label: string;
  total_co2e: number;
  scope1_co2e: number;
  scope2_co2e: number;
};

type ConsolidationData = {
  org_id: string;
  financial_year: number;
  fy_range: { start: string; end: string };
  total_co2e: number;
  scope1_co2e: number;
  scope2_co2e: number;
  prev_total_co2e: number;
  yoy_change_pct: number | null;
  total_employees: number;
  co2e_per_employee: number | null;
  total_sites: number;
  sites_with_data: number;
  completeness_pct: number;
  by_entity: EntityRow[];
  by_month: MonthRow[];
  meta: { generated_at: string; record_count: number };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const flagEmoji = (code: string) =>
  code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');

// ── Component ──────────────────────────────────────────────────────────────────

export default function ConsolidationPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [consolidationData, setConsolidationData] = useState<ConsolidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financialYear, setFinancialYear] = useState(currentYear);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Mount guard + initial load
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) setAccessToken(session.access_token);
      const enterprise = await isEnterpriseUser(user.id);
      if (!enterprise) {
        router.replace('/dashboard');
        return;
      }
      const orgs = await getUserOrgs(user.id);
      if (orgs.length === 0) {
        router.replace('/enterprise/onboarding');
        return;
      }
      setOrgId(orgs[0].id);
    }
    init();
  }, [router]);

  const fetchData = useCallback(
    async (oid: string, year: number) => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
        const res = await fetch(
          `/api/consolidation?org_id=${oid}&financial_year=${year}`,
          { credentials: 'include', headers }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setConsolidationData(data);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load consolidation data.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (orgId) fetchData(orgId, financialYear);
  }, [orgId, financialYear, fetchData, accessToken]);

  function toggleEntity(id: string) {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Inline SVG monthly chart ────────────────────────────────────────────────

  function MonthlyChart({ months }: { months: MonthRow[] }) {
    const W = 280;
    const H = 120;
    const PB = 28; // bottom padding for labels
    const PT = 8;  // top padding
    const chartH = H - PB - PT;

    if (months.length === 0) {
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={10} fill="#94a3b8">
            No data yet
          </text>
        </svg>
      );
    }

    const maxCo2e = Math.max(...months.map((m) => m.total_co2e), 0.01);
    const barW = Math.max(8, Math.floor((W - 20) / months.length) - 3);
    const gap = Math.floor((W - 20) / months.length);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden">
        {months.map((m, i) => {
          const x = 10 + i * gap;
          const totalH = (m.total_co2e / maxCo2e) * chartH;
          const s1H = (m.scope1_co2e / maxCo2e) * chartH;
          const s2H = (m.scope2_co2e / maxCo2e) * chartH;
          const barY = PT + chartH - totalH;

          return (
            <g key={m.month_key}>
              {/* scope1 bar (bottom portion) */}
              <rect
                x={x}
                y={PT + chartH - s1H}
                width={barW}
                height={s1H}
                fill="#1e293b"
                rx={1}
              />
              {/* scope2 bar (stacked above scope1) */}
              <rect
                x={x}
                y={barY}
                width={barW}
                height={s2H}
                fill="#10b981"
                rx={1}
              />
              {/* month label */}
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="end"
                fontSize={8}
                fill="#94a3b8"
                transform={`rotate(-45, ${x + barW / 2}, ${H - 4})`}
              >
                {m.month_label}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <rect x={10} y={2} width={8} height={5} fill="#1e293b" rx={1} />
        <text x={21} y={8} fontSize={7} fill="#64748b">Scope 1</text>
        <rect x={60} y={2} width={8} height={5} fill="#10b981" rx={1} />
        <text x={71} y={8} fontSize={7} fill="#64748b">Scope 2</text>
      </svg>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-xl bg-slate-200 h-28"
              />
            ))}
          </div>
          <div className="animate-pulse rounded-xl bg-slate-200 h-16" />
          <div className="animate-pulse rounded-xl bg-slate-200 h-64" />
        </div>
      </main>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  const d = consolidationData;
  if (!d) return null;

  const missingSites = d.by_entity
    .flatMap((e) => e.sites)
    .filter((s) => !s.has_data)
    .map((s) => s.site_name);

  const yoyDown = d.yoy_change_pct !== null && d.yoy_change_pct < 0;
  const yoyAbs =
    d.yoy_change_pct !== null
      ? Math.abs(d.total_co2e - d.prev_total_co2e).toFixed(2)
      : null;

  const barColor =
    d.completeness_pct >= 100
      ? 'bg-emerald-500'
      : d.completeness_pct >= 50
      ? 'bg-amber-400'
      : 'bg-rose-400';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <section className="relative rounded-xl border border-slate-200 shadow bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50 px-4 py-5 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Enterprise
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1">
              Group Consolidation
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rolled-up emissions across all entities and sites.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="rounded-full bg-white/70 border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700"
              value={financialYear}
              onChange={(e) => setFinancialYear(Number(e.target.value))}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
            <a
              href="/dashboard"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ← Dashboard
            </a>
          </div>
        </section>

        {/* ── KPI CARDS ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <article className="rounded-xl bg-white border p-5 shadow">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Group Total
            </p>
            <p className="text-2xl font-semibold text-slate-900 mt-2">
              {d.total_co2e.toFixed(2)}{' '}
              <span className="text-base font-normal text-slate-500">tCO₂e</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Scope 1 + 2 combined</p>
          </article>

          <article className="rounded-xl bg-white border p-5 shadow">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Scope 1
            </p>
            <p className="text-2xl font-semibold text-slate-900 mt-2">
              {d.scope1_co2e.toFixed(2)}{' '}
              <span className="text-base font-normal text-slate-500">tCO₂e</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Direct emissions</p>
          </article>

          <article className="rounded-xl bg-white border p-5 shadow">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Scope 2
            </p>
            <p className="text-2xl font-semibold text-slate-900 mt-2">
              {d.scope2_co2e.toFixed(2)}{' '}
              <span className="text-base font-normal text-slate-500">tCO₂e</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Purchased electricity</p>
          </article>

          <article className="rounded-xl bg-white border p-5 shadow">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Intensity
            </p>
            <p className="text-2xl font-semibold text-slate-900 mt-2">
              {d.co2e_per_employee !== null ? (
                <>
                  {d.co2e_per_employee.toFixed(2)}{' '}
                  <span className="text-base font-normal text-slate-500">tCO₂e/emp</span>
                </>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Per employee</p>
          </article>
        </section>

        {/* ── YOY BANNER ──────────────────────────────────────────────────── */}
        {d.prev_total_co2e > 0 && d.yoy_change_pct !== null && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow text-sm">
            <span
              className={`text-base font-bold ${
                yoyDown ? 'text-emerald-600' : 'text-rose-500'
              }`}
            >
              {yoyDown ? '▼' : '▲'}
            </span>
            <span className="text-slate-700">
              vs FY{financialYear - 1}:{' '}
              <span
                className={`font-semibold ${
                  yoyDown ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {yoyDown ? '−' : '+'}
                {yoyAbs} tCO₂e ({yoyDown ? '' : '+'}
                {d.yoy_change_pct.toFixed(1)}%)
              </span>
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              Prev: {d.prev_total_co2e.toFixed(2)} tCO₂e
            </span>
          </div>
        )}

        {/* ── TWO-COLUMN LAYOUT ───────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* LEFT SIDEBAR */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">

            {/* Completeness card */}
            <section className="rounded-xl bg-white border p-6 shadow">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Data coverage
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-2">
                {d.sites_with_data} of {d.total_sites} sites
              </p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] ${barColor}`}
                  style={{ width: `${d.completeness_pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {d.completeness_pct.toFixed(0)}% for FY{financialYear}
              </p>
            </section>

            {/* Monthly chart */}
            <section className="rounded-xl bg-white border p-6 shadow">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-4">
                Monthly trend
              </p>
              <MonthlyChart months={d.by_month} />
            </section>

          </aside>

          {/* RIGHT: MAIN CONTENT */}
          <div className="flex-1 space-y-4 w-full">

            {/* Missing data alert */}
            {d.completeness_pct < 100 && missingSites.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠ {d.total_sites - d.sites_with_data} site(s) have not submitted
                data for FY{financialYear}:{' '}
                <span className="font-medium">{missingSites.join(', ')}</span>.
              </div>
            )}

            {/* Entity breakdown */}
            <section className="rounded-xl bg-white border p-6 shadow">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-4">
                Entity breakdown
              </p>
              <div className="space-y-1">
                {d.by_entity.map((entity) => {
                  const expanded = expandedEntities.has(entity.entity_id);
                  return (
                    <div key={entity.entity_id}>
                      {/* Entity row */}
                      <button
                        type="button"
                        onClick={() => toggleEntity(entity.entity_id)}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-base flex-shrink-0">
                          {flagEmoji(entity.country_code)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {entity.entity_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            S1: {entity.scope1_co2e.toFixed(2)} · S2:{' '}
                            {entity.scope2_co2e.toFixed(2)} tCO₂e
                            {entity.co2e_per_employee !== null && (
                              <> · {entity.co2e_per_employee.toFixed(2)} t/emp</>
                            )}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">
                            {entity.total_co2e.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400">tCO₂e</p>
                        </div>
                        <span className="text-slate-400 text-xs ml-1">
                          {expanded ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Site rows (expanded) */}
                      {expanded && entity.sites.length > 0 && (
                        <div className="ml-8 mb-1 space-y-0.5">
                          {entity.sites.map((site) => (
                            <div
                              key={site.site_id}
                              className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">
                                  {site.site_name}
                                  {site.city && (
                                    <span className="font-normal text-slate-400">
                                      {' '}· {site.city}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {site.record_count} record{site.record_count !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {site.has_data ? (
                                  <>
                                    <p className="text-xs font-semibold text-slate-800 tabular-nums">
                                      {site.total_co2e.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-slate-400">tCO₂e</p>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-amber-500 font-medium">
                                    No data
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-xs flex-shrink-0 ${
                                  site.has_data ? 'text-emerald-500' : 'text-slate-300'
                                }`}
                              >
                                {site.has_data ? '✓' : '○'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {expanded && entity.sites.length === 0 && (
                        <p className="ml-8 text-[11px] text-slate-400 py-1 px-3">
                          No sites linked to this entity.
                        </p>
                      )}
                    </div>
                  );
                })}

                {d.by_entity.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    No entities found for this organisation.
                  </p>
                )}
              </div>
            </section>

          </div>
        </div>

        {/* Footer meta */}
        <p className="text-[10px] text-slate-400 text-right">
          Generated {new Date(d.meta.generated_at).toLocaleString('en-GB')} ·{' '}
          {d.meta.record_count} emission record{d.meta.record_count !== 1 ? 's' : ''} in FY{financialYear}
        </p>

      </div>
    </main>
  );
}