'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const SECTORS = [
  { value: 'cement', label: 'Cement', product: 'Cement', unit: 'tonnes' },
  { value: 'iron_steel', label: 'Iron & Steel', product: 'Crude Steel', unit: 'tonnes' },
  { value: 'pulp_paper', label: 'Pulp & Paper', product: 'Paper', unit: 'tonnes' },
  { value: 'petrochemicals', label: 'Petrochemicals', product: 'Olefin', unit: 'tonnes' },
  { value: 'aluminium', label: 'Aluminium', product: 'Aluminium', unit: 'tonnes' },
  { value: 'chlor_alkali', label: 'Chlor-Alkali', product: 'Chlorine', unit: 'tonnes' },
  { value: 'fertilizer', label: 'Fertilizer', product: 'Fertilizer', unit: 'tonnes' },
  { value: 'petroleum_refining', label: 'Petroleum Refining', product: 'Refinery Output', unit: 'tonnes' },
  { value: 'textiles', label: 'Textiles', product: 'Fabric/Yarn', unit: 'tonnes' },
  { value: 'other', label: 'Other', product: 'Output', unit: 'tonnes' },
];

const SUB_SECTORS: Record<string, string[]> = {
  iron_steel: ['Integrated Steel', 'Sponge Iron'],
  aluminium: ['Refinery/Smelter', 'Cold Rolling Sheet'],
  textiles: ['Composite', 'Fiber', 'Spinning', 'Processing'],
};

const CURRENT_YEAR = new Date().getFullYear();
const COMPLIANCE_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

type OrgTarget = {
  id: string;
  compliance_year: number;
  trajectory_period: string;
  sector: string;
  sub_sector: string | null;
  target_gei: number;
  equivalent_product: string;
  equivalent_product_unit: string;
  baseline_gei: number | null;
  baseline_year: string;
  baseline_ef_electricity: number | null;
  bee_notification_ref: string | null;
  notified_date: string | null;
  declaration_confirmed: boolean;
  declaration_timestamp: string | null;
};

type SubmissionStatus = 'draft' | 'ready' | 'submitted' | 'under_review' | 'verified' | 'rejected';

