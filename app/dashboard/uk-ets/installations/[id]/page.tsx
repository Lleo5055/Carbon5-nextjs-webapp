'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const CURRENT_YEAR = new Date().getFullYear();

type Tab = 'overview' | 'emissions' | 'verification' | 'allowances';

type Installation = {
  id: string;
  installation_name: string;
  permit_number: string;
  activity_type: string;
  thermal_input_mw: number | null;
  address: string | null;
  postcode: string | null;
  monitoring_methodology: string | null;
  monitoring_plan_version: string | null;
  monitoring_plan_approved_date: string | null;
  operator_holding_account: string | null;
  is_active: boolean;
  created_at: string;
};

type VerificationStatus = 'draft' | 'submitted' | 'under_review' | 'verified' | 'approved' | 'surrendered';

type Verification = {
  id: string;
  installation_id: string;
  reporting_year: number;
  status: VerificationStatus;
  verifier_name: string | null;
  verifier_accreditation: string | null;
  verification_body: string | null;
  verification_opinion: string | null;
  material_misstatements: boolean | null;
  findings: string | null;
  verified_emissions: number | null;
  free_allocation: number | null;
  purchased_allowances: number | null;
  surrendered_allowances: number | null;
  surrender_deadline: string | null;
  surrender_status: string | null;
  submitted_at: string | null;
  verified_at: string | null;
};

type EmissionRow = {
  id: string;
  month: string;
  electricity_kw: number | null;
  diesel_litres: number | null;
  petrol_litres: number | null;
  gas_kwh: number | null;
  lpg_kg: number | null;
  cng_kg: number | null;
  refrigerant_kg: number | null;
  total_co2e: number | null;
};

type VerFormState = {
  status: VerificationStatus;
  verifier_name: string;
  verifier_accreditation: string;
  verification_body: string;
  verification_opinion: string;
  material_misstatements: boolean;
  findings: string;
  verified_emissions: string;
  free_allocation: string;
  purchased_allowances: string;
  surrendered_allowances: string;
  surrender_deadline: string;
  surrender_status: string;
  submitted_at: string;
  verified_at: string;
};

