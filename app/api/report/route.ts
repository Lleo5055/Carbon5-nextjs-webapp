'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type OnboardingCardProps = {
  profile: any;
  refreshDashboard: () => void;
};

export default function OnboardingCard({
  profile,
  refreshDashboard,
}: OnboardingCardProps) {
  // Pre-fill if exists
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [industry, setIndustry] = useState(profile?.industry || '');
  const [employees, setEmployees] = useState(profile?.employees || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [city, setCity] = useState(profile?.city || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [postcode, setPostcode] = useState(profile?.postcode || '');
  const [stage, setStage] = useState(profile?.sustainability_stage || '');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setMsg('Not logged in.');
      setSaving(false);
      return;
    }

    const updateBody = {
      company_name: companyName,
      industry,
      employees,
      country,
      city,
      address,
      postcode,
      sustainability_stage: stage,
      onboarding_complete: true,
    };

    const { error } = await supabase
      .from('profiles')
      .update(updateBody)
      .eq('id', user.id);

    if (error) {
      setMsg('Failed to save. Try again.');
    } else {
      setMsg('Profile updated.');
      refreshDashboard?.();
    }

    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Finish setting up your organisation
      </h2>
      <p className="text-sm text-slate-600 mt-1 mb-4">
        This helps us personalise benchmarking and insights for your business.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-700">
            Company name
          </label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Industry</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">
            Employees
          </label>
          <input
            type="number"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Country</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">City</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Address</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Postcode</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">
            Sustainability stage
          </label>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">Select stage</option>
            <option value="early">Early stage (just starting)</option>
            <option value="developing">Developing</option>
            <option value="advanced">Advanced & structured</option>
          </select>
        </div>
      </div>

      {msg && (
        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      <div className="flex justify-end mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Complete onboarding'}
        </button>
      </div>
    </section>
  );
}