type CCTSSubmission = {
  id: string;
  compliance_year: number;
  status: SubmissionStatus;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  acva_name: string | null;
  acva_ref: string | null;
  notes: string | null;
};

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',               color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  ready:        { label: 'Ready to submit',      color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  submitted:    { label: 'Submitted to ACVA',    color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200' },
  under_review: { label: 'Under review',         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  verified:     { label: 'Verified',             color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  rejected:     { label: 'Rejected',             color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200' },
};

const STATUS_FLOW: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft:        ['ready'],
  ready:        ['submitted', 'draft'],
  submitted:    ['under_review'],
  under_review: ['verified', 'rejected'],
  verified:     [],
  rejected:     ['draft'],
};

type EmissionSummary = {
  year: number;
  total_co2e_kg: number;
  total_product_output: number;
  actual_gei: number | null;
  months: {
    month: string;
    month_key: string;
    total_co2e_kg: number;
    product_output: number;
    emission_intensity: number | null;
    has_emissions: boolean;
    has_output: boolean;
  }[];
};

type FormState = {
  sector: string;
  sub_sector: string;
  compliance_year: string;
  trajectory_period: string;
  target_gei: string;
  equivalent_product: string;
  equivalent_product_unit: string;
  baseline_gei: string;
  baseline_ef_electricity: string;
  bee_notification_ref: string;
  notified_date: string;
  declaration_confirmed: boolean;
};

const EMPTY_FORM: FormState = {
  sector: '',
  sub_sector: '',
  compliance_year: String(CURRENT_YEAR),
  trajectory_period: `${CURRENT_YEAR}-${CURRENT_YEAR + 2}`,
  target_gei: '',
  equivalent_product: '',
  equivalent_product_unit: 'tonnes',
  baseline_gei: '',
  baseline_ef_electricity: '0.82',
  bee_notification_ref: '',
  notified_date: '',
  declaration_confirmed: false,
};

export default function CCTSDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<OrgTarget[]>([]);
  const [emissionSummaries, setEmissionSummaries] = useState<EmissionSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [productionEntries, setProductionEntries] = useState<{
    id: string;
    month: string;
    month_key: string;
    quantity: number;
    unit: string;
  }[]>([]);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingProdQty, setEditingProdQty] = useState<string>('');
  const [editingProdUnit, setEditingProdUnit] = useState<string>('tonnes');
  const [deletingProdId, setDeletingProdId] = useState<string | null>(null);
  const [prodSaving, setProdSaving] = useState(false);
  const [submissions, setSubmissions] = useState<CCTSSubmission[]>([]);
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
  const [submissionForm, setSubmissionForm] = useState<{
    acva_name: string;
    acva_ref: string;
    notes: string;
    rejection_reason: string;
  }>({ acva_name: '', acva_ref: '', notes: '', rejection_reason: '' });
  const [submissionSaving, setSubmissionSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN') {
        router.push('/dashboard');
        return;
      }

      const [{ data: targetsData }, { data: emissionsData }, { data: productionData }, { data: submissionsData }] = await Promise.all([
        supabase.from('org_targets').select('*').eq('user_id', user.id).order('compliance_year', { ascending: true }),
        supabase.from('emissions').select('month, month_key, total_co2e').eq('user_id', user.id),
        supabase.from('production_entries').select('id, month, month_key, quantity, unit').eq('user_id', user.id),
        supabase.from('ccts_submissions').select('*').eq('user_id', user.id).order('compliance_year', { ascending: true }),
      ]);

      setSubmissions(submissionsData ?? []);

      setTargets(targetsData ?? []);

      // Build month_key (YYYY-MM) → production quantity lookup
      const prodByMonthKey = new Map<string, { quantity: number; month: string }>();
      for (const p of productionData ?? []) {
        const mk = (p.month_key as string | null)?.slice(0, 7) ?? '';
        if (!mk) continue;
        const existing = prodByMonthKey.get(mk);
        prodByMonthKey.set(mk, {
          quantity: (existing?.quantity ?? 0) + (Number(p.quantity) || 0),
          month: p.month ?? mk,
        });
      }

      // Helper: get Indian FY year from a month_key date
      const getFYYear = (mk: string) => {
        const d = new Date(mk);
        const calYear = d.getFullYear();
        const month = d.getMonth() + 1;
        return month >= 4 ? calYear + 1 : calYear;
      };

      // Collect all unique YYYY-MM keys from both emissions and production
      const allMonthKeys = new Set<string>();
      for (const row of emissionsData ?? []) {
        const mk = (row.month_key as string | null)?.slice(0, 7);
        if (mk) allMonthKeys.add(mk);
      }
      Array.from(prodByMonthKey.keys()).forEach(mk => allMonthKeys.add(mk));

      // Build emission lookup by month_key
      const emissionByMonthKey = new Map<string, { total_co2e: number; month: string }>();
      for (const row of emissionsData ?? []) {
        const mk = (row.month_key as string | null)?.slice(0, 7);
        if (!mk) continue;
        const existing = emissionByMonthKey.get(mk);
        emissionByMonthKey.set(mk, {
          total_co2e: (existing?.total_co2e ?? 0) + (Number(row.total_co2e) || 0),
          month: row.month ?? mk,
        });
      }

      // Aggregate by FY year across all months (emissions + production)
      const byYear = new Map<number, {
        co2e: number;
        output: number;
        months: Map<string, {
          month: string;
          month_key: string;
          total_co2e_kg: number;
          product_output: number;
          has_emissions: boolean;
          has_output: boolean;
        }>;
      }>();

      for (const mk of Array.from(allMonthKeys)) {
        const fyYear = getFYYear(mk + '-01');
        const emissionEntry = emissionByMonthKey.get(mk);
        const prodEntry = prodByMonthKey.get(mk);

        const co2e = emissionEntry?.total_co2e ?? 0;
        const output = prodEntry?.quantity ?? 0;
        const monthLabel = emissionEntry?.month ?? prodEntry?.month ?? mk;

        const existing = byYear.get(fyYear) ?? { co2e: 0, output: 0, months: new Map() };
        existing.co2e += co2e;
        existing.output += output;
        existing.months.set(mk, {
          month: monthLabel,
          month_key: mk,
          total_co2e_kg: co2e,
          product_output: output,
          has_emissions: !!emissionEntry,
          has_output: !!prodEntry,
        });
        byYear.set(fyYear, existing);
      }

      const summaries: EmissionSummary[] = Array.from(byYear.entries()).map(([year, { co2e, output, months }]) => ({
        year,
        total_co2e_kg: co2e,
        total_product_output: output,
        actual_gei: output > 0 ? (co2e / 1000) / output : null,
        months: Array.from(months.values())
          .map(m => ({
            ...m,
            emission_intensity: m.product_output > 0 && m.total_co2e_kg > 0
              ? (m.total_co2e_kg / 1000) / m.product_output
              : null,
          }))
          .sort((a, b) => a.month_key.localeCompare(b.month_key)),
      }));

      setEmissionSummaries(summaries);
      setProductionEntries(
        (productionData ?? [])
          .map(p => ({
            id: p.id,
            month: p.month ?? '',
            month_key: (p.month_key as string ?? '').slice(0, 7),
            quantity: Number(p.quantity) || 0,
            unit: p.unit ?? 'tonnes',
          }))
          .sort((a, b) => a.month_key.localeCompare(b.month_key))
      );
      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: keyof FormState, value: string | boolean) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'sector') {
        const sector = SECTORS.find(s => s.value === value);
        next.equivalent_product = sector?.product ?? '';
        next.equivalent_product_unit = sector?.unit ?? 'tonnes';
        next.sub_sector = '';
      }
      if (key === 'compliance_year') {
        const y = Number(value);
        next.trajectory_period = `${y}-${y + 2}`;
      }
      return next;
    });
  }

  function startAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(target: OrgTarget) {
    setForm({
      sector: target.sector,
      sub_sector: target.sub_sector ?? '',
      compliance_year: String(target.compliance_year),
      trajectory_period: target.trajectory_period,
      target_gei: String(target.target_gei),
      equivalent_product: target.equivalent_product,
      equivalent_product_unit: target.equivalent_product_unit,
      baseline_gei: target.baseline_gei != null ? String(target.baseline_gei) : '',
      baseline_ef_electricity: target.baseline_ef_electricity != null ? String(target.baseline_ef_electricity) : '0.82',
      bee_notification_ref: target.bee_notification_ref ?? '',
      notified_date: target.notified_date ?? '',
      declaration_confirmed: target.declaration_confirmed,
    });
    setEditingId(target.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.declaration_confirmed) {
      setError('Please confirm the declaration before saving.');
      return;
    }
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      sector: form.sector,
      sub_sector: form.sub_sector || null,
      compliance_year: Number(form.compliance_year),
      trajectory_period: form.trajectory_period,
      target_gei: Number(form.target_gei),
      equivalent_product: form.equivalent_product,
      equivalent_product_unit: form.equivalent_product_unit,
      baseline_gei: form.baseline_gei ? Number(form.baseline_gei) : null,
      baseline_year: '2023-24',
      baseline_ef_electricity: form.baseline_ef_electricity ? Number(form.baseline_ef_electricity) : null,
      bee_notification_ref: form.bee_notification_ref || null,
      notified_date: form.notified_date || null,
      declaration_confirmed: form.declaration_confirmed,
      declaration_timestamp: form.declaration_confirmed ? new Date().toISOString() : null,
      declaration_user_id: form.declaration_confirmed ? user.id : null,
    };

    let err = null;
    if (editingId) {
      const { error: e } = await supabase.from('org_targets').update(payload).eq('id', editingId);
      err = e;
    } else {
      const { error: e } = await supabase.from('org_targets').upsert(payload, { onConflict: 'user_id,compliance_year' });
      err = e;
    }

    setSaving(false);
    if (err) { setError(err.message); return; }

    // Refresh targets
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data } = await supabase.from('org_targets').select('*').eq('user_id', u.id).order('compliance_year', { ascending: true });
      setTargets(data ?? []);
    }

    setSaved(true);
    setShowForm(false);
    setEditingId(null);
    setTimeout(() => setSaved(false), 3000);
  }

  function getActualForYear(year: number) {
    return emissionSummaries.find(s => s.year === year) ?? null;
  }

  function getCCCPosition(target: OrgTarget) {
    const actual = getActualForYear(target.compliance_year);
    if (!actual || actual.actual_gei === null || actual.total_product_output === 0) return null;
    const diff = target.target_gei - actual.actual_gei;
    const ccc = diff * actual.total_product_output;
    return { diff, ccc, surplus: ccc > 0 };
  }

  async function handleProdSave(id: string) {
    setProdSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = productionEntries.find(p => p.id === id);

    const { error } = await supabase
      .from('production_entries')
      .update({ quantity: Number(editingProdQty), unit: editingProdUnit, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) { setProdSaving(false); alert(error.message); return; }

    // Audit trail
    await supabase.from('edit_history').insert({
      user_id: user.id,
      month: existing?.month ?? '',
      entity: 'production_entry',
      entity_id: id,
      action: 'edit',
      before: existing ? { quantity: existing.quantity, unit: existing.unit } : null,
      after: { quantity: Number(editingProdQty), unit: editingProdUnit },
    });

    setProdSaving(false);
    setProductionEntries(prev => prev.map(p => p.id === id ? { ...p, quantity: Number(editingProdQty), unit: editingProdUnit } : p));
    setEditingProdId(null);
    window.location.reload();
  }

  async function handleProdDelete(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = productionEntries.find(p => p.id === id);

    const { error } = await supabase.from('production_entries').delete().eq('id', id);
    if (error) { alert(error.message); return; }

    // Audit trail
    await supabase.from('edit_history').insert({
      user_id: user.id,
      month: existing?.month ?? '',
      entity: 'production_entry',
      entity_id: id,
      action: 'delete',
      before: existing ? { quantity: existing.quantity, unit: existing.unit } : null,
      after: null,
    });

    setProductionEntries(prev => prev.filter(p => p.id !== id));
    setDeletingProdId(null);
    window.location.reload();
  }

  async function handleSubmissionUpsert(complianceYear: number, newStatus: SubmissionStatus) {
    setSubmissionSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = submissions.find(s => s.compliance_year === complianceYear);

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      compliance_year: complianceYear,
      status: newStatus,
      acva_name: submissionForm.acva_name || existing?.acva_name || null,
      acva_ref: submissionForm.acva_ref || existing?.acva_ref || null,
      notes: submissionForm.notes || existing?.notes || null,
      rejection_reason: newStatus === 'rejected' ? submissionForm.rejection_reason || null : existing?.rejection_reason || null,
      submitted_at: newStatus === 'submitted' ? now : existing?.submitted_at ?? null,
      verified_at: newStatus === 'verified' ? now : existing?.verified_at ?? null,
      rejected_at: newStatus === 'rejected' ? now : existing?.rejected_at ?? null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('ccts_submissions')
      .upsert(payload, { onConflict: 'user_id,compliance_year' })
      .select()
      .single();

    setSubmissionSaving(false);
    if (error) { alert(error.message); return; }

    setSubmissions(prev => {
      const filtered = prev.filter(s => s.compliance_year !== complianceYear);
      return [...filtered, data].sort((a, b) => a.compliance_year - b.compliance_year);
    });
    setSubmissionForm({ acva_name: '', acva_ref: '', notes: '', rejection_reason: '' });
    setExpandedSubmission(null);
  }

  function getReadinessChecks(complianceYear: number) {
    const target = targets.find(t => t.compliance_year === complianceYear);
    const actual = getActualForYear(complianceYear);
    const fyStart = `${complianceYear - 1}-04`;
    const fyEnd = `${complianceYear}-03`;

    const fyEmissionMonths = actual?.months.filter(m => {
      return m.month_key >= fyStart && m.month_key <= fyEnd && m.has_emissions;
    }) ?? [];

    const totalEmissionMonths = fyEmissionMonths.length;
    const hasProductionOutput = (actual?.total_product_output ?? 0) > 0;
    const hasTarget = !!target;
    const hasBaselineGEI = !!target?.baseline_gei;
    const hasBaselineEF = !!target?.baseline_ef_electricity;
    const hasBEERef = !!target?.bee_notification_ref;
    const declarationConfirmed = !!target?.declaration_confirmed;
    const hasEmissions = totalEmissionMonths > 0;

    return [
      {
        label: 'Compliance target set',
        description: 'Sector, target GEI and equivalent product configured',
        passed: hasTarget,
      },
      {
        label: 'Declaration confirmed',
        description: 'Director declaration signed in target settings',
        passed: declarationConfirmed,
      },
      {
        label: 'Emissions logged',
        description: `${totalEmissionMonths} month${totalEmissionMonths !== 1 ? 's' : ''} of emission data recorded for FY ${complianceYear}`,
        passed: hasEmissions,
      },
      {
        label: 'Production output logged',
        description: `${actual?.total_product_output?.toLocaleString() ?? 0} ${target?.equivalent_product_unit ?? 'tonnes'} total output recorded`,
        passed: hasProductionOutput,
      },
      {
        label: 'Baseline GEI recorded',
        description: 'Verified 2023-24 baseline GEI entered',
        passed: hasBaselineGEI,
      },
      {
        label: 'Baseline electricity EF recorded',
        description: 'CEA factor locked at baseline year for normalization',
        passed: hasBaselineEF,
      },
      {
        label: 'BEE notification reference',
        description: 'MoEFCC notification ref number entered',
        passed: hasBEERef,
      },
    ];
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              ← Dashboard
            </Link>
          </div>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">CCTS</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">CCTS Compliance Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track your GHG emission intensity targets, actual performance, and Carbon Credit Certificate position under the Carbon Credit Trading Scheme, 2023.
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 space-y-2">
          <p className="font-semibold">How to use this dashboard</p>
          <p>Enter your BEE-notified GHG Emission Intensity (GEI) targets from your MoEFCC notification letter below. Your actual GEI is calculated automatically from your logged data and updates in real time.</p>
          <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">📦</span>
            <div>
              <p className="font-semibold text-slate-800">Don&apos;t forget to log production output</p>
              <p className="text-slate-600 mt-0.5">GEI requires both emissions and production data. Each time you log monthly emissions, scroll down to the <span className="font-medium">Production output</span> field and enter your units produced that month. Without this, GEI and CCC position cannot be calculated.</p>
              <a href="/dashboard/emissions" className="inline-flex items-center gap-1 mt-1.5 text-emerald-700 font-medium hover:underline underline-offset-2">
                Go to Add emissions →
              </a>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {targets.length === 0 && !showForm ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">No compliance targets added yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add your BEE-notified GEI targets to start tracking your CCTS compliance position.</p>
            <button onClick={startAdd} className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800">
              + Add compliance year
            </button>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Compliance years</h2>
              <button onClick={startAdd} className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-1.5 hover:bg-slate-800">
                + Add year
              </button>
            </div>

            {targets.map(target => {
              const actual = getActualForYear(target.compliance_year);
              const position = getCCCPosition(target);
              const isActive = target.compliance_year === CURRENT_YEAR;

              return (
                <article key={target.id} className={`rounded-xl bg-white border p-5 shadow ${isActive ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        FY {target.compliance_year} {isActive ? '· Active' : ''}
                      </span>
                      <span className="text-[10px] text-slate-400">Trajectory: {target.trajectory_period}</span>
                    </div>
                    <button onClick={() => startEdit(target)} className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2">Edit</button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Sector</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{SECTORS.find(s => s.value === target.sector)?.label ?? target.sector}</p>
                      {target.sub_sector && <p className="text-[11px] text-slate-400">{target.sub_sector}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Target GEI</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{target.target_gei} tCO₂e/t</p>
                      {target.baseline_gei && <p className="text-[11px] text-slate-400">Baseline: {target.baseline_gei} tCO₂e/t</p>}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Actual GEI</p>
                      {actual?.actual_gei != null ? (
                        <>
                          <p className={`text-sm font-semibold mt-0.5 ${actual.actual_gei <= target.target_gei ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {actual.actual_gei.toFixed(4)} tCO₂e/t
                          </p>
                          <p className="text-[11px] text-slate-400">{actual.total_product_output.toLocaleString()} t output · FY aggregate</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 mt-0.5">
                          {actual && actual.total_product_output === 0 ? 'No product output logged' : 'No data yet'}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">CCC Position</p>
                      {position ? (
                        <>
                          <p className={`text-sm font-semibold mt-0.5 ${position.surplus ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {position.surplus ? '+' : ''}{position.ccc.toFixed(1)} CCCs
                          </p>
                          <p className="text-[11px] text-slate-400">{position.surplus ? 'Eligible to earn' : 'Must surrender/buy'}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 mt-0.5">N/A</p>
                      )}
                    </div>
                  </div>

                  {/* Intensity vs target bar */}
                  {actual && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">GEI vs Target</p>
                        {actual.actual_gei != null && (
                          <span className={`text-[10px] font-semibold ${actual.actual_gei <= target.target_gei ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {actual.actual_gei <= target.target_gei ? 'On track' : 'Above target'}
                          </span>
                        )}
                      </div>
                      {actual.actual_gei != null ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 w-16 shrink-0">Target</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (target.target_gei / Math.max(target.target_gei, actual.actual_gei)) * 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-slate-700 w-20 text-right">{target.target_gei} tCO₂e/t</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 w-16 shrink-0">Actual</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100">
                              <div className={`h-2 rounded-full ${actual.actual_gei <= target.target_gei ? 'bg-slate-900' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (actual.actual_gei / Math.max(target.target_gei, actual.actual_gei)) * 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-slate-700 w-20 text-right">{actual.actual_gei.toFixed(4)} tCO₂e/t</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">Log emissions and production output to see intensity vs target.</p>
                      )}
                    </div>
                  )}

                  {/* Monthly breakdown toggle */}
                  {actual && actual.months.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setExpandedYear(expandedYear === target.compliance_year ? null : target.compliance_year)}
                        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${expandedYear === target.compliance_year ? 'rotate-180' : ''}`}>
                          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                        {expandedYear === target.compliance_year ? 'Hide' : 'Show'} monthly breakdown ({actual.months.length} months)
                      </button>

                      {expandedYear === target.compliance_year && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="p-2 text-left font-medium text-slate-500">Month</th>
                                <th className="p-2 text-right font-medium text-slate-500">Emissions (tCO₂e)</th>
                                <th className="p-2 text-right font-medium text-slate-500">Output (t)</th>
                                <th className="p-2 text-right font-medium text-slate-500">Intensity (tCO₂e/t)</th>
                                <th className="p-2 text-right font-medium text-slate-500">vs Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {actual.months.map((m, i) => {
                                const intensity = m.emission_intensity;
                                const onTrack = intensity != null && intensity <= target.target_gei;
                                const rowBg = !m.has_emissions ? 'bg-blue-50/40' : !m.has_output ? '' : '';
                                return (
                                  <tr key={i} className={`border-b border-slate-100 last:border-0 ${rowBg}`}>
                                    <td className="p-2 font-medium text-slate-800">
                                      <div className="flex items-center gap-1.5">
                                        {m.month}
                                        {!m.has_emissions && (
                                          <span className="text-[9px] bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 font-medium">Output only</span>
                                        )}
                                        {m.has_emissions && !m.has_output && (
                                          <span className="text-[9px] bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 font-medium">No output</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2 text-right tabular-nums text-slate-600">
                                      {m.has_emissions ? (m.total_co2e_kg / 1000).toFixed(4) : 'N/A'}
                                    </td>
                                    <td className="p-2 text-right tabular-nums text-slate-600">
                                      {m.product_output > 0 ? m.product_output.toLocaleString() : 'N/A'}
                                    </td>
                                    <td className="p-2 text-right tabular-nums font-medium text-slate-800">
                                      {intensity != null ? intensity.toFixed(4) : 'N/A'}
                                    </td>
                                    <td className="p-2 text-right">
                                      {intensity != null ? (
                                        <span className={`text-[10px] font-semibold ${onTrack ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {onTrack ? 'On track' : 'Above'}
                                        </span>
                                      ) : m.has_emissions && !m.has_output ? (
                                        <span className="text-[10px] text-amber-500">Log output</span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">N/A</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {target.bee_notification_ref && (
                    <p className="mt-3 text-[10px] text-slate-400">
                      BEE Notification Ref: <span className="font-medium text-slate-600">{target.bee_notification_ref}</span>
                      {target.notified_date && ` · ${target.notified_date}`}
                    </p>
                  )}

                  {target.declaration_confirmed && target.declaration_timestamp && (
                    <p className="mt-1 text-[10px] text-emerald-600">
                      Declaration confirmed {new Date(target.declaration_timestamp).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {/* Target entry form */}
        {showForm && (
          <section className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit compliance year' : 'Add compliance year'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-xs text-slate-400 hover:text-slate-700">
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Sector */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Sector <span className="text-red-500">*</span></label>
                  <select required value={form.sector} onChange={e => update('sector', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                    <option value="">Select sector…</option>
                    {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {SUB_SECTORS[form.sector] && (
                  <div>
                    <label className="text-xs font-medium text-slate-700">Sub-sector</label>
                    <select value={form.sub_sector} onChange={e => update('sub_sector', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                      <option value="">Select sub-sector…</option>
                      {SUB_SECTORS[form.sector].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Year + trajectory */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Compliance year <span className="text-red-500">*</span></label>
                  <select required value={form.compliance_year} onChange={e => update('compliance_year', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                    {COMPLIANCE_YEARS.map(y => <option key={y} value={y}>FY {y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Trajectory period</label>
                  <input type="text" value={form.trajectory_period} onChange={e => update('trajectory_period', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 2026-2028" />
                </div>
              </div>

              {/* GEI targets */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Target GEI (tCO₂e/tonne) <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.0001" min="0" value={form.target_gei} onChange={e => update('target_gei', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 0.85" />
                  <p className="text-[10px] text-slate-400 mt-0.5">From your MoEFCC notification</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Baseline GEI (tCO₂e/tonne)</label>
                  <input type="number" step="0.0001" min="0" value={form.baseline_gei} onChange={e => update('baseline_gei', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 1.10" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Verified 2023-24 baseline</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Baseline electricity EF</label>
                  <input type="number" step="0.0001" min="0" value={form.baseline_ef_electricity} onChange={e => update('baseline_ef_electricity', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0.82" />
                  <p className="text-[10px] text-slate-400 mt-0.5">CEA factor locked at baseline year</p>
                </div>
              </div>

              {/* Equivalent product */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Equivalent product <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.equivalent_product} onChange={e => update('equivalent_product', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. Cement" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Unit</label>
                  <input type="text" value={form.equivalent_product_unit} onChange={e => update('equivalent_product_unit', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="tonnes" />
                </div>
              </div>

              {/* BEE notification */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">BEE / MoEFCC notification reference</label>
                  <input type="text" value={form.bee_notification_ref} onChange={e => update('bee_notification_ref', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. MoEFCC/CCTS/2026/001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Notification date</label>
                  <input type="date" value={form.notified_date} onChange={e => update('notified_date', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Declaration */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Declaration</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.declaration_confirmed}
                    onChange={e => update('declaration_confirmed', e.target.checked)}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span className="text-xs text-amber-800">
                    I confirm that the GEI targets entered above match the official MoEFCC notification letter issued to this organisation under the Carbon Credit Trading Scheme, 2023. I understand that this declaration will be timestamped and may be reviewed during ACVA verification.
                  </span>
                </label>
              </div>

              {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button type="submit" disabled={saving} className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : editingId ? 'Update target' : 'Save target'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* CCC Position History */}
        {targets.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">CCC position history</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Carbon Credit Certificate position across all compliance years. Positive = surplus to earn/sell. Negative = deficit to surrender/buy.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-left font-medium text-slate-500">FY</th>
                    <th className="p-3 text-right font-medium text-slate-500">Target GEI</th>
                    <th className="p-3 text-right font-medium text-slate-500">Actual GEI</th>
                    <th className="p-3 text-right font-medium text-slate-500">Output</th>
                    <th className="p-3 text-right font-medium text-slate-500">CCC Position</th>
                    <th className="p-3 text-right font-medium text-slate-500">Status</th>
                    <th className="p-3 text-right font-medium text-slate-500">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map(target => {
                    const actual = getActualForYear(target.compliance_year);
                    const position = getCCCPosition(target);
                    const submission = submissions.find(s => s.compliance_year === target.compliance_year);
                    const status = (submission?.status ?? 'draft') as SubmissionStatus;
                    const statusCfg = STATUS_CONFIG[status];

                    return (
                      <tr key={target.compliance_year} className="border-b border-slate-100 last:border-0">
                        <td className="p-3 font-semibold text-slate-800">FY {target.compliance_year}</td>
                        <td className="p-3 text-right tabular-nums text-slate-600">
                          {target.target_gei} tCO₂e/t
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {actual?.actual_gei != null ? (
                            <span className={actual.actual_gei <= target.target_gei ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                              {actual.actual_gei.toFixed(4)} tCO₂e/t
                            </span>
                          ) : (
                            <span className="text-slate-400">No data</span>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums text-slate-600">
                          {actual?.total_product_output
                            ? `${actual.total_product_output.toLocaleString()} ${target.equivalent_product_unit}`
                            : 'N/A'}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {position ? (
                            <span className={`font-semibold ${position.surplus ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {position.surplus ? '+' : ''}{position.ccc.toFixed(1)} CCCs
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {position ? (
                            <span className={`text-[10px] font-semibold ${
                              actual?.actual_gei != null && actual.actual_gei <= target.target_gei
                                ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {actual?.actual_gei != null && actual.actual_gei <= target.target_gei ? 'On track' : 'Above target'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Insufficient data</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {targets.length > 1 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td className="p-3 font-semibold text-slate-700" colSpan={4}>Net CCC position (all years)</td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        {(() => {
                          const net = targets.reduce((sum, target) => {
                            const pos = getCCCPosition(target);
                            return sum + (pos?.ccc ?? 0);
                          }, 0);
                          return (
                            <span className={net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {net >= 0 ? '+' : ''}{net.toFixed(1)} CCCs
                            </span>
                          );
                        })()}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}

        {/* Production Output History */}
        {productionEntries.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Production output log</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Monthly production entries used to calculate GEI. Edit or delete entries if corrections are needed.</p>
              </div>
              <a
                href="/dashboard/emissions"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-1.5 hover:bg-slate-800"
              >
                + Log output
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-left font-medium text-slate-500">Month</th>
                    <th className="p-3 text-right font-medium text-slate-500">Quantity</th>
                    <th className="p-3 text-right font-medium text-slate-500">Unit</th>
                    <th className="p-3 text-right font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productionEntries.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="p-3 font-medium text-slate-800">{p.month}</td>
                      <td className="p-3 text-right tabular-nums text-slate-700">
                        {editingProdId === p.id ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingProdQty}
                            onChange={e => setEditingProdQty(e.target.value)}
                            className="w-24 border rounded-lg px-2 py-1 text-xs text-right bg-white"
                            autoFocus
                          />
                        ) : (
                          p.quantity.toLocaleString()
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {editingProdId === p.id ? (
                          <select
                            value={editingProdUnit}
                            onChange={e => setEditingProdUnit(e.target.value)}
                            className="border rounded-lg px-2 py-1 text-xs bg-white"
                          >
                            <option value="tonnes">Tonnes</option>
                            <option value="units">Units</option>
                            <option value="kg">kg</option>
                            <option value="litres">Litres</option>
                            <option value="sqm">Square metres</option>
                            <option value="kwh">kWh</option>
                            <option value="mwh">MWh</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          p.unit
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {deletingProdId === p.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-slate-500">Delete?</span>
                            <button
                              onClick={() => handleProdDelete(p.id)}
                              className="text-[10px] font-semibold text-rose-600 hover:text-rose-800"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingProdId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : editingProdId === p.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleProdSave(p.id)}
                              disabled={prodSaving}
                              className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                            >
                              {prodSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingProdId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => {
                                setEditingProdId(p.id);
                                setEditingProdQty(String(p.quantity));
                                setEditingProdUnit(p.unit);
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-700 underline underline-offset-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingProdId(p.id)}
                              className="text-[10px] text-rose-400 hover:text-rose-600 underline underline-offset-2"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="p-3 font-semibold text-slate-700 text-xs">Total</td>
                    <td className="p-3 text-right font-semibold text-slate-900 tabular-nums text-xs">
                      {productionEntries.reduce((s, p) => s + p.quantity, 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-slate-500 text-xs">
                      {productionEntries[0]?.unit ?? 'tonnes'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ACVA Submission Workflow */}
        {targets.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">ACVA Submission Workflow</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Track your verification package submission status for each compliance year.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {targets.map(target => {
                const submission = submissions.find(s => s.compliance_year === target.compliance_year);
                const status = (submission?.status ?? 'draft') as SubmissionStatus;
                const statusCfg = STATUS_CONFIG[status];
                const nextStatuses = STATUS_FLOW[status];
                const isExpanded = expandedSubmission === target.compliance_year;

                return (
                  <div key={target.compliance_year} className="px-5 py-4">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-700">FY {target.compliance_year}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                          {statusCfg.label}
                        </span>
                        {submission?.acva_ref && (
                          <span className="text-[10px] text-slate-400">Ref: {submission.acva_ref}</span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedSubmission(isExpanded ? null : target.compliance_year)}
                        className="text-[11px] text-slate-400 hover:text-slate-700 underline underline-offset-2"
                      >
                        {isExpanded ? 'Close' : 'Manage'}
                      </button>
                    </div>

                    {/* Timeline */}
                    <div className="mt-3 flex items-center gap-1 flex-wrap">
                      {(['draft', 'ready', 'submitted', 'under_review', 'verified'] as SubmissionStatus[]).map((s, i) => {
                        const cfg = STATUS_CONFIG[s];
                        const isCurrentOrPast = ['draft', 'ready', 'submitted', 'under_review', 'verified'].indexOf(status) >= i;
                        const isCurrent = status === s;
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <div className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                              status === 'rejected' && s === 'draft' ? 'bg-rose-100 text-rose-600' :
                              isCurrent ? `${cfg.bg} ${cfg.color} border ${cfg.border}` :
                              isCurrentOrPast ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                              {cfg.label}
                            </div>
                            {i < 4 && <div className={`w-4 h-px ${isCurrentOrPast ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                          </div>
                        );
                      })}
                      {status === 'rejected' && (
                        <div className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">
                          Rejected
                        </div>
                      )}
                    </div>

                    {/* Timestamps */}
                    {submission && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {submission.submitted_at && (
                          <p className="text-[10px] text-slate-400">Submitted: {new Date(submission.submitted_at).toLocaleDateString('en-IN')}</p>
                        )}
                        {submission.verified_at && (
                          <p className="text-[10px] text-emerald-600">Verified: {new Date(submission.verified_at).toLocaleDateString('en-IN')}</p>
                        )}
                        {submission.rejected_at && (
                          <p className="text-[10px] text-rose-600">Rejected: {new Date(submission.rejected_at).toLocaleDateString('en-IN')}</p>
                        )}
                        {submission.rejection_reason && (
                          <p className="text-[10px] text-rose-600">Reason: {submission.rejection_reason}</p>
                        )}
                      </div>
                    )}

                    {/* Expanded management panel */}
                    {isExpanded && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                        {/* ACVA details */}
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">ACVA name</label>
                            <input
                              type="text"
                              value={submissionForm.acva_name || submission?.acva_name || ''}
                              onChange={e => setSubmissionForm(prev => ({ ...prev, acva_name: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white"
                              placeholder="e.g. Bureau Veritas India"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">ACVA reference number</label>
                            <input
                              type="text"
                              value={submissionForm.acva_ref || submission?.acva_ref || ''}
                              onChange={e => setSubmissionForm(prev => ({ ...prev, acva_ref: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white"
                              placeholder="e.g. BV/CCTS/2026/001"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Notes</label>
                          <textarea
                            value={submissionForm.notes || submission?.notes || ''}
                            onChange={e => setSubmissionForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white resize-none"
                            rows={2}
                            placeholder="Any notes about this submission…"
                          />
                        </div>

                        {/* Rejection reason — only show when moving to rejected */}
                        {status === 'under_review' && (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">Rejection reason (if rejecting)</label>
                            <input
                              type="text"
                              value={submissionForm.rejection_reason}
                              onChange={e => setSubmissionForm(prev => ({ ...prev, rejection_reason: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white"
                              placeholder="e.g. Incomplete audit chain for November 2025"
                            />
                          </div>
                        )}

                        {/* Readiness checklist — only show on draft status */}
                        {status === 'draft' && (() => {
                          const checks = getReadinessChecks(target.compliance_year);
                          const allPassed = checks.every(c => c.passed);
                          const passedCount = checks.filter(c => c.passed).length;

                          return (
                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <p className="text-[11px] font-semibold text-slate-700">Submission readiness</p>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  allPassed
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {passedCount} of {checks.length} complete
                                </span>
                              </div>
                              <div className="divide-y divide-slate-50">
                                {checks.map((check, i) => (
                                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                                    <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                      check.passed ? 'bg-emerald-100' : 'bg-slate-100'
                                    }`}>
                                      {check.passed ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-emerald-600">
                                          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-slate-400">
                                          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[11px] font-medium ${check.passed ? 'text-slate-700' : 'text-slate-500'}`}>
                                        {check.label}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">{check.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {!allPassed && (
                                <div className="px-4 py-3 border-t border-slate-100 bg-amber-50">
                                  <p className="text-[10px] text-amber-700">Complete all checks before marking as ready to submit. Incomplete packages may be rejected by the ACVA.</p>
                                </div>
                              )}
                              {allPassed && (
                                <div className="px-4 py-3 border-t border-slate-100 bg-emerald-50">
                                  <p className="text-[10px] text-emerald-700 font-medium">All checks passed. This package is ready for ACVA submission.</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Action buttons */}
                        {nextStatuses.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                            <span className="text-[11px] text-slate-500">Move to:</span>
                            {nextStatuses.map(next => {
                              const cfg = STATUS_CONFIG[next];
                              const isDestructive = next === 'rejected' || next === 'draft';
                              return (
                                <button
                                  key={next}
                                  onClick={() => handleSubmissionUpsert(target.compliance_year, next)}
                                  disabled={submissionSaving || (next === 'ready' && !getReadinessChecks(target.compliance_year).every(c => c.passed))}
                                  title={next === 'ready' && !getReadinessChecks(target.compliance_year).every(c => c.passed) ? 'Complete all readiness checks first' : undefined}
                                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border disabled:opacity-50 ${
                                    isDestructive
                                      ? 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
                                      : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-700'
                                  }`}
                                >
                                  {submissionSaving ? 'Saving…' : cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {status === 'verified' && (
                          <p className="text-[11px] text-emerald-600 font-medium">This compliance year has been verified by the ACVA. No further action required.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Methodology note */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">CCC position calculation</p>
          <p>CCCs = (Target GEI &minus; Actual GEI) &times; Total equivalent product output. Positive = surplus CCCs eligible to earn/sell. Negative = deficit CCCs to surrender/purchase.</p>
          <p>Actual GEI is calculated from your logged emissions and product output. Ensure product output is logged monthly in the emissions form for accurate tracking.</p>
          <p className="text-[10px]">Regulatory reference: Carbon Credit Trading Scheme, 2023 (MoP S.O. 2825(E)) &middot; BEE Detailed Procedure for Compliance Mechanism v1.0, July 2024.</p>
        </section>

      </div>
    </main>
  );
}
