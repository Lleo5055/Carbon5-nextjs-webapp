'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { currencyCodeForCountry, localeForCountry } from '@/lib/currency';
import { fyStartMonthForCountry } from '@/lib/financialYear';

const INDUSTRIES = [
  'Agriculture & Farming',
  'Construction',
  'Education',
  'Financial Services',
  'Food & Beverage',
  'Healthcare',
  'Hospitality & Tourism',
  'IT & Technology',
  'Logistics & Transport',
  'Manufacturing',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Utilities & Energy',
  'Waste Management',
  'Other',
];

// ─── Country-specific compliance frameworks ───────────────────────────────────
const COMPLIANCE_BY_COUNTRY: Record<string, { label: string; description: string }> = {
  GB: {
    label: 'SECR (Streamlined Energy and Carbon Reporting)',
    description: 'Required for large UK companies under the Companies Act.',
  },
  AT: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  BE: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  DK: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  FR: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  DE: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  IE: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  IT: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  NL: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  PL: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  PT: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  ES: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  SE: { label: 'CSRD (Corporate Sustainability Reporting Directive)', description: 'EU mandatory sustainability disclosure for qualifying companies.' },
  IN: {
    label: 'BRSR (Business Responsibility and Sustainability Report)',
    description: 'Mandatory for top listed Indian companies under SEBI regulations.',
  },
};

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

export default function OnboardingPage() {
  const router = useRouter();

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
  });

  const [loading, setLoading] = useState(false);

  function updateField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);

    const {
      company_name,
      industry,
      country,
      city,
      address,
      postcode,
      company_size,
      secr_required,
      data_confirmed_by_user,
      sustainability_stage,
      contact_name,
      contact_email,
      has_company_vehicles,
      renewable_energy_tariff,
    } = form;

    const cleanEmail = contact_email?.trim().toLowerCase();

    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    if (!userId) {
      alert('User not found.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        company_name,
        industry,
        country,
        city,
        address,
        postcode,
        company_size,
        secr_required,
        data_confirmed_by_user,
        sustainability_stage,
        contact_name,
        contact_email: cleanEmail,
        has_company_vehicles,
        renewable_energy_tariff,
        onboarding_complete: true,
        // Feature 1.1 + 1.2: auto-set currency, locale, and FY start month
        currency:        currencyCodeForCountry(country),
        locale:          localeForCountry(country),
        fy_start_month:  fyStartMonthForCountry(country),
      });

    if (error) {
      console.error(error);
      alert('Failed to save onboarding. Check console.');
      setLoading(false);
      return;
    }

    // India accounts go to BRSR profile step before dashboard
    if (country === 'IN') {
      router.push('/dashboard/brsr-profile?onboarding=1');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Company onboarding
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Complete a few details so we can personalise your dashboard.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-8 rounded-xl bg-white p-6 shadow border border-slate-200"
        >
          {/* SECTION: Company Details */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Company details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Company name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. Green Logistics Ltd"
                  value={form.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Industry
                </label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  required
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Country
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    required
                  >
                    <option value="">Select country…</option>
                    {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    City
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. London"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Address
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. 10 Oxford Street"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Postcode
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. W1D 1NN"
                  value={form.postcode}
                  onChange={(e) => updateField('postcode', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* SECTION: Organisation scale */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Organisation scale
            </h2>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Company size
              </label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={form.company_size}
                onChange={(e) => updateField('company_size', e.target.value)}
              >
                <option value="">Select…</option>
                <option value="1-10">1–10 employees</option>
                <option value="10-100">10–100 employees</option>
                <option value="100-500">100–500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>
          </section>

          {/* SECTION: Compliance */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Compliance
            </h2>

            <div className="space-y-3">
              {form.country && COMPLIANCE_BY_COUNTRY[form.country] ? (
                <div>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.secr_required}
                      onChange={(e) =>
                        updateField('secr_required', e.target.checked)
                      }
                    />
                    <span>
                      My company is required to comply with{' '}
                      <strong>{COMPLIANCE_BY_COUNTRY[form.country].label}</strong>.
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {COMPLIANCE_BY_COUNTRY[form.country].description}
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Select a country above to see applicable compliance frameworks.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.data_confirmed_by_user}
                  onChange={(e) =>
                    updateField('data_confirmed_by_user', e.target.checked)
                  }
                />
                I confirm that provided information is accurate.
              </label>
            </div>
          </section>

          {/* SECTION: Sustainability */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Sustainability & Operations
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Sustainability stage
                </label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.sustainability_stage}
                  onChange={(e) =>
                    updateField('sustainability_stage', e.target.value)
                  }
                >
                  <option value="">Select…</option>
                  <option value="early">Early stage</option>
                  <option value="progressing">Progressing</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.has_company_vehicles}
                  onChange={(e) =>
                    updateField('has_company_vehicles', e.target.checked)
                  }
                />
                We operate company-owned vehicles.
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.renewable_energy_tariff}
                  onChange={(e) =>
                    updateField('renewable_energy_tariff', e.target.checked)
                  }
                />
                We are on a renewable electricity tariff.
              </label>
            </div>
          </section>

          {/* SECTION: Contact */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Contact details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Contact name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. John Smith"
                  value={form.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Contact email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. john@company.com"
                  value={form.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* SUBMIT */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save & go to dashboard →'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}