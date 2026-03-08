// app/dashboard/emissions/water/page.tsx
//
// Feature 1.5 — Water tracking (India opt-in)
//
// Available only to India accounts with india_water_enabled = true.
// CO2e = volume_consumed_kl * 0.344 (DEFRA 2024 water factor).
// Audit trail matches energy entries via logActivity.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';

const WATER_EF = 0.344; // kgCO2e per kL consumed (DEFRA 2024)
const EF_CATEGORY = 'water';

type WaterEntry = {
  id: string;
  period_month: number;
  period_year: number;
  source_type: string;
  volume_withdrawn_kl: number;
  volume_consumed_kl: number;
  volume_discharged_kl: number;
  discharge_destination: string;
  co2e_kg: number;
  ef_version: string;
  data_source: string;
};

const SOURCE_LABELS: Record<string, string> = {
  groundwater: 'Groundwater',
  surface:     'Surface water',
  municipal:   'Municipal supply',
  rainwater:   'Rainwater',
  other:       'Other',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMPTY_FORM = {
  period_month: new Date().getMonth() + 1,
  period_year:  new Date().getFullYear(),
  source_type:  'municipal',
  volume_withdrawn_kl:   '',
  volume_consumed_kl:    '',
  volume_discharged_kl:  '',
  discharge_destination: '',
};

export default function WaterTrackingPage() {
  const router = useRouter();
  const [entries, setEntries]   = useState<WaterEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [efVersion, setEfVersion] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Guard: India + water enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('country, india_water_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN' || !profile?.india_water_enabled) {
        router.push('/dashboard');
        return;
      }

      // Fetch active water factor version
      const { data: efRow } = await supabase
        .from('emission_factor_versions')
        .select('version_key')
        .eq('category', EF_CATEGORY)
        .is('valid_to', null)
        .maybeSingle();
      setEfVersion(efRow?.version_key ?? null);

      // Load entries
      const { data } = await supabase
        .from('water_entries')
        .select('*')
        .eq('account_id', user.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      setEntries(data ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(entry: WaterEntry) {
    setForm({
      period_month:          entry.period_month,
      period_year:           entry.period_year,
      source_type:           entry.source_type,
      volume_withdrawn_kl:   entry.volume_withdrawn_kl.toString(),
      volume_consumed_kl:    entry.volume_consumed_kl.toString(),
      volume_discharged_kl:  entry.volume_discharged_kl.toString(),
      discharge_destination: entry.discharge_destination ?? '',
    });
    setEditId(entry.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!efVersion) {
      setError('No active water emission factor found. Contact support.');
      return;
    }

    const consumed = parseFloat(form.volume_consumed_kl as string) || 0;
    const co2e_kg  = parseFloat((consumed * WATER_EF).toFixed(3));

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      account_id:            user.id,
      period_month:          Number(form.period_month),
      period_year:           Number(form.period_year),
      source_type:           form.source_type,
      volume_withdrawn_kl:   parseFloat(form.volume_withdrawn_kl as string) || 0,
      volume_consumed_kl:    consumed,
      volume_discharged_kl:  parseFloat(form.volume_discharged_kl as string) || 0,
      discharge_destination: form.discharge_destination || null,
      co2e_kg,
      data_source: 'manual',
      ef_version:  efVersion,
      created_by:  user.id,
    };

    let dbError = null;
    if (editId) {
      const { error } = await supabase.from('water_entries').update(payload).eq('id', editId);
      dbError = error;
      if (!error) {
        await logActivity('update', 'water_entry', {
          entry_id: editId,
          period: `${form.period_year}-${String(form.period_month).padStart(2,'0')}`,
          volume_consumed_kl: consumed,
          co2e_kg,
          ef_version: efVersion,
          data_source: 'manual',
        });
      }
    } else {
      const { error } = await supabase.from('water_entries').insert(payload);
      dbError = error;
      if (!error) {
        await logActivity('create', 'water_entry', {
          period: `${form.period_year}-${String(form.period_month).padStart(2,'0')}`,
          source_type: form.source_type,
          volume_consumed_kl: consumed,
          co2e_kg,
          ef_version: efVersion,
          data_source: 'manual',
        });
      }
    }

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Reload entries
    const { data } = await supabase
      .from('water_entries')
      .select('*')
      .eq('account_id', user.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    setEntries(data ?? []);
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this water entry?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('water_entries').delete().eq('id', id);
    await logActivity('delete', 'water_entry', { entry_id: id });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-white border shadow" />)}
        </div>
      </main>
    );
  }

  const totalConsumed = entries.reduce((s, e) => s + e.volume_consumed_kl, 0);
  const totalCo2e     = entries.reduce((s, e) => s + e.co2e_kg, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
              Dashboard
            </Link>
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">BRSR · Water</span>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors"
          >
            + Add water entry
          </button>
        </div>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Water Tracking</h1>
          <p className="text-sm text-slate-600 mt-1">Log monthly water withdrawal, consumption, and discharge for BRSR Principle 6 disclosure.</p>
          {efVersion && (
            <p className="text-[11px] text-slate-400 mt-1">
              Factor: {WATER_EF} kgCO₂e/kL consumed · Source: {efVersion}
            </p>
          )}
        </header>

        {/* Summary stats */}
        {entries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total entries</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{entries.length}</p>
            </div>
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total consumed (kL)</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalConsumed.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total CO₂e (kg)</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalCo2e.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Disclosed separately — not in Scope 1/2/3 totals</p>
            </div>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm && (
          <div className="rounded-xl bg-white border border-emerald-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{editId ? 'Edit water entry' : 'Add water entry'}</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Month</label>
                  <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.period_month} onChange={(e) => update('period_month', Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Year</label>
                  <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.period_year} onChange={(e) => update('period_year', Number(e.target.value))} min="2000" max="2100" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Water source</label>
                <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.source_type} onChange={(e) => update('source_type', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Withdrawn (kL)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.volume_withdrawn_kl} onChange={(e) => update('volume_withdrawn_kl', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Consumed (kL) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.volume_consumed_kl} onChange={(e) => update('volume_consumed_kl', e.target.value)} required />
                  {form.volume_consumed_kl && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      CO₂e: {(parseFloat(form.volume_consumed_kl as string) * WATER_EF).toFixed(2)} kg
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Discharged (kL)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.volume_discharged_kl} onChange={(e) => update('volume_discharged_kl', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Discharge destination</label>
                <input type="text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. Municipal treatment plant" value={form.discharge_destination} onChange={(e) => update('discharge_destination', e.target.value)} />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button type="submit" disabled={saving} className="rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : editId ? 'Update entry' : 'Save entry'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Entries table */}
        {entries.length === 0 && !showForm ? (
          <div className="rounded-xl bg-white border p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-800">No water entries yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add your first monthly water entry to start tracking BRSR Principle 6 water disclosures.</p>
            <button onClick={openAdd} className="mt-4 inline-flex rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors">
              + Add first entry
            </button>
          </div>
        ) : entries.length > 0 && (
          <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Period','Source','Withdrawn (kL)','Consumed (kL)','Discharged (kL)','CO₂e (kg)','Factor','Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-800 font-medium">{MONTHS[e.period_month-1]} {e.period_year}</td>
                    <td className="px-4 py-2.5 text-slate-600">{SOURCE_LABELS[e.source_type] ?? e.source_type}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.volume_withdrawn_kl.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.volume_consumed_kl.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.volume_discharged_kl.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium">{e.co2e_kg.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-[10px]">{e.ef_version}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="text-slate-500 hover:text-slate-800 transition-colors text-[11px] underline underline-offset-2">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 transition-colors text-[11px] underline underline-offset-2">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
