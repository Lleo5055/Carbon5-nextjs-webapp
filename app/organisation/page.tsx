'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ─── Supported countries ──────────────────────────────────────────────────────
const SUPPORTED_COUNTRIES = [
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'IN', label: 'India' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'GB', label: 'United Kingdom' },
];

const INDUSTRIES = [
  'Agriculture & Farming', 'Construction', 'Education', 'Financial Services',
  'Food & Beverage', 'Healthcare', 'Hospitality & Tourism', 'IT & Technology',
  'Logistics & Transport', 'Manufacturing', 'Professional Services', 'Real Estate',
  'Retail', 'Utilities & Energy', 'Waste Management', 'Other',
];

const EU_COUNTRIES = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

type ComplianceConfig = {
  framework: string;
  checkboxLabel: string;
  description: string;
  sectionTitle: string;
  currency: string;
  revenueLabel: string;
  postcodeLabel: string;
  showEnergyActions: boolean;
  energyActionsLabel: string;
  methodologyNote: string;
};

function getComplianceConfig(country: string): ComplianceConfig {
  if (country === 'GB') return {
    framework: 'SECR',
    checkboxLabel: 'My company is required to comply with SECR (Streamlined Energy and Carbon Reporting).',
    description: 'Required for large UK companies (250+ employees or £36M+ turnover).',
    sectionTitle: 'SECR reporting',
    currency: '£',
    revenueLabel: 'Annual revenue (£)',
    postcodeLabel: 'Postcode',
    showEnergyActions: true,
    energyActionsLabel: 'Energy efficiency actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to BEIS/DEFRA official sources. Electricity uses location-based grid factors; fuel emissions use DEFRA 2025 kg CO₂e per litre values. UK accounts align with SECR reporting guidance.',
  };
  if (EU_COUNTRIES.has(country)) return {
    framework: 'CSRD',
    checkboxLabel: 'My company is required to comply with CSRD (Corporate Sustainability Reporting Directive).',
    description: 'Applies to large EU companies (250+ employees or €40M+ net turnover).',
    sectionTitle: 'CSRD reporting',
    currency: '€',
    revenueLabel: 'Annual revenue (€)',
    postcodeLabel: 'Postal code',
    showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to Eurostat and IEA official sources. Electricity uses location-based grid factors per country; fuel emissions use standard 2025 kg CO₂e per litre values.',
  };
  if (country === 'IN') return {
    framework: 'BRSR',
    checkboxLabel: 'My company is required to comply with BRSR (Business Responsibility and Sustainability Report).',
    description: 'Mandatory for top 1,000 listed Indian companies under SEBI regulations.',
    sectionTitle: 'BRSR reporting',
    currency: '₹',
    revenueLabel: 'Annual revenue (₹)',
    postcodeLabel: 'PIN code',
    showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: "Greenio uses geo-optimised emission factors aligned to CEA/IEA official sources. Electricity uses India's national grid factor (CEA 2025); fuel emissions use standard kg CO₂e per litre values.",
  };
  return {
    framework: '',
    checkboxLabel: 'My company is subject to mandatory sustainability reporting.',
    description: 'Select a country above to see applicable compliance frameworks.',
    sectionTitle: 'Regulatory reporting',
    currency: '',
    revenueLabel: 'Annual revenue',
    postcodeLabel: 'Postcode / ZIP / PIN',
    showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to official sources per country (Eurostat, BEIS/DEFRA, CEA/IEA). Electricity uses location-based grid factors; fuel emissions use standard kg CO₂e per litre values.',
  };
}