const STATUS_STEPS: VerificationStatus[] = ['draft', 'submitted', 'under_review', 'verified', 'approved', 'surrendered'];

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200' },
  submitted:    { label: 'Submitted',    color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  under_review: { label: 'Under review', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  verified:     { label: 'Verified',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  approved:     { label: 'Approved',     color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  surrendered:  { label: 'Surrendered',  color: 'text-slate-700',   bg: 'bg-slate-100',  border: 'border-slate-300' },
};

const EMPTY_VER_FORM: VerFormState = {
  status: 'draft',
  verifier_name: '',
  verifier_accreditation: '',
  verification_body: '',
  verification_opinion: '',
  material_misstatements: false,
  findings: '',
  verified_emissions: '',
  free_allocation: '',
  purchased_allowances: '',
  surrendered_allowances: '',
  surrender_deadline: '',
  surrender_status: '',
  submitted_at: '',
  verified_at: '',
};

function verToForm(v: Verification): VerFormState {
  return {
    status: v.status,
    verifier_name: v.verifier_name ?? '',
    verifier_accreditation: v.verifier_accreditation ?? '',
    verification_body: v.verification_body ?? '',
    verification_opinion: v.verification_opinion ?? '',
    material_misstatements: v.material_misstatements ?? false,
    findings: v.findings ?? '',
    verified_emissions: v.verified_emissions != null ? String(v.verified_emissions) : '',
    free_allocation: v.free_allocation != null ? String(v.free_allocation) : '',
    purchased_allowances: v.purchased_allowances != null ? String(v.purchased_allowances) : '',
    surrendered_allowances: v.surrendered_allowances != null ? String(v.surrendered_allowances) : '',
    surrender_deadline: v.surrender_deadline ?? '',
    surrender_status: v.surrender_status ?? '',
    submitted_at: v.submitted_at ? v.submitted_at.slice(0, 10) : '',
    verified_at: v.verified_at ? v.verified_at.slice(0, 10) : '',
  };
}

export default function InstallationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [emissions, setEmissions] = useState<EmissionRow[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  // Verification form state
  const [verForm, setVerForm] = useState<VerFormState>(EMPTY_VER_FORM);
  const [savingVer, setSavingVer] = useState(false);
  const [savedVer, setSavedVer] = useState(false);
  const [verError, setVerError] = useState<string | null>(null);

  // Download state
  const [downloadingReport, setDownloadingReport] = useState<'pdf' | 'csv' | 'json' | null>(null);

  const currentVer = verifications.find(v => v.reporting_year === selectedYear) ?? null;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'GB') { router.push('/dashboard'); return; }

      const { data: inst, error: instErr } = await supabase
        .from('uk_ets_installations')
        .select('*')
        .eq('id', id)
        .eq('profile_id', user.id)
        .single();

      if (instErr || !inst) { router.push('/dashboard/uk-ets/installations'); return; }
      setInstallation(inst);

      const { data: vers } = await supabase
        .from('uk_ets_verifications')
        .select('*')
        .eq('installation_id', id)
        .order('reporting_year', { ascending: false });

      const verList = vers ?? [];
      setVerifications(verList);

      const existingVer = verList.find(v => v.reporting_year === CURRENT_YEAR);
      setVerForm(existingVer ? verToForm(existingVer) : EMPTY_VER_FORM);

      const { data: emData } = await supabase
        .from('emissions')
        .select('id, month, electricity_kw, diesel_litres, petrol_litres, gas_kwh, lpg_kg, cng_kg, refrigerant_kg, total_co2e')
        .eq('user_id', user.id)
        .like('month', `${CURRENT_YEAR}-%`)
        .order('month', { ascending: true });

      setEmissions(emData ?? []);
      setLoading(false);
    }
    load();
  }, [id, router]);

  // When selected year changes, update emissions and ver form
  useEffect(() => {
    if (loading) return;
    const ver = verifications.find(v => v.reporting_year === selectedYear);
    setVerForm(ver ? verToForm(ver) : EMPTY_VER_FORM);

    async function reloadEmissions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('emissions')
        .select('id, month, electricity_kw, diesel_litres, petrol_litres, gas_kwh, lpg_kg, cng_kg, refrigerant_kg, total_co2e')
        .eq('user_id', user.id)
        .like('month', `${selectedYear}-%`)
        .order('month', { ascending: true });
      setEmissions(data ?? []);
    }
    reloadEmissions();
  }, [selectedYear, verifications, loading]);

  function updateVer(key: keyof VerFormState, value: string | boolean) {
    setVerForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveVerification(e: React.FormEvent) {
    e.preventDefault();
    setSavingVer(true);
    setVerError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingVer(false); return; }

    const payload = {
      installation_id: id,
      reporting_year: selectedYear,
      status: verForm.status,
      verifier_name: verForm.verifier_name.trim() || null,
      verifier_accreditation: verForm.verifier_accreditation.trim() || null,
      verification_body: verForm.verification_body.trim() || null,
      verification_opinion: verForm.verification_opinion.trim() || null,
      material_misstatements: verForm.material_misstatements,
      findings: verForm.findings.trim() || null,
      verified_emissions: verForm.verified_emissions ? Number(verForm.verified_emissions) : null,
      free_allocation: verForm.free_allocation ? Number(verForm.free_allocation) : null,
      purchased_allowances: verForm.purchased_allowances ? Number(verForm.purchased_allowances) : null,
      surrendered_allowances: verForm.surrendered_allowances ? Number(verForm.surrendered_allowances) : null,
      surrender_deadline: verForm.surrender_deadline || null,
      surrender_status: verForm.surrender_status.trim() || null,
      submitted_at: verForm.submitted_at || null,
      verified_at: verForm.verified_at || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('uk_ets_verifications')
      .upsert(payload, { onConflict: 'installation_id,reporting_year' });

    if (error) {
      setVerError(error.message);
      setSavingVer(false);
      return;
    }

    // Refresh verifications
    const { data: vers } = await supabase
      .from('uk_ets_verifications')
      .select('*')
      .eq('installation_id', id)
      .order('reporting_year', { ascending: false });
    setVerifications(vers ?? []);

    setSavingVer(false);
    setSavedVer(true);
    setTimeout(() => setSavedVer(false), 3000);
  }

  const FINAL_STATUSES: VerificationStatus[] = ['verified', 'approved', 'surrendered'];

  async function handleDownloadReport(format: 'pdf' | 'csv' | 'json') {
    if (!FINAL_STATUSES.includes(verForm.status)) {
      const label = STATUS_CONFIG[verForm.status].label;
      alert(`Verification is currently "${label}".\n\nThe report can only be downloaded once the status is Verified, Approved, or Surrendered. Please complete and save the verification record above first.`);
      return;
    }
    setDownloadingReport(format);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = `/api/uk-ets-verification?userId=${session.user.id}&token=${session.access_token}&installationId=${id}&year=${selectedYear}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) { alert('Failed to generate report.'); return; }
      const blob = await res.blob();
      const ext = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'json';
      const permit = installation?.permit_number?.replace(/\s+/g, '-') ?? 'installation';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `uk-ets-verification-${permit}-${selectedYear}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingReport(null);
    }
  }

  if (loading || !installation) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </main>
    );
  }

  const totalEmissions = emissions.reduce((s, r) => s + (r.total_co2e ?? 0), 0);
  const ver = currentVer;
  const freeAlloc = ver?.free_allocation ?? 0;
  const purchased = ver?.purchased_allowances ?? 0;
  const surrendered = ver?.surrendered_allowances ?? 0;
  const verifiedEm = ver?.verified_emissions ?? 0;
  const position = freeAlloc + purchased - surrendered;
  const shortfall = position < 0 ? Math.abs(position) : 0;
  const penaltyRisk = shortfall * 100;

  const availableYears = Array.from(new Set([CURRENT_YEAR, ...verifications.map(v => v.reporting_year)])).sort((a, b) => b - a);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'emissions', label: 'Emissions' },
    { key: 'verification', label: 'Verification' },
    { key: 'allowances', label: 'Allowances' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/uk-ets/installations" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              ← Installations
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {savedVer && <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs bg-white text-slate-700 font-medium"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">UK ETS</span>
            {!installation.is_active && (
              <span className="text-[9px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-medium">Inactive</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{installation.installation_name}</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">{installation.permit_number}</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Activity</p>
            <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{installation.activity_type.replace(/_/g, ' ')}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Emissions {selectedYear}</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {totalEmissions > 0 ? `${totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e` : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Allowance position</p>
            <p className={`text-sm font-semibold mt-1 ${position >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {ver ? `${position >= 0 ? '+' : ''}${position.toLocaleString()} UKAs` : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Verification {selectedYear}</p>
            <div className="mt-1">
              {ver ? (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[ver.status].color} ${STATUS_CONFIG[ver.status].bg} ${STATUS_CONFIG[ver.status].border}`}>
                  {STATUS_CONFIG[ver.status].label}
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-slate-600 bg-slate-100 border-slate-200">Draft</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <section className="rounded-xl bg-white border border-slate-200 shadow divide-y divide-slate-100">
            <div className="px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Installation details</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Installation name</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{installation.installation_name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Permit number</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5 font-mono">{installation.permit_number}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Activity type</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{installation.activity_type.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Thermal input</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{installation.thermal_input_mw != null ? `${installation.thermal_input_mw} MW` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Monitoring methodology</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{installation.monitoring_methodology ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Monitoring plan version</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{installation.monitoring_plan_version ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Plan approved date</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">
                    {installation.monitoring_plan_approved_date
                      ? new Date(installation.monitoring_plan_approved_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Operator holding account</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5 font-mono">{installation.operator_holding_account ?? '—'}</dd>
                </div>
                {installation.address && (
                  <div className="md:col-span-2">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">Address</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{installation.address}{installation.postcode ? `, ${installation.postcode}` : ''}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="px-5 py-3 flex items-center gap-2">
              <Link href="/dashboard/uk-ets/installations" className="text-xs text-blue-600 hover:underline underline-offset-2">Edit installation →</Link>
            </div>
          </section>
        )}

        {/* Tab: Emissions */}
        {tab === 'emissions' && (
          <section className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <p>Emissions below are pulled from your main emissions log. To add or edit entries, use the <Link href="/dashboard/emissions" className="underline underline-offset-2 font-medium">Emissions dashboard</Link>.</p>
            </div>

            {emissions.length === 0 ? (
              <div className="rounded-xl bg-white border p-8 text-center shadow">
                <p className="text-sm font-medium text-slate-800">No emissions logged for {selectedYear}.</p>
                <p className="text-xs text-slate-500 mt-1">Add entries in the emissions dashboard and they will appear here.</p>
                <Link href="/dashboard/emissions" className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800">
                  Go to emissions →
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-white border border-slate-200 shadow overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3 text-left font-medium text-slate-500">Month</th>
                      <th className="p-3 text-right font-medium text-slate-500">Electricity (kWh)</th>
                      <th className="p-3 text-right font-medium text-slate-500">Diesel (L)</th>
                      <th className="p-3 text-right font-medium text-slate-500">Gas (kWh)</th>
                      <th className="p-3 text-right font-medium text-slate-500">tCO₂e</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emissions.map(row => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="p-3 font-medium text-slate-700 tabular-nums">
                          {new Date(row.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-3 text-right tabular-nums text-slate-600">{row.electricity_kw != null ? row.electricity_kw.toLocaleString() : '—'}</td>
                        <td className="p-3 text-right tabular-nums text-slate-600">{row.diesel_litres != null ? row.diesel_litres.toLocaleString() : '—'}</td>
                        <td className="p-3 text-right tabular-nums text-slate-600">{row.gas_kwh != null ? row.gas_kwh.toLocaleString() : '—'}</td>
                        <td className="p-3 text-right tabular-nums font-semibold text-slate-900">{row.total_co2e != null ? row.total_co2e.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={4} className="p-3 text-xs font-semibold text-slate-700">Total {selectedYear}</td>
                      <td className="p-3 text-right tabular-nums font-bold text-slate-900">{totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab: Verification */}
        {tab === 'verification' && (
          <section className="space-y-4">
            {/* Status stepper */}
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Verification status — {selectedYear}</h2>
              <div className="flex items-center gap-1 flex-wrap">
                {STATUS_STEPS.map((s, i) => {
                  const cfg = STATUS_CONFIG[s];
                  const currentIdx = STATUS_STEPS.indexOf(verForm.status);
                  const isActive = s === verForm.status;
                  const isPast = i < currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        isActive
                          ? `${cfg.color} ${cfg.bg} ${cfg.border}`
                          : isPast
                            ? 'text-slate-400 bg-slate-50 border-slate-200'
                            : 'text-slate-300 bg-white border-slate-100'
                      }`}>
                        {cfg.label}
                      </span>
                      {i < STATUS_STEPS.length - 1 && <span className="text-slate-300 text-[10px]">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verification form */}
            <form onSubmit={handleSaveVerification} className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-5">
              <h2 className="text-sm font-semibold text-slate-900">Verification record — {selectedYear}</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Status</label>
                  <select value={verForm.status} onChange={e => updateVer('status', e.target.value as VerificationStatus)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                    {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Verification body</label>
                  <input type="text" value={verForm.verification_body} onChange={e => updateVer('verification_body', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="e.g. Bureau Veritas" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Lead verifier name</label>
                  <input type="text" value={verForm.verifier_name} onChange={e => updateVer('verifier_name', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Verifier accreditation no.</label>
                  <input type="text" value={verForm.verifier_accreditation} onChange={e => updateVer('verifier_accreditation', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono" placeholder="e.g. UKAS 12345" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Submitted at</label>
                  <input type="date" value={verForm.submitted_at} onChange={e => updateVer('submitted_at', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Verified at</label>
                  <input type="date" value={verForm.verified_at} onChange={e => updateVer('verified_at', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Verification opinion</label>
                <select value={verForm.verification_opinion} onChange={e => updateVer('verification_opinion', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                  <option value="">Select opinion…</option>
                  <option value="reasonable_assurance">Reasonable assurance</option>
                  <option value="limited_assurance">Limited assurance</option>
                  <option value="adverse">Adverse opinion</option>
                  <option value="disclaimed">Disclaimed opinion</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="material_misstatements"
                  checked={verForm.material_misstatements}
                  onChange={e => updateVer('material_misstatements', e.target.checked)}
                  className="accent-rose-600"
                />
                <label htmlFor="material_misstatements" className="text-xs font-medium text-slate-700 cursor-pointer">Material misstatements identified</label>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Findings / notes</label>
                <textarea rows={3} value={verForm.findings} onChange={e => updateVer('findings', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="Summarise key findings from the verification report…" />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-3">Emissions &amp; allowances</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Verified emissions (tCO₂e)</label>
                    <input type="number" step="0.001" min="0" value={verForm.verified_emissions} onChange={e => updateVer('verified_emissions', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Free allocation (UKAs)</label>
                    <input type="number" step="1" min="0" value={verForm.free_allocation} onChange={e => updateVer('free_allocation', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Purchased allowances (UKAs)</label>
                    <input type="number" step="1" min="0" value={verForm.purchased_allowances} onChange={e => updateVer('purchased_allowances', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Surrendered allowances (UKAs)</label>
                    <input type="number" step="1" min="0" value={verForm.surrendered_allowances} onChange={e => updateVer('surrendered_allowances', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Surrender deadline</label>
                    <input type="date" value={verForm.surrender_deadline} onChange={e => updateVer('surrender_deadline', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Surrender status</label>
                    <select value={verForm.surrender_status} onChange={e => updateVer('surrender_status', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                      <option value="">Select…</option>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="complete">Complete</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              </div>

              {verError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{verError}</p>}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button type="submit" disabled={savingVer} className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                  {savingVer ? 'Saving…' : 'Save verification record'}
                </button>
                {savedVer && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
              </div>
            </form>

            {/* Download verification report */}
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Download verification report</h3>
              {!FINAL_STATUSES.includes(verForm.status) ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  Set the status to <strong>Verified</strong>, <strong>Approved</strong>, or <strong>Surrendered</strong> and save the record before downloading.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">Export this installation&apos;s verification record for {selectedYear}.</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleDownloadReport('pdf')}
                      disabled={downloadingReport !== null}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      {downloadingReport === 'pdf' ? 'Generating…' : '↓ PDF'}
                    </button>
                    <button
                      onClick={() => handleDownloadReport('csv')}
                      disabled={downloadingReport !== null}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {downloadingReport === 'csv' ? 'Generating…' : '↓ CSV'}
                    </button>
                    <button
                      onClick={() => handleDownloadReport('json')}
                      disabled={downloadingReport !== null}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {downloadingReport === 'json' ? 'Generating…' : '↓ JSON'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Tab: Allowances */}
        {tab === 'allowances' && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Free allocation</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{freeAlloc.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">UKAs granted free</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Purchased allowances</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{purchased.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">UKAs bought on market</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Surrendered</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{surrendered.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">UKAs already surrendered</p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Position summary — {selectedYear}</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Verified emissions</span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{verifiedEm > 0 ? `${verifiedEm.toLocaleString()} tCO₂e` : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Total allowances (free + purchased)</span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{(freeAlloc + purchased).toLocaleString()} UKAs</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600">Surrendered</span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{surrendered.toLocaleString()} UKAs</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-semibold text-slate-800">Net position</span>
                  <span className={`text-lg font-bold tabular-nums ${position >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {position >= 0 ? '+' : ''}{position.toLocaleString()} UKAs
                  </span>
                </div>
              </div>

              {position < 0 && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-rose-800">Shortfall — penalty risk</p>
                  <p className="text-xs text-rose-700">
                    {Math.abs(position).toLocaleString()} UKA shortfall × £100/tonne = <strong>£{penaltyRisk.toLocaleString()}</strong> penalty exposure
                  </p>
                  <p className="text-[10px] text-rose-600 mt-1">Purchase additional allowances before the surrender deadline to avoid the penalty.</p>
                </div>
              )}

              {position >= 0 && ver && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-800">Surplus — no penalty risk</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {position.toLocaleString()} surplus UKAs can be banked for future years or sold on the secondary market.
                  </p>
                </div>
              )}

              {!ver && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-600">No verification record for {selectedYear}. Add data in the <button type="button" onClick={() => setTab('verification')} className="underline underline-offset-2 font-medium">Verification tab</button>.</p>
                </div>
              )}
            </div>

            {/* Surrender timeline */}
            {ver?.surrender_deadline && (
              <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Surrender deadline</h2>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {new Date(ver.surrender_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {ver.surrender_status && (
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{ver.surrender_status}</p>
                    )}
                  </div>
                  {ver.surrender_status === 'complete' && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">Surrendered ✓</span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}