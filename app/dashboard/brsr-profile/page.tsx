// app/dashboard/brsr-profile/page.tsx
//
// Feature 1.3 — BRSR onboarding fields (India accounts only)
//
// Shown as an additional onboarding step after signup for India accounts.
// Also accessible later from account settings (Organisation page link).
// Non-India accounts are redirected to the dashboard immediately.

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const INDUSTRY_SECTORS = [
  'Manufacturing',
  'IT/Software',
  'Textiles',
  'Auto Components',
  'Pharmaceuticals',
  'Logistics',
  'FMCG',
  'Professional Services',
  'Other',
];

type FormState = {
  // P1
  is_listed_company: string;
  has_code_of_conduct: boolean;
  has_whistleblower_policy: boolean;
  has_anti_corruption_policy: boolean;
  // P2
  has_epr_compliance: boolean;
  sustainable_product_pct: string;
  rd_sustainability_spend: string;
  // P3
  permanent_employees: string;
  permanent_workers: string;
  has_health_insurance: boolean;
  has_maternity_paternity: boolean;
  training_hours_per_employee: string;
  // P4
  stakeholder_groups: string;
  stakeholder_engagement_frequency: string;
  // P5
  has_human_rights_policy: boolean;
  human_rights_training: boolean;
  human_rights_complaints: string;
  // P6
  industry_sector: string;
  renewable_elec_pct: string;
  has_ghg_reduction_plan: boolean;
  ghg_reduction_detail: string;
  // P7
  industry_associations: string;
  policy_advocacy_positions: string;
  // P8
  csr_spend_inr: string;
  social_impact_projects: string;
  // P9
  has_consumer_complaint_mechanism: boolean;
  has_data_privacy_policy: boolean;
  has_product_labelling: boolean;
};

const EMPTY_FORM: FormState = {
  is_listed_company: '',
  has_code_of_conduct: false,
  has_whistleblower_policy: false,
  has_anti_corruption_policy: false,
  has_epr_compliance: false,
  sustainable_product_pct: '',
  rd_sustainability_spend: '',
  permanent_employees: '',
  permanent_workers: '',
  has_health_insurance: false,
  has_maternity_paternity: false,
  training_hours_per_employee: '',
  stakeholder_groups: '',
  stakeholder_engagement_frequency: '',
  has_human_rights_policy: false,
  human_rights_training: false,
  human_rights_complaints: '',
  industry_sector: '',
  renewable_elec_pct: '',
  has_ghg_reduction_plan: false,
  ghg_reduction_detail: '',
  industry_associations: '',
  policy_advocacy_positions: '',
  csr_spend_inr: '',
  social_impact_projects: '',
  has_consumer_complaint_mechanism: false,
  has_data_privacy_policy: false,
  has_product_labelling: false,
};

export default function BrsrProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /></main>}>
      <BrsrProfileInner />
    </Suspense>
  );
}

function SectionHeader({ principle, title, desc }: { principle: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
      <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">{principle}</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 accent-emerald-600" />
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </label>
  );
}

const PLAN_CACHE_KEY = 'greenio_plan_v1';

function BrsrProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [isEnterprise, setIsEnterprise] = useState(() => {
    // Read from sessionStorage instantly - avoids any flash
    try { return sessionStorage.getItem(PLAN_CACHE_KEY) === 'enterprise'; } catch { return false; }
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country !== 'IN') {
        router.push('/dashboard');
        return;
      }

      // Plan detection — sessionStorage already set in useState initializer for instant read.
      // Do a DB fallback here to verify / update if sessionStorage was empty or stale.
      const cachedPlan = (() => { try { return sessionStorage.getItem(PLAN_CACHE_KEY); } catch { return null; } })();
      if (!cachedPlan) {
        const { data: planData } = await supabase
          .from('user_plans')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle();
        const plan = planData?.plan ?? 'free';
        try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
        setIsEnterprise(plan === 'enterprise');
      }

      const { data: brsr } = await supabase
        .from('brsr_profile')
        .select('*')
        .eq('account_id', user.id)
        .maybeSingle();

      if (brsr) {
        setForm({
          is_listed_company: brsr.is_listed_company === true ? 'yes' : brsr.is_subsidiary_of_listed ? 'subsidiary' : 'no',
          has_code_of_conduct: brsr.has_code_of_conduct ?? false,
          has_whistleblower_policy: brsr.has_whistleblower_policy ?? false,
          has_anti_corruption_policy: brsr.has_anti_corruption_policy ?? false,
          has_epr_compliance: brsr.has_epr_compliance ?? false,
          sustainable_product_pct: brsr.sustainable_product_pct?.toString() ?? '',
          rd_sustainability_spend: brsr.rd_sustainability_spend?.toString() ?? '',
          permanent_employees: brsr.permanent_employees?.toString() ?? '',
          permanent_workers: brsr.permanent_workers?.toString() ?? '',
          has_health_insurance: brsr.has_health_insurance ?? false,
          has_maternity_paternity: brsr.has_maternity_paternity ?? false,
          training_hours_per_employee: brsr.training_hours_per_employee?.toString() ?? '',
          stakeholder_groups: brsr.stakeholder_groups ?? '',
          stakeholder_engagement_frequency: brsr.stakeholder_engagement_frequency ?? '',
          has_human_rights_policy: brsr.has_human_rights_policy ?? false,
          human_rights_training: brsr.human_rights_training ?? false,
          human_rights_complaints: brsr.human_rights_complaints?.toString() ?? '',
          industry_sector: brsr.industry_sector ?? '',
          renewable_elec_pct: brsr.renewable_elec_pct?.toString() ?? '',
          has_ghg_reduction_plan: brsr.has_ghg_reduction_plan ?? false,
          ghg_reduction_detail: brsr.ghg_reduction_detail ?? '',
          industry_associations: brsr.industry_associations ?? '',
          policy_advocacy_positions: brsr.policy_advocacy_positions ?? '',
          csr_spend_inr: brsr.csr_spend_inr?.toString() ?? '',
          social_impact_projects: brsr.social_impact_projects ?? '',
          has_consumer_complaint_mechanism: brsr.has_consumer_complaint_mechanism ?? false,
          has_data_privacy_policy: brsr.has_data_privacy_policy ?? false,
          has_product_labelling: brsr.has_product_labelling ?? false,
        });
      }

      setLoading(false);
    }
    load();
  }, [router]);

  function update(key: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      account_id: user.id,
      // P1
      is_listed_company: form.is_listed_company === 'yes',
      is_subsidiary_of_listed: form.is_listed_company === 'subsidiary',
      has_code_of_conduct: form.has_code_of_conduct,
      has_whistleblower_policy: form.has_whistleblower_policy,
      has_anti_corruption_policy: form.has_anti_corruption_policy,
      // P2
      has_epr_compliance: form.has_epr_compliance,
      sustainable_product_pct: form.sustainable_product_pct ? parseFloat(form.sustainable_product_pct) : null,
      rd_sustainability_spend: form.rd_sustainability_spend ? parseFloat(form.rd_sustainability_spend) : null,
      // P3
      permanent_employees: form.permanent_employees ? parseInt(form.permanent_employees) : null,
      permanent_workers: form.permanent_workers ? parseInt(form.permanent_workers) : null,
      has_health_insurance: form.has_health_insurance,
      has_maternity_paternity: form.has_maternity_paternity,
      training_hours_per_employee: form.training_hours_per_employee ? parseFloat(form.training_hours_per_employee) : null,
      // P4
      stakeholder_groups: form.stakeholder_groups || null,
      stakeholder_engagement_frequency: form.stakeholder_engagement_frequency || null,
      // P5
      has_human_rights_policy: form.has_human_rights_policy,
      human_rights_training: form.human_rights_training,
      human_rights_complaints: form.human_rights_complaints ? parseInt(form.human_rights_complaints) : null,
      // P6
      industry_sector: form.industry_sector || null,
      renewable_elec_pct: form.renewable_elec_pct ? parseFloat(form.renewable_elec_pct) : null,
      has_ghg_reduction_plan: form.has_ghg_reduction_plan,
      ghg_reduction_detail: form.has_ghg_reduction_plan ? form.ghg_reduction_detail : null,
      // P7
      industry_associations: form.industry_associations || null,
      policy_advocacy_positions: form.policy_advocacy_positions || null,
      // P8
      csr_spend_inr: form.csr_spend_inr ? parseFloat(form.csr_spend_inr) : null,
      social_impact_projects: form.social_impact_projects || null,
      // P9
      has_consumer_complaint_mechanism: form.has_consumer_complaint_mechanism,
      has_data_privacy_policy: form.has_data_privacy_policy,
      has_product_labelling: form.has_product_labelling,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('brsr_profile')
      .upsert(payload, { onConflict: 'account_id' });

    setSaving(false);

    if (error) {
      alert('Failed to save BRSR profile: ' + error.message);
      return;
    }

    if (isOnboarding) {
      router.push('/dashboard');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
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
      <div className="mx-auto max-w-2xl space-y-6">

        <div className="flex items-center gap-3">
          {!isOnboarding && (
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              &larr; Dashboard
            </Link>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">BRSR</span>
            {isOnboarding && <span className="text-[10px] text-slate-500">Step 2 of 2</span>}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">BRSR Company Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Required for SEBI Business Responsibility &amp; Sustainability Report (BRSR) compliance. Complete all 9 principles to generate a full BRSR disclosure.
            {isOnboarding && ' You can skip this and complete it later from your account settings.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Enterprise-only: P1-P5 and P7-P9 */}
          {isEnterprise ? (
            <>

          {/* P1: Ethics & Transparency */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P1" title="Ethics, Transparency & Accountability" desc="Policies governing ethical conduct, anti-corruption, and whistleblower protection." />
            <div>
              <label className="text-xs font-medium text-slate-700">Listed company status</label>
              <div className="mt-2 flex flex-col gap-2">
                {[
                  { value: 'yes', label: 'Yes - listed company' },
                  { value: 'no', label: 'No - unlisted company' },
                  { value: 'subsidiary', label: 'Subsidiary of a listed company' },
                ].map(({ value, label }) => (
                  <label key={value} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="listed_status" value={value} checked={form.is_listed_company === value} onChange={() => update('is_listed_company', value)} className="accent-emerald-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <CheckField label="Code of conduct in place" checked={form.has_code_of_conduct} onChange={v => update('has_code_of_conduct', v)} hint="Applies to Board, employees and value chain partners" />
            <CheckField label="Whistleblower / vigil mechanism in place" checked={form.has_whistleblower_policy} onChange={v => update('has_whistleblower_policy', v)} />
            <CheckField label="Anti-corruption and anti-bribery policy in place" checked={form.has_anti_corruption_policy} onChange={v => update('has_anti_corruption_policy', v)} />
          </div>

          {/* P2: Sustainable Products */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P2" title="Sustainable & Safe Products / Services" desc="Product lifecycle, Extended Producer Responsibility (EPR), and R&D sustainability spend." />
            <CheckField label="Extended Producer Responsibility (EPR) compliance" checked={form.has_epr_compliance} onChange={v => update('has_epr_compliance', v)} hint="Applicable if your products generate e-waste, plastic, or battery waste" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Sustainable products / services (%)</label>
                <input type="number" min="0" max="100" step="0.1" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 30" value={form.sustainable_product_pct} onChange={e => update('sustainable_product_pct', e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-0.5">% of turnover from sustainable products</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">R&D sustainability spend (INR)</label>
                <input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 500000" value={form.rd_sustainability_spend} onChange={e => update('rd_sustainability_spend', e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-0.5">Annual spend on sustainability R&D</p>
              </div>
            </div>
          </div>

          {/* P3: Employee Wellbeing */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P3" title="Employee Wellbeing" desc="Health, safety, training, and welfare of employees and workers." />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Permanent employees <span className="text-red-500">*</span></label>
                <input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 250" value={form.permanent_employees} onChange={e => update('permanent_employees', e.target.value)} required />
                <p className="text-[11px] text-slate-400 mt-0.5">Full-time + part-time on payroll</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Permanent workers <span className="text-red-500">*</span></label>
                <input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 80" value={form.permanent_workers} onChange={e => update('permanent_workers', e.target.value)} required />
                <p className="text-[11px] text-slate-400 mt-0.5">On-site contract / casual workers</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Average training hours per employee per year</label>
              <input type="number" min="0" step="0.5" className="mt-1 w-40 rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 20" value={form.training_hours_per_employee} onChange={e => update('training_hours_per_employee', e.target.value)} />
            </div>
            <CheckField label="Health insurance provided to all employees" checked={form.has_health_insurance} onChange={v => update('has_health_insurance', v)} />
            <CheckField label="Maternity / paternity benefits in place" checked={form.has_maternity_paternity} onChange={v => update('has_maternity_paternity', v)} />
          </div>

          {/* P4: Stakeholder Engagement */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P4" title="Stakeholder Engagement" desc="Identification of and engagement with key stakeholder groups." />
            <div>
              <label className="text-xs font-medium text-slate-700">Key stakeholder groups</label>
              <input type="text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. Employees, Customers, Suppliers, Investors, Community" value={form.stakeholder_groups} onChange={e => update('stakeholder_groups', e.target.value)} />
              <p className="text-[11px] text-slate-400 mt-0.5">Comma-separated list of groups your company engages with</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Engagement frequency</label>
              <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.stakeholder_engagement_frequency} onChange={e => update('stakeholder_engagement_frequency', e.target.value)}>
                <option value="">Select frequency...</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-yearly">Half-yearly</option>
                <option value="Annually">Annually</option>
                <option value="Ad hoc">Ad hoc</option>
              </select>
            </div>
          </div>

          {/* P5: Human Rights */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P5" title="Human Rights" desc="Policies, training, and grievance mechanisms covering human rights across the value chain." />
            <CheckField label="Human rights policy in place" checked={form.has_human_rights_policy} onChange={v => update('has_human_rights_policy', v)} hint="Covers employees, workers, and supply chain partners" />
            <CheckField label="Human rights training provided to employees" checked={form.human_rights_training} onChange={v => update('human_rights_training', v)} />
            <div>
              <label className="text-xs font-medium text-slate-700">Human rights complaints received (this year)</label>
              <input type="number" min="0" className="mt-1 w-40 rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 0" value={form.human_rights_complaints} onChange={e => update('human_rights_complaints', e.target.value)} />
            </div>
          </div>

            </>) : (
            /* SME upgrade banner shown in place of P1-P5 */
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Full BRSR Disclosure - Enterprise plan</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Your current plan includes Environment Disclosure (Principle 6). Upgrade to Enterprise to unlock all 9 BRSR principles - Ethics (P1), Sustainable Products (P2), Employee Wellbeing (P3), Stakeholder Engagement (P4), Human Rights (P5), Policy Advocacy (P7), Inclusive Growth (P8), and Consumer Responsibility (P9).
                  </p>
                  <a href="mailto:hello@greenio.co?subject=BRSR Enterprise Upgrade" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-4 py-1.5 text-xs font-medium hover:bg-emerald-800 transition-colors">
                    Contact us to upgrade
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* P6: Environment - visible to all India users */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P6" title="Environment" desc="GHG emissions, energy consumption, water, waste, and air quality. Most fields auto-populated from your Greenio emissions data." />
            <div>
              <label className="text-xs font-medium text-slate-700">Industry sector</label>
              <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.industry_sector} onChange={e => update('industry_sector', e.target.value)}>
                <option value="">Select sector...</option>
                {INDUSTRY_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Renewable electricity percentage</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.01" className="w-32 rounded-lg border px-3 py-2 text-sm" placeholder="0-100" value={form.renewable_elec_pct} onChange={e => update('renewable_elec_pct', e.target.value)} />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Share of electricity from renewable sources</p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.has_ghg_reduction_plan} onChange={e => update('has_ghg_reduction_plan', e.target.checked)} className="accent-emerald-600" />
                We have a GHG reduction plan
              </label>
              {form.has_ghg_reduction_plan && (
                <textarea className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Briefly describe your GHG reduction plan..." value={form.ghg_reduction_detail} onChange={e => update('ghg_reduction_detail', e.target.value)} />
              )}
            </div>
            <p className="text-[11px] text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              GHG emissions, energy consumption, water, waste and air quality data are auto-populated from your Greenio emissions entries. Use the Add Emissions form to keep these up to date.
            </p>
          </div>

          {/* P7-P9: Enterprise only */}
          {isEnterprise && (<>

          {/* P7: Policy Advocacy */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P7" title="Policy & Regulatory Advocacy" desc="Industry associations and public policy positions your company supports or advocates." />
            <div>
              <label className="text-xs font-medium text-slate-700">Industry / trade associations</label>
              <input type="text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. CII, FICCI, NASSCOM" value={form.industry_associations} onChange={e => update('industry_associations', e.target.value)} />
              <p className="text-[11px] text-slate-400 mt-0.5">Associations your company is a member of</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Policy advocacy positions</label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Describe any public policy positions your company has taken..." value={form.policy_advocacy_positions} onChange={e => update('policy_advocacy_positions', e.target.value)} />
            </div>
          </div>

          {/* P8: Inclusive Growth */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P8" title="Inclusive Growth & Equitable Development" desc="CSR spending and social impact programmes benefiting communities." />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700">CSR spend (INR)</label>
                <input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 2000000" value={form.csr_spend_inr} onChange={e => update('csr_spend_inr', e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-0.5">Annual CSR expenditure</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Social impact projects</label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Describe key CSR or social impact initiatives..." value={form.social_impact_projects} onChange={e => update('social_impact_projects', e.target.value)} />
            </div>
          </div>

          {/* P9: Consumer Responsibility */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <SectionHeader principle="P9" title="Consumer Responsibility" desc="Mechanisms for consumer complaints, data privacy, and product labelling." />
            <CheckField label="Consumer complaint / grievance mechanism in place" checked={form.has_consumer_complaint_mechanism} onChange={v => update('has_consumer_complaint_mechanism', v)} />
            <CheckField label="Data privacy policy in place" checked={form.has_data_privacy_policy} onChange={v => update('has_data_privacy_policy', v)} hint="Covers collection, storage and use of customer data" />
            <CheckField label="Product labelling / disclosure in place" checked={form.has_product_labelling} onChange={v => update('has_product_labelling', v)} hint="Environmental or safety labelling on products" />
          </div>

          </>)}

          {/* Actions */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : isOnboarding ? 'Save & go to dashboard \u2192' : 'Save BRSR profile'}
            </button>
            {isOnboarding && (
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                Skip for now
              </Link>
            )}
            {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
          </div>

        </form>

        {/* India feature toggles - visible after onboarding */}
        {!isOnboarding && (
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">India disclosure modules</h2>
            <p className="text-xs text-slate-500">Enable additional data categories required for BRSR Principle 6 disclosures.</p>
            <IndiaToggles />
          </div>
        )}
      </div>
    </main>
  );
}

// India feature toggles component

type IndiaFlags = {
  india_water_enabled: boolean;
  india_waste_enabled: boolean;
  india_air_enabled: boolean;
};

function IndiaToggles() {
  const [flags, setFlags] = useState<IndiaFlags | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('india_water_enabled, india_waste_enabled, india_air_enabled')
        .eq('id', user.id)
        .maybeSingle();
      setFlags({
        india_water_enabled: data?.india_water_enabled ?? false,
        india_waste_enabled: data?.india_waste_enabled ?? false,
        india_air_enabled: data?.india_air_enabled ?? false,
      });
    }
    load();
  }, []);

  async function toggle(key: keyof IndiaFlags, value: boolean) {
    if (!flags) return;
    const next = { ...flags, [key]: value };
    setFlags(next);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
    }
    setSaving(false);
  }

  if (!flags) return <div className="h-6 animate-pulse bg-slate-100 rounded" />;

  const modules = [
    { key: 'india_water_enabled' as const, label: 'Water tracking', desc: 'Log monthly water withdrawn/consumed/discharged (BRSR Principle 6)' },
    { key: 'india_waste_enabled' as const, label: 'Waste tracking', desc: 'Log monthly waste generated, recycled, landfill and hazardous (BRSR Principle 6)' },
    { key: 'india_air_enabled' as const, label: 'Air emissions', desc: 'Log annual NOx, SOx, and particulate matter disclosures (BRSR Principle 6)' },
  ];

  return (
    <div className="space-y-3">
      {modules.map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-3 cursor-pointer group">
          <div className="mt-0.5">
            <button type="button" role="switch" aria-checked={flags[key]} onClick={() => toggle(key, !flags[key])}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${flags[key] ? 'bg-emerald-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${flags[key] ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        </label>
      ))}
      {saving && <p className="text-xs text-slate-400">Saving...</p>}
    </div>
  );
}
