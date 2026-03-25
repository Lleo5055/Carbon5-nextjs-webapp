'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

// ─── Supported countries (ISO 3166-1 alpha-2) ────────────────────────────────
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

// ─── Country-aware compliance config ─────────────────────────────────────────
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
  // Default — no country selected
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

const PROFILE_CACHE_KEY = 'greenio_profile_cache';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    country: '',
    city: '',
    address: '',
    postcode: '',
    company_size: '',
    secr_required: false,
    data_confirmed_by_user: false,
    sustainability_stage: '',
    contact_name: '',
    contact_email: '',
    has_company_vehicles: false,
    renewable_energy_tariff: false,
    annual_revenue: '',
    employee_count: '',
    annual_output_units: '',
    methodology_confirmed: false,
    energy_efficiency_actions: '',
  });

  // Seed from cache for instant paint
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

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      setUserId(userId);

      // Check if this user is a team member
      const { data: memberRow } = await supabase
        .from('team_members')
        .select('owner_id')
        .eq('member_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      const profileOwnerId = memberRow ? memberRow.owner_id : userId;
      if (memberRow) setIsTeamMember(true);

      // Load the owner's profile (or own profile if owner)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileOwnerId)
        .single();

      // For team members, also load their own contact details if they exist
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
      // Team members can only update their own contact details
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
      const { error: e } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);
      error = e;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      alert('Failed to save profile.');
      return;
    }

    alert('Profile updated successfully.');
  }

  const compliance = getComplianceConfig(form.country);
  // Shorthand: apply to all company-detail inputs when user is a team member
  const roClass = isTeamMember ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : '';

  if (loading) return <p className="p-6">Loading profile...</p>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          ← Dashboard
        </a>
      </div>

      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          {isTeamMember ? 'Viewing your organisation profile.' : 'Update your company information at any time.'}
        </p>

        {isTeamMember && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
            You are viewing your organisation's profile. Company details are managed by the account owner.
            Only your personal contact details can be edited.
          </div>
        )}

        <form
          onSubmit={saveProfile}
          className="mt-8 space-y-8 rounded-xl bg-white p-6 shadow border border-slate-200"
        >
          {/* COMPANY DETAILS */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Company details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Company name</label>
                <input
                  type="text"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.company_name}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('company_name', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Industry</label>
                <select
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.industry}
                  disabled={isTeamMember}
                  onChange={(e) => updateField('industry', e.target.value)}
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Country</label>
                  <select
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                    value={form.country}
                    disabled={isTeamMember}
                    onChange={(e) => updateField('country', e.target.value)}
                    required={!isTeamMember}
                  >
                    <option value="">Select country…</option>
                    {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    Used to apply the correct emission factors to your data.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">City</label>
                  <input
                    type="text"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                    value={form.city}
                    readOnly={isTeamMember}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Address</label>
                <input
                  type="text"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.address}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  {compliance.postcodeLabel}
                </label>
                <input
                  type="text"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.postcode}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('postcode', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ORG SIZE */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Organisation scale
            </h2>
            <select
              className={`w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
              value={form.company_size}
              disabled={isTeamMember}
              onChange={(e) => updateField('company_size', e.target.value)}
            >
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
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.secr_required}
                    disabled={isTeamMember}
                    onChange={(e) => updateField('secr_required', e.target.checked)}
                  />
                  <span>
                    {compliance.checkboxLabel}
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {compliance.description}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-slate-400">{compliance.description}</p>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.data_confirmed_by_user}
                  disabled={isTeamMember}
                  onChange={(e) => updateField('data_confirmed_by_user', e.target.checked)}
                />
                I confirm the provided information is accurate.
              </label>
            </div>
          </section>

          {/* REGULATORY REPORTING — title + fields adapt per country */}
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
                <label className="text-xs font-medium text-slate-600">
                  {compliance.revenueLabel}
                </label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.annual_revenue}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('annual_revenue', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Number of employees</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.employee_count}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('employee_count', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Annual output units (optional)</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
                  value={form.annual_output_units}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('annual_output_units', e.target.value)}
                />
              </div>
            </div>

            {compliance.showEnergyActions && (
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">
                  {compliance.energyActionsLabel}
                </label>
                <textarea
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm h-24 ${roClass}`}
                  value={form.energy_efficiency_actions}
                  readOnly={isTeamMember}
                  onChange={(e) => updateField('energy_efficiency_actions', e.target.value)}
                  placeholder="Describe any actions taken to reduce energy use (required for SECR)."
                />
              </div>
            )}

            <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Methodology used for reporting:</strong>
                <br />
                {compliance.methodologyNote}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 mt-4">
              <input
                type="checkbox"
                checked={form.methodology_confirmed}
                disabled={isTeamMember}
                onChange={(e) => updateField('methodology_confirmed', e.target.checked)}
              />
              I confirm that the calculation methodology used is correct.
            </label>
          </section>

          {/* SUSTAINABILITY */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Sustainability & Operations
            </h2>
            <select
              className={`w-full rounded-lg border px-3 py-2 text-sm ${roClass}`}
              value={form.sustainability_stage}
              disabled={isTeamMember}
              onChange={(e) => updateField('sustainability_stage', e.target.value)}
            >
              <option value="">Select stage…</option>
              <option value="early">Early</option>
              <option value="progressing">Progressing</option>
              <option value="advanced">Advanced</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-3">
              <input
                type="checkbox"
                checked={form.has_company_vehicles}
                disabled={isTeamMember}
                onChange={(e) => updateField('has_company_vehicles', e.target.checked)}
              />
              We operate company-owned vehicles.
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
              <input
                type="checkbox"
                checked={form.renewable_energy_tariff}
                disabled={isTeamMember}
                onChange={(e) => updateField('renewable_energy_tariff', e.target.checked)}
              />
              We use a renewable electricity tariff.
            </label>
          </section>

          {/* CONTACT */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Contact details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Contact name</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Contact email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isTeamMember ? 'Save contact details' : 'Save changes'}
          </button>
        </form>

        {/* Delete account — owners only */}
        {!isTeamMember && <div id="delete" className="mt-10 rounded-xl border border-red-100 bg-red-50 p-6">
          <h2 className="text-sm font-semibold text-red-700 mb-1">Delete account</h2>
          <p className="text-xs text-red-600 mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white transition-colors"
          >
            Delete my account
          </button>
        </div>}

      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete your account?</h2>
            <p className="text-sm text-slate-500 mb-4">
              This will permanently delete all your emissions data, reports, and account. This cannot be undone.
            </p>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Type <span className="font-mono bg-slate-100 px-1 rounded">DELETE</span> to confirm
            </p>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirm !== 'DELETE' || deleting}
                onClick={async () => {
                  if (!userId) return;
                  setDeleting(true);
                  const res = await fetch('/api/account/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                  });
                  if (res.ok) {
                    await supabase.auth.signOut();
                    router.push('/');
                  } else {
                    alert('Failed to delete account. Please contact hello@greenio.co');
                    setDeleting(false);
                  }
                }}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
