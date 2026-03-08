// app/dashboard/brsr-profile/page.tsx
//
// Feature 1.3 — BRSR onboarding fields (India accounts only)
//
// Shown as an additional onboarding step after signup for India accounts.
// Also accessible later from account settings (Organisation page link).
// Non-India accounts are redirected to the dashboard immediately.

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const INDUSTRY_SECTORS = [
  'Manufacturing',
  'IT/Software',
  'Textiles',
  'Auto Components',
  'Pharmaceuticals',
  'Logistics',
  'FMCG',
  'Professional Services',
  'Other',
];

type FormState = {
  is_listed_company: string;          // 'yes' | 'no' | 'subsidiary'
  permanent_employees: string;
  permanent_workers: string;
  renewable_elec_pct: string;
  has_ghg_reduction_plan: boolean;
  ghg_reduction_detail: string;
  industry_sector: string;
};

const EMPTY_FORM: FormState = {
  is_listed_company: '',
  permanent_employees: '',
  permanent_workers: '',
  renewable_elec_pct: '',
  has_ghg_reduction_plan: false,
  ghg_reduction_detail: '',
  industry_sector: '',
};

export default function BrsrProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /></main>}>
      <BrsrProfileInner />
    </Suspense>
  );
}

function BrsrProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Guard: redirect non-India accounts away
      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN') {
        router.push('/dashboard');
        return;
      }

      // Load existing BRSR profile if any
      const { data: brsr } = await supabase
        .from('brsr_profile')
        .select('*')
        .eq('account_id', user.id)
        .maybeSingle();

      if (brsr) {
        setForm({
          is_listed_company: brsr.is_listed_company === true
            ? 'yes'
            : brsr.is_subsidiary_of_listed
            ? 'subsidiary'
            : 'no',
          permanent_employees: brsr.permanent_employees?.toString() ?? '',
          permanent_workers:   brsr.permanent_workers?.toString() ?? '',
          renewable_elec_pct:  brsr.renewable_elec_pct?.toString() ?? '',
          has_ghg_reduction_plan: brsr.has_ghg_reduction_plan ?? false,
          ghg_reduction_detail:   brsr.ghg_reduction_detail ?? '',
          industry_sector:        brsr.industry_sector ?? '',
        });
      }

      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      account_id:              user.id,
      is_listed_company:       form.is_listed_company === 'yes',
      is_subsidiary_of_listed: form.is_listed_company === 'subsidiary',
      permanent_employees:     form.permanent_employees ? parseInt(form.permanent_employees) : null,
      permanent_workers:       form.permanent_workers   ? parseInt(form.permanent_workers)   : null,
      renewable_elec_pct:      form.renewable_elec_pct  ? parseFloat(form.renewable_elec_pct) : null,
      has_ghg_reduction_plan:  form.has_ghg_reduction_plan,
      ghg_reduction_detail:    form.has_ghg_reduction_plan ? form.ghg_reduction_detail : null,
      industry_sector:         form.industry_sector || null,
      updated_at:              new Date().toISOString(),
    };

    const { error } = await supabase
      .from('brsr_profile')
      .upsert(payload, { onConflict: 'account_id' });

    setSaving(false);

    if (error) {
      alert('Failed to save BRSR profile: ' + error.message);
      return;
    }

    if (isOnboarding) {
      router.push('/dashboard');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
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
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          {!isOnboarding && (
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
              </svg>
              Dashboard
            </Link>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">BRSR</span>
            {isOnboarding && <span className="text-[10px] text-slate-500">Step 2 of 2</span>}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">BRSR Company Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Required for SEBI Business Responsibility &amp; Sustainability Report (BRSR) compliance.
            {isOnboarding && ' You can skip this and complete it later from your account settings.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-6">

          {/* Listed company status */}
          <div>
            <label className="text-xs font-medium text-slate-700">Listed company status</label>
            <div className="mt-2 flex flex-col gap-2">
              {[
                { value: 'yes',        label: 'Yes — listed company' },
                { value: 'no',         label: 'No — unlisted company' },
                { value: 'subsidiary', label: 'Subsidiary of a listed company' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="listed_status"
                    value={value}
                    checked={form.is_listed_company === value}
                    onChange={() => update('is_listed_company', value)}
                    className="accent-emerald-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Employee counts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700">
                Permanent employees <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. 250"
                value={form.permanent_employees}
                onChange={(e) => update('permanent_employees', e.target.value)}
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Full-time + part-time on payroll</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Permanent workers <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. 80"
                value={form.permanent_workers}
                onChange={(e) => update('permanent_workers', e.target.value)}
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">On-site contract / casual workers</p>
            </div>
          </div>

          {/* Industry sector */}
          <div>
            <label className="text-xs font-medium text-slate-700">Industry sector</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.industry_sector}
              onChange={(e) => update('industry_sector', e.target.value)}
            >
              <option value="">Select sector…</option>
              {INDUSTRY_SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Renewable electricity % */}
          <div>
            <label className="text-xs font-medium text-slate-700">
              Renewable electricity percentage
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="w-32 rounded-lg border px-3 py-2 text-sm"
                placeholder="0–100"
                value={form.renewable_elec_pct}
                onChange={(e) => update('renewable_elec_pct', e.target.value)}
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Share of electricity from renewable sources</p>
          </div>

          {/* GHG reduction plan */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_ghg_reduction_plan}
                onChange={(e) => update('has_ghg_reduction_plan', e.target.checked)}
                className="accent-emerald-600"
              />
              We have a GHG reduction plan
            </label>
            {form.has_ghg_reduction_plan && (
              <textarea
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                placeholder="Briefly describe your GHG reduction plan…"
                value={form.ghg_reduction_detail}
                onChange={(e) => update('ghg_reduction_detail', e.target.value)}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isOnboarding ? 'Save & go to dashboard →' : 'Save BRSR profile'}
            </button>
            {isOnboarding && (
              <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Skip for now
              </Link>
            )}
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>
            )}
          </div>
        </form>

        {/* India feature toggles — visible after onboarding */}
        {!isOnboarding && (
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">India disclosure modules</h2>
            <p className="text-xs text-slate-500">Enable additional data categories required for BRSR Principle 6 disclosures. Settings are saved in your account preferences.</p>
            <IndiaToggles />
          </div>
        )}
      </div>
    </main>
  );
}

// ── India feature toggles component ───────────────────────────────────────────

type IndiaFlags = {
  india_water_enabled: boolean;
  india_waste_enabled: boolean;
  india_air_enabled: boolean;
};

function IndiaToggles() {
  const [flags, setFlags] = useState<IndiaFlags | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('india_water_enabled, india_waste_enabled, india_air_enabled')
        .eq('id', user.id)
        .maybeSingle();
      setFlags({
        india_water_enabled: data?.india_water_enabled ?? false,
        india_waste_enabled: data?.india_waste_enabled ?? false,
        india_air_enabled:   data?.india_air_enabled   ?? false,
      });
    }
    load();
  }, []);

  async function toggle(key: keyof IndiaFlags, value: boolean) {
    if (!flags) return;
    const next = { ...flags, [key]: value };
    setFlags(next);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
    }
    setSaving(false);
  }

  if (!flags) return <div className="h-6 animate-pulse bg-slate-100 rounded" />;

  const modules = [
    { key: 'india_water_enabled' as const, label: 'Water tracking', desc: 'Log monthly water withdrawn/consumed/discharged (BRSR Principle 6)' },
    { key: 'india_waste_enabled' as const, label: 'Waste tracking',  desc: 'Log monthly waste generated, recycled, landfill and hazardous (BRSR Principle 6)' },
    { key: 'india_air_enabled'   as const, label: 'Air emissions',   desc: 'Log annual NOx, SOx, and particulate matter disclosures (BRSR Principle 6)' },
  ];

  return (
    <div className="space-y-3">
      {modules.map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-3 cursor-pointer group">
          <div className="mt-0.5">
            <button
              type="button"
              role="switch"
              aria-checked={flags[key]}
              onClick={() => toggle(key, !flags[key])}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${flags[key] ? 'bg-emerald-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${flags[key] ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        </label>
      ))}
      {saving && <p className="text-xs text-slate-400">Saving…</p>}
    </div>
  );
}