// ─── Activity types ───────────────────────────────────────────────────────────
type ActivityRow = {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  resource: string;
  detail: Record<string, any>;
  created_at: string;
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtDetail(action: string, detail: Record<string, any>): string {
  if (action === 'create') {
    const parts: string[] = [];
    if (detail.electricity_kwh) parts.push(`${Number(detail.electricity_kwh).toLocaleString()} kWh electricity`);
    if (detail.diesel_l) parts.push(`${Number(detail.diesel_l).toLocaleString()} L diesel`);
    if (detail.petrol_l) parts.push(`${Number(detail.petrol_l).toLocaleString()} L petrol`);
    if (detail.gas_kwh) parts.push(`${Number(detail.gas_kwh).toLocaleString()} kWh gas`);
    if (detail.refrigerant_kg) parts.push(`${Number(detail.refrigerant_kg).toLocaleString()} kg refrigerant`);
    const co2 = detail.co2e_kg ? ` — ${Number(detail.co2e_kg).toLocaleString()} kg CO₂e` : '';
    return parts.join(', ') + co2;
  }
  if (action === 'update') {
    const changes = detail.changes as Record<string, { from: number; to: number }> | undefined;
    if (!changes) return '';
    const LABELS: Record<string, string> = {
      electricity_kwh: 'electricity (kWh)',
      diesel_l: 'diesel (L)',
      petrol_l: 'petrol (L)',
      gas_kwh: 'gas (kWh)',
      refrigerant_kg: 'refrigerant (kg)',
      co2e_kg: 'CO₂e (kg)',
    };
    return Object.entries(changes)
      .map(([k, v]) => `${LABELS[k] ?? k}: ${Number(v.from).toLocaleString()} → ${Number(v.to).toLocaleString()}`)
      .join(' · ');
  }
  if (action === 'delete') {
    return detail.co2e_kg ? `${Number(detail.co2e_kg).toLocaleString()} kg CO₂e` : '';
  }
  if (action === 'export_pdf') {
    return detail.period ? String(detail.period) : '';
  }
  if (action === 'export_csv' || action === 'export_xls' || action === 'snapshot' || action === 'export_ccts_pkg') {
    return detail.period ? String(detail.period) : '';
  }
  if (action === 'bulk_upload' || action === 'bulk_update') {
    return detail.month ? String(detail.month) : '';
  }
  if (action === 'tally_import') {
    return detail.month ? String(detail.month) : '';
  }
  if (action === 'production_output') {
    return detail.month && detail.quantity
      ? `${detail.month} — ${Number(detail.quantity).toLocaleString()} ${detail.unit ?? 'units'}`
      : detail.month ? String(detail.month) : '';
  }
  return '';
}

function actionLabel(action: string): { label: string; color: string } {
  switch (action) {
    case 'create':              return { label: 'Added emission',        color: 'bg-emerald-100 text-emerald-700' };
    case 'update':              return { label: 'Edited emission',       color: 'bg-amber-100 text-amber-700' };
    case 'delete':              return { label: 'Deleted emission',      color: 'bg-rose-100 text-rose-700' };
    case 'bulk_upload':         return { label: 'Bulk uploaded',         color: 'bg-emerald-100 text-emerald-700' };
    case 'bulk_update':         return { label: 'Bulk consolidated',     color: 'bg-amber-100 text-amber-700' };
    case 'tally_import':        return { label: 'Tally import applied',  color: 'bg-violet-100 text-violet-700' };
    case 'production_output':   return { label: 'Production output',     color: 'bg-cyan-100 text-cyan-700' };
    case 'export_csv':          return { label: 'Exported CSV',          color: 'bg-blue-100 text-blue-700' };
    case 'export_xls':          return { label: 'Exported Excel',        color: 'bg-blue-100 text-blue-700' };
    case 'export_ccts_pkg':     return { label: 'CCTS package exported', color: 'bg-blue-100 text-blue-700' };
    case 'snapshot':            return { label: 'Downloaded Snapshot',   color: 'bg-purple-100 text-purple-700' };
    case 'export_pdf':          return { label: 'Downloaded Report',     color: 'bg-indigo-100 text-indigo-700' };
    default:                    return { label: action,                  color: 'bg-slate-100 text-slate-600' };
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrganisationPage() {
  const [tab, setTab] = useState<'profile' | 'activity'>('profile');

  // ── Profile state ──────────────────────────────────────────────────────────
  const PROFILE_CACHE_KEY = 'greenio_profile_cache';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [form, setForm] = useState({
    company_name: '', industry: '', country: '', city: '', address: '', postcode: '',
    company_size: '', secr_required: false, data_confirmed_by_user: false,
    sustainability_stage: '', contact_name: '', contact_email: '',
    has_company_vehicles: false, renewable_energy_tariff: false,
    annual_revenue: '', employee_count: '', annual_output_units: '',
    methodology_confirmed: false, energy_efficiency_actions: '',
  });

  // ── Activity state ─────────────────────────────────────────────────────────
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  // Seed profile from cache for instant paint
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.form) setForm(parsed.form);
        if (parsed.isTeamMember) setIsTeamMember(true);
        setLoading(false);
      }
    } catch {}
  }, []);

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      setCurrentUserId(userId);

      const { data: memberRow } = await supabase
        .from('team_members')
        .select('owner_id')
        .eq('member_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      const profileOwnerId = memberRow ? memberRow.owner_id : userId;
      if (memberRow) setIsTeamMember(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileOwnerId)
        .single();

      let memberContact = { contact_name: '', contact_email: '' };
      if (memberRow) {
        const { data: ownProfile } = await supabase
          .from('profiles')
          .select('contact_name, contact_email')
          .eq('id', userId)
          .maybeSingle();
        if (ownProfile) {
          memberContact = {
            contact_name:  ownProfile.contact_name  || '',
            contact_email: ownProfile.contact_email || '',
          };
        }
      }

      if (profile) {
        const formData = {
          company_name:              profile.company_name              || '',
          industry:                  profile.industry                  || '',
          country:                   profile.country                   || '',
          city:                      profile.city                      || '',
          address:                   profile.address                   || '',
          postcode:                  profile.postcode                  || '',
          company_size:              profile.company_size              || '',
          secr_required:             profile.secr_required             || false,
          data_confirmed_by_user:    profile.data_confirmed_by_user    || false,
          sustainability_stage:      profile.sustainability_stage      || '',
          contact_name:              memberRow ? memberContact.contact_name  : (profile.contact_name  || ''),
          contact_email:             memberRow ? memberContact.contact_email : (profile.contact_email || ''),
          has_company_vehicles:      profile.has_company_vehicles      || false,
          renewable_energy_tariff:   profile.renewable_energy_tariff   || false,
          annual_revenue:            profile.annual_revenue            || '',
          employee_count:            profile.employee_count            || '',
          annual_output_units:       profile.annual_output_units       || '',
          methodology_confirmed:     profile.methodology_confirmed     || false,
          energy_efficiency_actions: profile.energy_efficiency_actions || '',
        };
        setForm(formData);
        try { sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ form: formData, isTeamMember: !!memberRow })); } catch {}
      }

      setLoading(false);
    }
    load();
  }, []);

  // ── Load activity ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'activity') return;
    async function loadActivity() {
      setActivityLoading(true);
      const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('activity_log')
        .select('id, actor_id, actor_name, action, resource, detail, created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      setActivityRows((data as ActivityRow[]) ?? []);
      setActivityLoading(false);
    }
    loadActivity();
  }, [tab]);

  function updateField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile(e: any) {
    e.preventDefault();
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    let error: any = null;
    if (isTeamMember) {
      const { error: e } = await supabase
        .from('profiles')
        .upsert({ id: userId, contact_name: form.contact_name, contact_email: form.contact_email });
      error = e;
    } else {
      const payload = {
        ...form,
        annual_revenue:      form.annual_revenue      ? Number(form.annual_revenue)      : null,
        employee_count:      form.employee_count      ? Number(form.employee_count)      : null,
        annual_output_units: form.annual_output_units ? Number(form.annual_output_units) : null,
      };
      const { error: e } = await supabase.from('profiles').update(payload).eq('id', userId);
      error = e;
    }

    setSaving(false);
    if (error) { console.error(error); alert('Failed to save profile.'); return; }
    alert('Profile updated successfully.');
  }

  const compliance = getComplianceConfig(form.country);
  const roClass = isTeamMember ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : '';

  // Distinct members in activity feed (for owner filter)
  const distinctMembers = Array.from(
    new Map(activityRows.map((r) => [r.actor_id, r.actor_name])).entries()
  );

  const filteredActivity = activityRows.filter((r) => {
    if (memberFilter && r.actor_id !== memberFilter) return false;
    if (actionFilter === 'emissions' && !['create','update','delete','bulk_upload','bulk_update','tally_import','production_output'].includes(r.action)) return false;
    if (actionFilter === 'exports' && !['export_csv','export_xls','export_ccts_pkg','snapshot','export_pdf'].includes(r.action)) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
          ← Dashboard
        </a>
      </div>

      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Organisation</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isTeamMember ? 'View your organisation and your activity history.' : 'Manage your organisation profile and review team activity.'}
        </p>

        {/* Tab bar */}
        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {(['profile', 'activity'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Profile tab ── */}
        {tab === 'profile' && (
          <>
            {loading ? (
              <p className="mt-8 text-sm text-slate-500">Loading profile…</p>
            ) : (
              <>
                {isTeamMember && (
                  <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
                    You are viewing your organisation's profile. Company details are managed by the account owner.
                    Only your personal contact details can be edited.
                  </div>
                )}

                <form onSubmit={saveProfile} className="mt-6 space-y-8 rounded-xl bg-white p-6 shadow border border-slate-200">

                  {/* COMPANY DETAILS */}
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Company details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Company name</label>
                        <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.company_name} readOnly={isTeamMember}
                          onChange={(e) => updateField('company_name', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Industry</label>
                        <select className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.industry} disabled={isTeamMember}
                          onChange={(e) => updateField('industry', e.target.value)}>
                          <option value="">Select industry…</option>
                          {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Country</label>
                          <select className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                            value={form.country} disabled={isTeamMember}
                            onChange={(e) => updateField('country', e.target.value)}
                            required={!isTeamMember}>
                            <option value="">Select country…</option>
                            {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                              <option key={code} value={code}>{label}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-400">Used to apply the correct emission factors.</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">City</label>
                          <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                            value={form.city} readOnly={isTeamMember}
                            onChange={(e) => updateField('city', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Address</label>
                        <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.address} readOnly={isTeamMember}
                          onChange={(e) => updateField('address', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">{compliance.postcodeLabel}</label>
                        <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.postcode} readOnly={isTeamMember}
                          onChange={(e) => updateField('postcode', e.target.value)} />
                      </div>
                    </div>
                  </section>

                  {/* ORG SIZE */}
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Organisation scale</h2>
                    <select className={`w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                      value={form.company_size} disabled={isTeamMember}
                      onChange={(e) => updateField('company_size', e.target.value)}>
                      <option value="">Select size…</option>
                      <option value="1-10">1–10 employees</option>
                      <option value="10-100">10–100 employees</option>
                      <option value="100-500">100–500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </section>

                  {/* COMPLIANCE */}
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Compliance</h2>
                    <div className="space-y-3">
                      {compliance.framework ? (
                        <label className="flex w-full items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="mt-0.5 shrink-0"
                            checked={form.secr_required} disabled={isTeamMember}
                            onChange={(e) => updateField('secr_required', e.target.checked)} />
                          <span>
                            {compliance.checkboxLabel}
                            <span className="block text-xs text-slate-400 mt-0.5">{compliance.description}</span>
                          </span>
                        </label>
                      ) : (
                        <p className="text-xs text-slate-400">{compliance.description}</p>
                      )}
                      <label className="flex w-full items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" className="shrink-0"
                          checked={form.data_confirmed_by_user} disabled={isTeamMember}
                          onChange={(e) => updateField('data_confirmed_by_user', e.target.checked)} />
                        <span>I confirm the provided information is accurate.</span>
                      </label>
                    </div>
                  </section>

                  {/* REGULATORY */}
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-slate-700">
                        {compliance.sectionTitle}
                        {compliance.framework && (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            (optional but required for {compliance.framework}-compliant reports)
                          </span>
                        )}
                      </h2>
                      {compliance.framework === 'BRSR' && (
                        <a href="/dashboard/brsr-profile" className="inline-flex items-center whitespace-nowrap rounded-full bg-red-100 border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">
                          Complete BRSR profile →
                        </a>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">{compliance.revenueLabel}</label>
                        <input type="number" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.annual_revenue} readOnly={isTeamMember}
                          onChange={(e) => updateField('annual_revenue', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Number of employees</label>
                        <input type="number" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.employee_count} readOnly={isTeamMember}
                          onChange={(e) => updateField('employee_count', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Annual output units (optional)</label>
                        <input type="number" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                          value={form.annual_output_units} readOnly={isTeamMember}
                          onChange={(e) => updateField('annual_output_units', e.target.value)} />
                      </div>
                    </div>
                    {compliance.showEnergyActions && (
                      <div className="mt-4">
                        <label className="text-xs font-medium text-slate-600">{compliance.energyActionsLabel}</label>
                        <textarea className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm h-24 ${roClass}`}
                          value={form.energy_efficiency_actions} readOnly={isTeamMember}
                          onChange={(e) => updateField('energy_efficiency_actions', e.target.value)}
                          placeholder="Describe any actions taken to reduce energy use (required for SECR)." />
                      </div>
                    )}
                    <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Methodology used for reporting:</strong><br />
                        {compliance.methodologyNote}
                      </p>
                    </div>
                    <label className="flex w-full items-center gap-2 text-sm text-slate-700 mt-4">
                      <input type="checkbox" className="shrink-0"
                        checked={form.methodology_confirmed} disabled={isTeamMember}
                        onChange={(e) => updateField('methodology_confirmed', e.target.checked)} />
                      <span>I confirm that the calculation methodology used is correct.</span>
                    </label>
                  </section>

                  {/* SUSTAINABILITY */}
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Sustainability & Operations</h2>
                    <select className={`w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                      value={form.sustainability_stage} disabled={isTeamMember}
                      onChange={(e) => updateField('sustainability_stage', e.target.value)}>
                      <option value="">Select stage…</option>
                      <option value="early">Early</option>
                      <option value="progressing">Progressing</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <label className="flex w-full items-center gap-2 text-sm text-slate-700 mt-3">
                      <input type="checkbox" className="shrink-0"
                        checked={form.has_company_vehicles} disabled={isTeamMember}
                        onChange={(e) => updateField('has_company_vehicles', e.target.checked)} />
                      <span>We operate company-owned vehicles.</span>
                    </label>
                    <label className="flex w-full items-center gap-2 text-sm text-slate-700 mt-2">
                      <input type="checkbox" className="shrink-0"
                        checked={form.renewable_energy_tariff} disabled={isTeamMember}
                        onChange={(e) => updateField('renewable_energy_tariff', e.target.checked)} />
                      <span>We use a renewable electricity tariff.</span>
                    </label>
                  </section>

                  {/* CONTACT */}
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Contact details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Contact name</label>
                        <input type="text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                          value={form.contact_name}
                          onChange={(e) => updateField('contact_name', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Contact email</label>
                        <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                          value={form.contact_email}
                          onChange={(e) => updateField('contact_email', e.target.value)} />
                      </div>
                    </div>
                  </section>

                  <button type="submit" disabled={saving}
                    className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
                    {saving ? 'Saving…' : isTeamMember ? 'Save contact details' : 'Save changes'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── Activity tab ── */}
        {tab === 'activity' && (
          <div className="mt-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {!isTeamMember && distinctMembers.length > 1 && (
                <select
                  className="rounded-lg border px-3 py-1.5 text-xs bg-white"
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                >
                  <option value="">All members</option>
                  {distinctMembers.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-1">
                {(['', 'emissions', 'exports'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setActionFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      actionFilter === f
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activityLoading ? (
              <p className="text-sm text-slate-500 py-8 text-center">Loading activity…</p>
            ) : filteredActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No activity in the last 180 days.</p>
                <p className="text-xs text-slate-400 mt-1">Actions like adding emissions, exporting reports, and downloading snapshots will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActivity.map((row) => {
                  const { label, color } = actionLabel(row.action);
                  const detail = fmtDetail(row.action, row.detail);
                  const isYou = row.actor_id === currentUserId;
                  return (
                    <div key={row.id} className="flex items-start gap-3 rounded-xl bg-white border border-slate-100 px-4 py-3 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
                            {label}
                          </span>
                          {row.detail.month && (
                            <span className="text-xs text-slate-700 font-medium">{row.detail.month}</span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {isYou ? 'You' : row.actor_name}
                          </span>
                        </div>
                        {detail && (
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{detail}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
                        {fmtRelative(row.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account deletion notice — owners only */}
      {!isTeamMember && <div className="mx-auto max-w-2xl mt-10 rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Delete your account</h2>
        <p className="text-xs text-red-600 mb-3">
          Deleting your account will permanently remove <strong>all your organisation data</strong> — including every emissions entry, Scope 3 activity, report, and team member. Your Greenio subscription will also be cancelled. <strong>This cannot be undone.</strong>
        </p>
        <a
          href="/profile#delete"
          className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition-colors"
        >
          Go to account deletion →
        </a>
      </div>}

    </main>
  );
}
