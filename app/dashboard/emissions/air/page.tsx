// app/dashboard/emissions/air/page.tsx
//
// Feature 1.7 — Air emissions disclosure (India opt-in)
//
// Annual disclosure only — one entry per financial year per account.
// Fields: NOx, SOx, Particulate Matter (all in tonnes), plus optional
// other pollutant.
//
// NO CO2e calculation — BRSR requires raw tonnes only.
// Submitting a second entry for the same FY updates the existing row
// (UNIQUE constraint on account_id + period_year enforces this).

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { getFinancialYear } from '@/lib/financialYear';

type AirEntry = {
  id: string;
  period_year: number;
  nox_tonnes: number | null;
  sox_tonnes: number | null;
  pm_tonnes: number | null;
  other_pollutant_name: string | null;
  other_pollutant_tonnes: number | null;
  data_source: string;
};

const EMPTY_FORM = {
  period_year:            new Date().getFullYear(),
  nox_tonnes:             '',
  sox_tonnes:             '',
  pm_tonnes:              '',
  other_pollutant_name:   '',
  other_pollutant_tonnes: '',
};

// Current India FY start year (April-based)
function currentIndiaFYStartYear(): number {
  const fy = getFinancialYear(4); // April start
  return fy.start.getFullYear();
}

export default function AirEmissionsPage() {
  const router = useRouter();
  const [entries, setEntries]   = useState<AirEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM, period_year: currentIndiaFYStartYear() });
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country, india_air_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN' || !profile?.india_air_enabled) {
        router.push('/dashboard');
        return;
      }

      const { data } = await supabase
        .from('air_emissions')
        .select('*')
        .eq('account_id', user.id)
        .order('period_year', { ascending: false });

      setEntries(data ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, period_year: currentIndiaFYStartYear() });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(entry: AirEntry) {
    setForm({
      period_year:            entry.period_year,
      nox_tonnes:             entry.nox_tonnes?.toString() ?? '',
      sox_tonnes:             entry.sox_tonnes?.toString() ?? '',
      pm_tonnes:              entry.pm_tonnes?.toString() ?? '',
      other_pollutant_name:   entry.other_pollutant_name ?? '',
      other_pollutant_tonnes: entry.other_pollutant_tonnes?.toString() ?? '',
    });
    setEditId(entry.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      account_id:             user.id,
      period_year:            Number(form.period_year),
      nox_tonnes:             form.nox_tonnes             ? parseFloat(form.nox_tonnes as string)             : null,
      sox_tonnes:             form.sox_tonnes             ? parseFloat(form.sox_tonnes as string)             : null,
      pm_tonnes:              form.pm_tonnes              ? parseFloat(form.pm_tonnes as string)              : null,
      other_pollutant_name:   form.other_pollutant_name   || null,
      other_pollutant_tonnes: form.other_pollutant_tonnes ? parseFloat(form.other_pollutant_tonnes as string) : null,
      data_source: 'manual',
      created_by:  user.id,
      // NO co2e column — spec explicitly forbids it for air emissions
    };

    // Upsert: one row per FY per account (UNIQUE constraint handles dedup)
    const { error: dbError } = await supabase
      .from('air_emissions')
      .upsert(payload, { onConflict: 'account_id,period_year' });

    setSaving(false);

    if (dbError) { setError(dbError.message); return; }

    await logActivity(editId ? 'update' : 'create', 'air_emission', {
      period_year: form.period_year,
      nox_tonnes: payload.nox_tonnes,
      sox_tonnes: payload.sox_tonnes,
      pm_tonnes:  payload.pm_tonnes,
      data_source: 'manual',
    });

    const { data } = await supabase
      .from('air_emissions').select('*').eq('account_id', user.id)
      .order('period_year', { ascending: false });
    setEntries(data ?? []);
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this air emissions entry?')) return;
    await supabase.from('air_emissions').delete().eq('id', id);
    await logActivity('delete', 'air_emission', { entry_id: id });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
          {[1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-white border shadow" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
              Dashboard
            </Link>
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">BRSR · Air</span>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors">
            + Add air emissions
          </button>
        </div>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Air Emissions Disclosure</h1>
          <p className="text-sm text-slate-600 mt-1">
            Log annual NOx, SOx, and Particulate Matter for BRSR Principle 6 disclosure.
            One entry per financial year. Values are stored in tonnes exactly as entered — no CO₂e conversion.
          </p>
        </header>

        {showForm && (
          <div className="rounded-xl bg-white border border-emerald-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{editId ? 'Edit air emissions' : 'Add air emissions'}</h2>
              <span className="text-[11px] text-slate-400 bg-slate-50 border rounded-full px-2 py-0.5">Annual — one entry per FY</span>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Financial year start (e.g. 2025 for FY 2025-26)</label>
                <input type="number" className="mt-1 w-40 rounded-lg border px-3 py-2 text-sm" value={form.period_year} onChange={(e) => update('period_year', Number(e.target.value))} min="2000" max="2100" />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  FY {form.period_year}-{String(Number(form.period_year)+1).slice(-2)} (April–March)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'nox_tonnes', label: 'NOx (tonnes)' },
                  { key: 'sox_tonnes', label: 'SOx (tonnes)' },
                  { key: 'pm_tonnes',  label: 'Particulate Matter (tonnes)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-700">{label}</label>
                    <input
                      type="number" min="0" step="0.0001"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="0.0000"
                      value={form[key as keyof typeof form] as string}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Other pollutant (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600">Pollutant name</label>
                    <input type="text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. VOC" value={form.other_pollutant_name} onChange={(e) => update('other_pollutant_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Quantity (tonnes)</label>
                    <input type="number" min="0" step="0.0001" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0.0000" value={form.other_pollutant_tonnes} onChange={(e) => update('other_pollutant_tonnes', e.target.value)} />
                  </div>
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
            <p className="text-sm font-medium text-slate-800">No air emission disclosures yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add annual NOx, SOx, and PM data for BRSR Principle 6 compliance.</p>
            <button onClick={openAdd} className="mt-4 inline-flex rounded-full bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-800 transition-colors">
              + Add first entry
            </button>
          </div>
        ) : entries.length > 0 && (
          <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Financial Year','NOx (t)','SOx (t)','PM (t)','Other pollutant','Source','Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">FY {e.period_year}-{String(e.period_year+1).slice(-2)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.nox_tonnes ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.sox_tonnes ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.pm_tonnes  ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {e.other_pollutant_name ? `${e.other_pollutant_name}: ${e.other_pollutant_tonnes}t` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-[10px]">Manually entered</td>
                    <td className="px-4 py-2.5">
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
