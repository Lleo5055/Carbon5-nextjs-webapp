'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true); // for initial check
  const [saving, setSaving] = useState(false);

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

  // Load profile and check onboarding
  useEffect(() => {
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      if (!userId) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error(error);
        router.push('/dashboard'); // fallback
        return;
      }

      // If onboarding already complete, redirect
      if (profile.onboarding_complete) {
        sessionStorage.removeItem('dashboard_state');

        router.push('/dashboard');
        return;
      }

      // Pre-fill form if profile exists
      setForm({
        company_name: profile.company_name || '',
        industry: profile.industry || '',
        country: profile.country || '',
        city: profile.city || '',
        address: profile.address || '',
        postcode: profile.postcode || '',
        company_size: profile.company_size || '',
        secr_required: profile.secr_required || false,
        data_confirmed_by_user: profile.data_confirmed_by_user || false,
        sustainability_stage: profile.sustainability_stage || '',
        contact_name: profile.contact_name || '',
        contact_email: profile.contact_email || '',
        has_company_vehicles: profile.has_company_vehicles || false,
        renewable_energy_tariff: profile.renewable_energy_tariff || false,
      });

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  function updateField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const cleanedEmail = form.contact_email?.trim().toLowerCase();

    const { data, error } = await supabase
  .from('profiles')
  .upsert(
    {
      id: userId,
      ...form,
      contact_email: cleanedEmail,
      onboarding_complete: true,
    },
    { onConflict: 'id' }
  )
  .select('id, onboarding_complete')
  .single();

console.log('[ONBOARDING SAVED PROFILE]', data);


    setSaving(false);

    if (error) {
      console.error('Failed to save onboarding', error);
      alert('Failed to save onboarding. Check console.');
      return;
    }

    sessionStorage.removeItem('dashboard_state');
router.push('/dashboard');

  }

  if (loading) return <p className="p-6">Loading…</p>;

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
          {/* Company details */}
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
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. Transport"
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Country
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. United Kingdom"
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                  />
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

          {/* Organisation scale */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Organisation scale
            </h2>

            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.company_size}
              onChange={(e) => updateField('company_size', e.target.value)}
            >
              <option value="">Select size…</option>
              <option value="1-10">1–10 employees</option>
              <option value="10-100">10–100 employees</option>
              <option value="100-500">100–500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </section>

          {/* Compliance */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Compliance
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.secr_required}
                onChange={(e) => updateField('secr_required', e.target.checked)}
              />
              My company is required to comply with SECR reporting.
            </label>
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
          </section>

          {/* Sustainability */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Sustainability & Operations
            </h2>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.sustainability_stage}
              onChange={(e) =>
                updateField('sustainability_stage', e.target.value)
              }
            >
              <option value="">Select stage…</option>
              <option value="early">Early stage</option>
              <option value="progressing">Progressing</option>
              <option value="advanced">Advanced</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.has_company_vehicles}
                onChange={(e) => updateField('has_company_vehicles', e.target.checked)}
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
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Contact details
            </h2>
            <input
              type="text"
              placeholder="Contact name"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.contact_name}
              onChange={(e) => updateField('contact_name', e.target.value)}
            />
            <input
              type="email"
              placeholder="Contact email"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.contact_email}
              onChange={(e) => updateField('contact_email', e.target.value)}
            />
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & return to dashboard →'}
          </button>
        </form>
      </div>
    </main>
  );
}
