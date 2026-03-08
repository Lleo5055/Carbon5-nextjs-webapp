// app/dashboard/emissions/waste/page.tsx
//
// Feature 1.6 — Waste tracking (India opt-in, BRSR-specific)
//
// NOTE: This is distinct from Scope 3 waste categories.
// This page tracks the BRSR Principle 6 waste breakdown:
//   landfill, recycled, incinerated, hazardous.
//
// CO2e is calculated ONLY for landfill waste: landfill_kg * 0.587
// Recycled/incinerated/hazardous are stored as-is — no CO2e conversion.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';

const LANDFILL_EF = 0.587; // kgCO2e per kg landfill waste (DEFRA 2024)
const EF_CATEGORY = 'waste';

type WasteEntry = {
  id: string;
  period_month: number;
  period_year: number;
  total_kg: number;
  landfill_kg: number;
  recycled_kg: number;
  incinerated_kg: number;
  hazardous_kg: number;
  co2e_kg: number;
  ef_version: string;
  data_source: string;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMPTY_FORM = {
  period_month:   new Date().getMonth() + 1,
  period_year:    new Date().getFullYear(),
  total_kg:       '',
  landfill_kg:    '',
  recycled_kg:    '',
  incinerated_kg: '',
  hazardous_kg:   '',
};

export default function WasteTrackingPage() {
  const router = useRouter();
  const [entries, setEntries]   = useState<WasteEntry[]>([]);
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('country, india_waste_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN' || !profile?.india_waste_enabled) {
        router.push('/dashboard');
        return;
      }

      const { data: efRow } = await supabase
        .from('emission_factor_versions')
        .select('version_key')
        .eq('category', EF_CATEGORY)
        .is('valid_to', null)
        .maybeSingle();
      setEfVersion(efRow?.version_key ?? null);

      const { data } = await supabase
        .from('waste_entries')
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

  function openEdit(entry: WasteEntry) {
    setForm({
      period_month:   entry.period_month,
      period_year:    entry.period_year,
      total_kg:       entry.total_kg.toString(),
      landfill_kg:    entry.landfill_kg.toString(),
      recycled_kg:    entry.recycled_kg.toString(),
      incinerated_kg: entry.incinerated_kg.toString(),
      hazardous_kg:   entry.hazardous_kg.toString(),
    });
    setEditId(entry.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!efVersion) {
      setError('No active waste emission factor found. Contact support.');
      return;
    }

    const landfill = parseFloat(form.landfill_kg as string) || 0;
    const co2e_kg  = parseFloat((landfill * LANDFILL_EF).toFixed(3));

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      account_id:     user.id,
      period_month:   Number(form.period_month),
      period_year:    Number(form.period_year),
      total_kg:       parseFloat(form.total_kg as string) || 0,
      landfill_kg:    landfill,
      recycled_kg:    parseFloat(form.recycled_kg as string)    || 0,
      incinerated_kg: parseFloat(form.incinerated_kg as string) || 0,
      hazardous_kg:   parseFloat(form.hazardous_kg as string)   || 0,
      co2e_kg,
      data_source: 'manual',
      ef_version:  efVersion,
      created_by:  user.id,
    };

    let dbError = null;
    if (editId) {
      const { error } = await supabase.from('waste_entries').update(payload).eq('id', editId);
      dbError = error;
      if (!error) {
        await logActivity('update', 'waste_entry', {
          entry_id: editId,
          period: `${form.period_year}-${String(form.period_month).padStart(2,'0')}`,
          landfill_kg: landfill, co2e_kg, ef_version: efVersion, data_source: 'manual',
        });
      }
    } else {
      const { error } = await supabase.from('waste_entries').insert(payload);
      dbError = error;
      if (!error) {
        await logActivity('create', 'waste_entry', {
          period: `${form.period_year}-${String(form.period_month).padStart(2,'0')}`,
          landfill_kg: landfill, co2e_kg, ef_version: efVersion, data_source: 'manual',
        });
      }
    }

    setSaving(false);
    if (dbError) { setError(dbError.message); return; }

    const { data } = await supabase
      .from('waste_entries').select('*').eq('account_id', user.id)
      .order('period_year', { ascending: false }).order('period_month', { ascending: false });
    setEntries(data ?? []);
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this waste entry?')) return;
    await supabase.from('waste_entries').delete().eq('id', id);
    await logActivity('delete', 'waste_entry', { entry_id: id });
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

  const totalLandfill = entries.reduce((s, e) => s + e.landfill_kg, 0);
  const totalRecycled = entries.reduce((s, e) => s + e.recycled_kg, 0);
  const totalCo2e     = entries.reduce((s, e) => s + e.co2e_kg, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
              Dashboard
            </Link>
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">BRSR · Waste</span>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors">
            + Add waste entry
          </button>
        </div>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Waste Tracking</h1>
          <p className="text-sm text-slate-600 mt-1">Log monthly waste generation and disposal breakdown for BRSR Principle 6 disclosure.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            CO₂e calculated for landfill only ({LANDFILL_EF} kgCO₂e/kg) · {efVersion}
          </p>
        </header>

        {entries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total to landfill</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalLandfill.toLocaleString('en-IN')} kg</p>
            </div>
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total recycled</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalRecycled.toLocaleString('en-IN')} kg</p>
            </div>
            <div className="rounded-xl bg-white border p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Landfill CO₂e</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalCo2e.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Disclosed separately — not in Scope 1/2/3 totals</p>
            </div>
          </div>
        )}

        {showForm && (
          <div className="rounded-xl bg-white border border-emerald-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{editId ? 'Edit waste entry' : 'Add waste entry'}</h2>
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
                <label className="text-xs font-medium text-slate-700">Total waste generated (kg) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.total_kg} onChange={(e) => update('total_kg', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Sent to landfill (kg)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.landfill_kg} onChange={(e) => update('landfill_kg', e.target.value)} />
                  {form.landfill_kg && parseFloat(form.landfill_kg as string) > 0 && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      CO₂e: {(parseFloat(form.landfill_kg as string) * LANDFILL_EF).toFixed(2)} kg
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Recycled (kg)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.recycled_kg} onChange={(e) => update('recycled_kg', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Incinerated (kg)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.incinerated_kg} onChange={(e) => update('incinerated_kg', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Hazardous (kg)</label>
                  <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" value={form.hazardous_kg} onChange={(e) => update('hazardous_kg', e.target.value)} />
                </div>
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

        {entries.length === 0 && !showForm ? (
          <div className="rounded-xl bg-white border p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-800">No waste entries yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add monthly waste data for BRSR Principle 6 disclosure. CO₂e is calculated for landfill waste only.</p>
            <button onClick={openAdd} className="mt-4 inline-flex rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors">
              + Add first entry
            </button>
          </div>
        ) : entries.length > 0 && (
          <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Period','Total (kg)','Landfill (kg)','Recycled (kg)','Incinerated (kg)','Hazardous (kg)','CO₂e (kg)','Factor','Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{MONTHS[e.period_month-1]} {e.period_year}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.total_kg.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.landfill_kg.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.recycled_kg.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.incinerated_kg.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.hazardous_kg.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{e.co2e_kg.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-[10px]">{e.ef_version}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="text-slate-500 hover:text-slate-800 text-[11px] underline underline-offset-2">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 text-[11px] underline underline-offset-2">Delete</button>
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
