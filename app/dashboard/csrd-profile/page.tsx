'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const EU_COUNTRIES_SET = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

type FormState = {
  csrd_required: boolean;
  employee_count: string;
  annual_revenue: string;
  annual_output_units: string;
  methodology_confirmed: boolean;
  renewable_energy_tariff: boolean;
  has_company_vehicles: boolean;
};

const EMPTY_FORM: FormState = {
  csrd_required: false,
  employee_count: '',
  annual_revenue: '',
  annual_output_units: '',
  methodology_confirmed: false,
  renewable_energy_tariff: false,
  has_company_vehicles: false,
};

type CompletionItem = { label: string; done: boolean };

function getCompletion(form: FormState): CompletionItem[] {
  return [
    { label: 'CSRD applicability confirmed', done: form.csrd_required },
    { label: 'Employee count entered', done: !!form.employee_count },
    { label: 'Annual turnover entered', done: !!form.annual_revenue },
    { label: 'Methodology confirmed', done: form.methodology_confirmed },
  ];
}

export default function CsrdProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country, csrd_required, employee_count, annual_revenue, annual_output_units, methodology_confirmed, renewable_energy_tariff, has_company_vehicles')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !EU_COUNTRIES_SET.has(profile.country ?? '')) {
        router.push('/dashboard');
        return;
      }

      setForm({
        csrd_required:           profile.csrd_required           ?? false,
        employee_count:          profile.employee_count          ? String(profile.employee_count)          : '',
        annual_revenue:          profile.annual_revenue          ? String(profile.annual_revenue)          : '',
        annual_output_units:     profile.annual_output_units     ? String(profile.annual_output_units)     : '',
        methodology_confirmed:   profile.methodology_confirmed   ?? false,
        renewable_energy_tariff: profile.renewable_energy_tariff ?? false,
        has_company_vehicles:    profile.has_company_vehicles    ?? false,
      });

      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: err } = await supabase
      .from('profiles')
      .update({
        csrd_required:           form.csrd_required,
        employee_count:          form.employee_count      ? Number(form.employee_count)      : null,
        annual_revenue:          form.annual_revenue      ? Number(form.annual_revenue)      : null,
        annual_output_units:     form.annual_output_units ? Number(form.annual_output_units) : null,
        methodology_confirmed:   form.methodology_confirmed,
        renewable_energy_tariff: form.renewable_energy_tariff,
        has_company_vehicles:    form.has_company_vehicles,
      })
      .eq('id', user.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </main>
    );
  }

  const completion = getCompletion(form);
  const completedCount = completion.filter(c => c.done).length;
  const employeeCount = Number(form.employee_count) || 0;
  const revenue = Number(form.annual_revenue) || 0;
  const meetsEmployeeThreshold = employeeCount >= 250;
  const meetsRevenueThreshold = revenue >= 40_000_000;
  const likelyRequired = meetsEmployeeThreshold || meetsRevenueThreshold;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            ← Dashboard
          </Link>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">CSRD</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">CSRD Company Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Corporate Sustainability Reporting Directive, required for large EU companies and listed SMEs. Complete this profile to generate CSRD-compliant reports.
          </p>
        </div>

        {/* Completeness widget */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Profile completeness</h2>
            <span className="text-sm font-semibold text-slate-700">{completedCount}/{completion.length}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(completedCount / completion.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-1.5">
            {completion.map(item => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${item.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {item.done ? '✓' : '·'}
                </span>
                <span className={item.done ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phased rollout info */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Who must report under CSRD?</p>
          <p>Large EU companies with 250+ employees or €40M+ net turnover. Reporting is being phased in: large companies (FY2024 reporting, due 2025), listed SMEs (FY2026, due 2027).</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section 1: Applicability */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-5">
            <h2 className="text-sm font-semibold text-slate-900">CSRD applicability</h2>

            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.csrd_required}
                onChange={e => update('csrd_required', e.target.checked)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                My company is required to comply with CSRD (Corporate Sustainability Reporting Directive).
                <span className="block text-xs text-slate-400 mt-0.5">Applies to large EU companies (250+ employees or €40M+ net turnover). Listed SMEs from 2026.</span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Number of employees</label>
                <input
                  type="number"
                  min="0"
                  value={form.employee_count}
                  onChange={e => update('employee_count', e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  placeholder="e.g. 320"
                />
                {form.employee_count && (
                  <p className={`text-[11px] mt-0.5 font-medium ${meetsEmployeeThreshold ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {meetsEmployeeThreshold ? '✓ Meets 250+ threshold' : 'Below 250 threshold'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Annual turnover (€)</label>
                <input
                  type="number"
                  min="0"
                  value={form.annual_revenue}
                  onChange={e => update('annual_revenue', e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  placeholder="e.g. 45000000"
                />
                {form.annual_revenue && (
                  <p className={`text-[11px] mt-0.5 font-medium ${meetsRevenueThreshold ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {meetsRevenueThreshold ? '✓ Meets €40M+ threshold' : 'Below €40M threshold'}
                  </p>
                )}
              </div>
            </div>

            {(form.employee_count || form.annual_revenue) && (
              <div className={`rounded-lg px-4 py-3 text-xs ${likelyRequired ? 'bg-amber-50 border border-amber-100 text-amber-800' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                {likelyRequired
                  ? '⚠ Based on the figures entered, your company likely meets the CSRD reporting threshold.'
                  : 'Based on the figures entered, your company may be below the mandatory CSRD threshold. Voluntary reporting is still encouraged.'}
              </div>
            )}
          </div>

          {/* Section 2: Intensity ratio */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-5">
            <h2 className="text-sm font-semibold text-slate-900">Emissions intensity ratio</h2>
            <p className="text-xs text-slate-500">Enter your chosen denominator for intensity calculations (e.g. units produced, revenue €, floor area m²).</p>
            <div>
              <label className="text-xs font-medium text-slate-700">Annual output / denominator (optional)</label>
              <input
                type="number"
                min="0"
                value={form.annual_output_units}
                onChange={e => update('annual_output_units', e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                placeholder="e.g. 10000 (units produced)"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Greenio will calculate tCO₂e per unit using this figure in your CSRD report.</p>
            </div>
          </div>

          {/* Section 3: Operations */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Operations</h2>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_company_vehicles}
                onChange={e => update('has_company_vehicles', e.target.checked)}
                className="accent-blue-600"
              />
              We operate company-owned vehicles
              <span className="text-[11px] text-slate-400 ml-1">(Scope 1 emissions — required in CSRD)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.renewable_energy_tariff}
                onChange={e => update('renewable_energy_tariff', e.target.checked)}
                className="accent-blue-600"
              />
              We use a renewable electricity tariff
              <span className="text-[11px] text-slate-400 ml-1">(must be disclosed under ESRS E1)</span>
            </label>
          </div>

          {/* Section 4: Methodology */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Methodology</h2>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Methodology used for CSRD reporting:</strong><br />
                Greenio uses geo-optimised emission factors aligned to Eurostat and IEA official sources. Electricity uses location-based grid factors per country; fuel emissions use standard kg CO₂e per litre values. Reporting aligns with CSRD and the GHG Protocol Corporate Standard.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.methodology_confirmed}
                onChange={e => update('methodology_confirmed', e.target.checked)}
                className="accent-blue-600"
              />
              I confirm the calculation methodology described above is correct and has been applied to this reporting period.
            </label>
          </div>

          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center gap-3 pb-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save CSRD profile'}
            </button>
            <Link href="/dashboard/eu-ets" className="text-xs text-blue-600 hover:underline underline-offset-2">
              Go to EU ETS Dashboard →
            </Link>
          </div>
        </form>

      </div>
    </main>
  );
}