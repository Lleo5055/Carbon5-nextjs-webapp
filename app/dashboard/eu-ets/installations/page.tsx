'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const EU_COUNTRIES_SET = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

const ACTIVITY_TYPES = [
  { value: 'combustion', label: 'Combustion' },
  { value: 'refining', label: 'Oil Refining' },
  { value: 'steel', label: 'Iron & Steel' },
  { value: 'cement', label: 'Cement & Lime' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'paper', label: 'Paper & Pulp' },
  { value: 'aviation', label: 'Aviation' },
  { value: 'other', label: 'Other' },
];

const MONITORING_METHODS = [
  { value: 'calculation', label: 'Calculation-based' },
  { value: 'measurement', label: 'Measurement-based' },
];

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

type FormState = {
  installation_name: string;
  permit_number: string;
  activity_type: string;
  thermal_input_mw: string;
  address: string;
  postcode: string;
  monitoring_methodology: string;
  monitoring_plan_version: string;
  monitoring_plan_approved_date: string;
  operator_holding_account: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  installation_name: '',
  permit_number: '',
  activity_type: '',
  thermal_input_mw: '',
  address: '',
  postcode: '',
  monitoring_methodology: 'calculation',
  monitoring_plan_version: '',
  monitoring_plan_approved_date: '',
  operator_holding_account: '',
  is_active: true,
};

export default function EUETSInstallationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (!EU_COUNTRIES_SET.has(profile?.country ?? '')) { router.push('/dashboard'); return; }

      const { data } = await supabase
        .from('eu_ets_installations')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });

      setInstallations(data ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function startAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(inst: Installation) {
    setForm({
      installation_name: inst.installation_name,
      permit_number: inst.permit_number,
      activity_type: inst.activity_type,
      thermal_input_mw: inst.thermal_input_mw != null ? String(inst.thermal_input_mw) : '',
      address: inst.address ?? '',
      postcode: inst.postcode ?? '',
      monitoring_methodology: inst.monitoring_methodology ?? 'calculation',
      monitoring_plan_version: inst.monitoring_plan_version ?? '',
      monitoring_plan_approved_date: inst.monitoring_plan_approved_date ?? '',
      operator_holding_account: inst.operator_holding_account ?? '',
      is_active: inst.is_active,
    });
    setEditingId(inst.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      profile_id: user.id,
      installation_name: form.installation_name.trim(),
      permit_number: form.permit_number.trim(),
      activity_type: form.activity_type,
      thermal_input_mw: form.thermal_input_mw ? Number(form.thermal_input_mw) : null,
      address: form.address.trim() || null,
      postcode: form.postcode.trim() || null,
      monitoring_methodology: form.monitoring_methodology || null,
      monitoring_plan_version: form.monitoring_plan_version.trim() || null,
      monitoring_plan_approved_date: form.monitoring_plan_approved_date || null,
      operator_holding_account: form.operator_holding_account.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let err = null;
    if (editingId) {
      const { error: e } = await supabase.from('eu_ets_installations').update(payload).eq('id', editingId);
      err = e;
    } else {
      const { error: e } = await supabase.from('eu_ets_installations').insert(payload);
      err = e;
    }

    setSaving(false);
    if (err) { setError(err.message); return; }

    // Refresh
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data } = await supabase.from('eu_ets_installations').select('*').eq('profile_id', u.id).order('created_at', { ascending: false });
      setInstallations(data ?? []);
    }

    setSaved(true);
    setShowForm(false);
    setEditingId(null);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('eu_ets_installations').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setInstallations(prev => prev.filter(i => i.id !== id));
    setDeletingId(null);
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
            <Link href="/dashboard/eu-ets" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              ← EU ETS
            </Link>
          </div>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">UK ETS</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Installations</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your permitted UK ETS installations. Each installation requires its own Annual Emissions Report and allowance reconciliation.</p>
        </div>

        {/* List or empty state */}
        {installations.length === 0 && !showForm ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">No installations added yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add each installation that holds a UK ETS permit.</p>
            <button onClick={startAdd} className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800">
              + Add installation
            </button>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{installations.length} installation{installations.length !== 1 ? 's' : ''}</h2>
              <button onClick={startAdd} className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-1.5 hover:bg-slate-800">
                + Add installation
              </button>
            </div>

            {installations.map(inst => (
              <article key={inst.id} className="rounded-xl bg-white border border-slate-200 p-5 shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/eu-ets/installations/${inst.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 underline underline-offset-2">
                        {inst.installation_name}
                      </Link>
                      {!inst.is_active && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-medium">Inactive</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Permit: <span className="font-mono">{inst.permit_number}</span></p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(inst)} className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2">Edit</button>
                    {deletingId === inst.id ? (
                      <span className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500">Delete?</span>
                        <button onClick={() => handleDelete(inst.id)} className="font-semibold text-rose-600 hover:text-rose-800">Yes</button>
                        <button onClick={() => setDeletingId(null)} className="text-slate-400 hover:text-slate-600">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingId(inst.id)} className="text-xs text-rose-400 hover:text-rose-600 underline underline-offset-2">Delete</button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Activity type</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{inst.activity_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Monitoring method</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{inst.monitoring_methodology ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Thermal input</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{inst.thermal_input_mw != null ? `${inst.thermal_input_mw} MW` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Holding account</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono text-[11px]">{inst.operator_holding_account ?? '—'}</p>
                  </div>
                </div>

                {inst.address && (
                  <p className="mt-3 text-[10px] text-slate-400">{inst.address}{inst.postcode ? `, ${inst.postcode}` : ''}</p>
                )}

                <div className="mt-3">
                  <Link href={`/dashboard/eu-ets/installations/${inst.id}`} className="text-[11px] text-blue-600 hover:underline underline-offset-2">
                    View details, emissions &amp; verification →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <section className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit installation' : 'Add installation'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-xs text-slate-400 hover:text-slate-700">
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Installation name <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.installation_name} onChange={e => update('installation_name', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="e.g. Acme Energy Plant 1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Permit number <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.permit_number} onChange={e => update('permit_number', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono" placeholder="e.g. UK-ETS-INST-000001" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Activity type <span className="text-red-500">*</span></label>
                  <select required value={form.activity_type} onChange={e => update('activity_type', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                    <option value="">Select activity…</option>
                    {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Thermal input (MW)</label>
                  <input type="number" step="0.01" min="0" value={form.thermal_input_mw} onChange={e => update('thermal_input_mw', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="e.g. 25.5" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Required if combustion installation</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Monitoring methodology</label>
                  <select value={form.monitoring_methodology} onChange={e => update('monitoring_methodology', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white">
                    {MONITORING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Monitoring plan version</label>
                  <input type="text" value={form.monitoring_plan_version} onChange={e => update('monitoring_plan_version', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="e.g. v3.1" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Monitoring plan approved date</label>
                  <input type="date" value={form.monitoring_plan_approved_date} onChange={e => update('monitoring_plan_approved_date', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Operator holding account</label>
                  <input type="text" value={form.operator_holding_account} onChange={e => update('operator_holding_account', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono" placeholder="UK Registry account number" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Address</label>
                  <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="Installation site address" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Postcode</label>
                  <input type="text" value={form.postcode} onChange={e => update('postcode', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" placeholder="e.g. SW1A 1AA" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => update('is_active', e.target.checked)}
                  className="accent-emerald-600"
                />
                <label htmlFor="is_active" className="text-xs font-medium text-slate-700 cursor-pointer">Installation is currently active and operating</label>
              </div>

              {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button type="submit" disabled={saving} className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : editingId ? 'Update installation' : 'Save installation'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

      </div>
    </main>
  );
}