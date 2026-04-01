'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  createOrganisation,
  createEntity,
  createSite,
  isEnterpriseUser,
  getUserOrgs,
} from '@/lib/enterprise';

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

const FY_MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function EnterpriseOnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Organisation
  const [orgName, setOrgName] = useState('');

  // Step 2 — Entity
  const [entityName, setEntityName] = useState('');
  const [entityCountry, setEntityCountry] = useState('');
  const [entityIndustry, setEntityIndustry] = useState('');
  const [entityFyStart, setEntityFyStart] = useState(4);
  const [entitySecrRequired, setEntitySecrRequired] = useState(false);
  const [entityCsrdRequired, setEntityCsrdRequired] = useState(false);
  const [entityBrsrRequired, setEntityBrsrRequired] = useState(false);

  // Step 3 — Site
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteCity, setSiteCity] = useState('');
  const [sitePostcode, setSitePostcode] = useState('');
  const [siteCountry, setSiteCountry] = useState('');
  const [siteIsPrimary, setSiteIsPrimary] = useState(true);

  // Guard: enterprise check and existing-org check on mount
  useEffect(() => {
    async function guard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const [enterprise, orgs] = await Promise.all([
        isEnterpriseUser(user.id),
        getUserOrgs(user.id),
      ]);

      if (!enterprise) {
        router.replace('/onboarding');
        return;
      }

      if (orgs.length > 0) {
        router.replace('/dashboard');
        return;
      }

      setChecking(false);
    }

    guard();
  }, [router]);

  // Pre-fill site country when entity country is set
  useEffect(() => {
    if (entityCountry) setSiteCountry(entityCountry);
  }, [entityCountry]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setError(null);
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName.trim() || !entityCountry) return;
    setError(null);
    setStep(3);
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim() || !siteCountry) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session expired. Please log in again.');

      // 1. Create organisation
      const org = await createOrganisation(orgName.trim(), user.id);

      // 2. Create first legal entity
      const entity = await createEntity(org.id, {
        name: entityName.trim(),
        country_code: entityCountry,
        currency: null,
        locale: null,
        fy_start_month: entityFyStart,
        secr_required: entitySecrRequired,
        csrd_required: entityCsrdRequired,
        brsr_required: entityBrsrRequired,
        industry: entityIndustry.trim() || null,
        company_size: null,
        annual_revenue: null,
        employee_count: null,
      });

      // 3. Create first site
      await createSite(entity.id, org.id, {
        name: siteName.trim(),
        address: siteAddress.trim() || null,
        city: siteCity.trim() || null,
        postcode: sitePostcode.trim() || null,
        country_code: siteCountry,
        is_primary: siteIsPrimary,
      });

      // 4. Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true }).eq('id', user.id);

      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Checking your account…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <h1 className="text-2xl font-semibold text-slate-900">
          Enterprise setup
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Set up your organisation, first legal entity, and primary site.
        </p>

        {/* Progress indicator */}
        <div className="mt-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  s < step
                    ? 'bg-slate-900 text-white'
                    : s === step
                    ? 'bg-slate-900 text-white ring-2 ring-slate-300 ring-offset-2'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              <span
                className={`text-xs font-medium ${
                  s === step ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {s === 1 ? 'Organisation' : s === 2 ? 'Legal entity' : 'Primary site'}
              </span>
              {s < 3 && <div className="h-px w-6 bg-slate-300" />}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── STEP 1: Organisation ─────────────────────────────────────── */}
        {step === 1 && (
          <form
            onSubmit={handleStep1}
            className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow border border-slate-200"
          >
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Organisation details
              </h2>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Organisation name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. Acme Group"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-400">
                  This is your top-level group name. You will add legal entities and sites in the next steps.
                </p>
              </div>
            </section>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2: Legal entity ─────────────────────────────────────── */}
        {step === 2 && (
          <form
            onSubmit={handleStep2}
            className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow border border-slate-200"
          >
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                First legal entity
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Set up your first legal entity here. You can add more entities and sites
                later from your Organisation settings.
              </p>
              <div className="space-y-4">

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Entity name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. Acme UK Ltd"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={entityCountry}
                    onChange={(e) => {
                      setEntityCountry(e.target.value);
                      setEntitySecrRequired(false);
                      setEntityCsrdRequired(false);
                      setEntityBrsrRequired(false);
                    }}
                    required
                  >
                    <option value="">Select country…</option>
                    {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Industry <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. Manufacturing"
                    value={entityIndustry}
                    onChange={(e) => setEntityIndustry(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Financial year start month <span className="text-slate-400">(optional)</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={entityFyStart}
                    onChange={(e) => setEntityFyStart(Number(e.target.value))}
                  >
                    {FY_MONTHS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {entityCountry && (
                  <div className="space-y-2 pt-1">
                    {entityCountry === 'GB' && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entitySecrRequired}
                          onChange={(e) => setEntitySecrRequired(e.target.checked)}
                        />
                        <span>
                          This entity is required to comply with <strong>SECR</strong>{' '}
                          (Streamlined Energy and Carbon Reporting).
                          <span className="block text-xs text-slate-400 mt-0.5">
                            Required for large UK companies under the Companies Act.
                          </span>
                        </span>
                      </label>
                    )}

                    {['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE'].includes(entityCountry) && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entityCsrdRequired}
                          onChange={(e) => setEntityCsrdRequired(e.target.checked)}
                        />
                        <span>
                          This entity is required to comply with <strong>CSRD</strong>{' '}
                          (Corporate Sustainability Reporting Directive).
                          <span className="block text-xs text-slate-400 mt-0.5">
                            EU mandatory sustainability disclosure for qualifying companies.
                          </span>
                        </span>
                      </label>
                    )}

                    {entityCountry === 'IN' && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entityBrsrRequired}
                          onChange={(e) => setEntityBrsrRequired(e.target.checked)}
                        />
                        <span>
                          This entity is required to comply with <strong>BRSR</strong>{' '}
                          (Business Responsibility and Sustainability Reporting).
                          <span className="block text-xs text-slate-400 mt-0.5">
                            Mandatory for top 1000 listed companies by market cap on NSE/BSE.
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                )}

              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-slate-50"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800"
              >
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Primary site ─────────────────────────────────────── */}
        {step === 3 && (
          <form
            onSubmit={handleStep3}
            className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow border border-slate-200"
          >
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Primary site
              </h2>
              <div className="space-y-4">

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Site name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. London HQ"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Address <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. 10 Oxford Street"
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      City <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="e.g. London"
                      value={siteCity}
                      onChange={(e) => setSiteCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Postcode <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="e.g. W1D 1NN"
                      value={sitePostcode}
                      onChange={(e) => setSitePostcode(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={siteCountry}
                    onChange={(e) => setSiteCountry(e.target.value)}
                    required
                  >
                    <option value="">Select country…</option>
                    {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={siteIsPrimary}
                    onChange={(e) => setSiteIsPrimary(e.target.checked)}
                  />
                  Mark as primary site for this entity
                </label>

              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? 'Setting up…' : 'Finish setup →'}
              </button>
            </div>
          </form>
        )}

      </div>
    </main>
  );
}