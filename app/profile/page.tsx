'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
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

  // Load user + profile data on mount
  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
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

    const { error } = await supabase
      .from('profiles')
      .update(form)
      .eq('id', userId);

    setSaving(false);

    if (error) {
      console.error(error);
      alert('Failed to save profile.');
      return;
    }

    alert('Profile updated successfully.');
  }

  if (loading) return <p className="p-6">Loading profile...</p>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a
          href="/dashboard"
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          ← Back to dashboard
        </a>
      </div>

      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Update your company information at any time.
        </p>

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
                <label className="text-xs font-medium text-slate-600">
                  Company name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Industry
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
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
                  value={form.postcode}
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
              className="w-full rounded-lg border px-3 py-2 text-sm"
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

          {/* COMPLIANCE */}
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
              My company is required to comply with SECR.
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
              <input
                type="checkbox"
                checked={form.data_confirmed_by_user}
                onChange={(e) =>
                  updateField('data_confirmed_by_user', e.target.checked)
                }
              />
              I confirm the provided information is accurate.
            </label>
          </section>

          {/* SUSTAINABILITY */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Sustainability & Operations
            </h2>

            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.sustainability_stage}
              onChange={(e) =>
                updateField('sustainability_stage', e.target.value)
              }
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
                onChange={(e) =>
                  updateField('has_company_vehicles', e.target.checked)
                }
              />
              We operate company-owned vehicles.
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
              <input
                type="checkbox"
                checked={form.renewable_energy_tariff}
                onChange={(e) =>
                  updateField('renewable_energy_tariff', e.target.checked)
                }
              />
              We use a renewable electricity tariff.
            </label>
          </section>

          {/* CONTACT */}
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
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </main>
  );
}
