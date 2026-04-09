// app/dashboard/brsr-profile/page.tsx
//
// Feature 1.3 — BRSR onboarding fields (India accounts only)
// Enterprise users see Section A + B + C tabs.
// SME users see Section C (P6 only) + upgrade banner.

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const INDUSTRY_SECTORS = [
  'Manufacturing', 'IT/Software', 'Textiles', 'Auto Components',
  'Pharmaceuticals', 'Logistics', 'FMCG', 'Professional Services', 'Other',
];

const PRINCIPLES = [
  { key: 'p1', label: 'P1', title: 'Ethics, Transparency & Accountability' },
  { key: 'p2', label: 'P2', title: 'Sustainable & Safe Products / Services' },
  { key: 'p3', label: 'P3', title: 'Employee Wellbeing' },
  { key: 'p4', label: 'P4', title: 'Stakeholder Engagement' },
  { key: 'p5', label: 'P5', title: 'Human Rights' },
  { key: 'p6', label: 'P6', title: 'Environment' },
  { key: 'p7', label: 'P7', title: 'Policy & Regulatory Advocacy' },
  { key: 'p8', label: 'P8', title: 'Inclusive Growth & Equitable Development' },
  { key: 'p9', label: 'P9', title: 'Consumer Responsibility' },
];

type FormState = {
  // ---- Section A: Entity details ----
  cin: string;
  year_of_incorporation: string;
  registered_office_address: string;
  company_website: string;
  paid_up_capital_inr: string;
  stock_exchange: string;
  brsr_contact_name: string;
  brsr_contact_designation: string;
  brsr_contact_email: string;
  brsr_contact_phone: string;
  reporting_boundary: string;
  // Workforce gender split
  male_permanent_employees: string;
  female_permanent_employees: string;
  differently_abled_employees: string;
  women_on_board: string;
  total_board_members: string;
  women_in_kmp: string;
  total_kmp: string;
  // Markets & financials
  num_national_locations: string;
  num_international_locations: string;
  export_pct: string;
  annual_turnover_inr: string;
  net_worth_inr: string;

  // ---- Section B: Policy matrix (P1-P9) ----
  p1_policy_exists: boolean; p1_board_approved: boolean; p1_policy_url: string; p1_extends_to_vc: boolean;
  p2_policy_exists: boolean; p2_board_approved: boolean; p2_policy_url: string; p2_extends_to_vc: boolean;
  p3_policy_exists: boolean; p3_board_approved: boolean; p3_policy_url: string; p3_extends_to_vc: boolean;
  p4_policy_exists: boolean; p4_board_approved: boolean; p4_policy_url: string; p4_extends_to_vc: boolean;
  p5_policy_exists: boolean; p5_board_approved: boolean; p5_policy_url: string; p5_extends_to_vc: boolean;
  p6_policy_exists: boolean; p6_board_approved: boolean; p6_policy_url: string; p6_extends_to_vc: boolean;
  p7_policy_exists: boolean; p7_board_approved: boolean; p7_policy_url: string; p7_extends_to_vc: boolean;
  p8_policy_exists: boolean; p8_board_approved: boolean; p8_policy_url: string; p8_extends_to_vc: boolean;
  p9_policy_exists: boolean; p9_board_approved: boolean; p9_policy_url: string; p9_extends_to_vc: boolean;
  brsr_director_name: string;
  brsr_committee_name: string;

  // ---- Section C: P1-P9 performance ----
  is_listed_company: string;
  has_code_of_conduct: boolean;
  has_whistleblower_policy: boolean;
  has_anti_corruption_policy: boolean;
  has_epr_compliance: boolean;
  sustainable_product_pct: string;
  rd_sustainability_spend: string;
  permanent_employees: string;
  permanent_workers: string;
  has_health_insurance: boolean;
  has_maternity_paternity: boolean;
  training_hours_per_employee: string;
  stakeholder_groups: string;
  stakeholder_engagement_frequency: string;
  has_human_rights_policy: boolean;
  human_rights_training: boolean;
  human_rights_complaints: string;
  industry_sector: string;
  renewable_elec_pct: string;
  has_ghg_reduction_plan: boolean;
  ghg_reduction_detail: string;
  industry_associations: string;
  policy_advocacy_positions: string;
  csr_spend_inr: string;
  social_impact_projects: string;
  has_consumer_complaint_mechanism: boolean;
  has_data_privacy_policy: boolean;
  has_product_labelling: boolean;
};

const EMPTY_FORM: FormState = {
  cin: '', year_of_incorporation: '', registered_office_address: '', company_website: '',
  paid_up_capital_inr: '', stock_exchange: '', brsr_contact_name: '', brsr_contact_designation: '',
  brsr_contact_email: '', brsr_contact_phone: '', reporting_boundary: '',
  male_permanent_employees: '', female_permanent_employees: '', differently_abled_employees: '',
  women_on_board: '', total_board_members: '', women_in_kmp: '', total_kmp: '',
  num_national_locations: '', num_international_locations: '', export_pct: '',
  annual_turnover_inr: '', net_worth_inr: '',
  p1_policy_exists: false, p1_board_approved: false, p1_policy_url: '', p1_extends_to_vc: false,
  p2_policy_exists: false, p2_board_approved: false, p2_policy_url: '', p2_extends_to_vc: false,
  p3_policy_exists: false, p3_board_approved: false, p3_policy_url: '', p3_extends_to_vc: false,
  p4_policy_exists: false, p4_board_approved: false, p4_policy_url: '', p4_extends_to_vc: false,
  p5_policy_exists: false, p5_board_approved: false, p5_policy_url: '', p5_extends_to_vc: false,
  p6_policy_exists: false, p6_board_approved: false, p6_policy_url: '', p6_extends_to_vc: false,
  p7_policy_exists: false, p7_board_approved: false, p7_policy_url: '', p7_extends_to_vc: false,
  p8_policy_exists: false, p8_board_approved: false, p8_policy_url: '', p8_extends_to_vc: false,
  p9_policy_exists: false, p9_board_approved: false, p9_policy_url: '', p9_extends_to_vc: false,
  brsr_director_name: '', brsr_committee_name: '',
  is_listed_company: '', has_code_of_conduct: false, has_whistleblower_policy: false,
  has_anti_corruption_policy: false, has_epr_compliance: false, sustainable_product_pct: '',
  rd_sustainability_spend: '', permanent_employees: '', permanent_workers: '',
  has_health_insurance: false, has_maternity_paternity: false, training_hours_per_employee: '',
  stakeholder_groups: '', stakeholder_engagement_frequency: '', has_human_rights_policy: false,
  human_rights_training: false, human_rights_complaints: '', industry_sector: '',
  renewable_elec_pct: '', has_ghg_reduction_plan: false, ghg_reduction_detail: '',
  industry_associations: '', policy_advocacy_positions: '', csr_spend_inr: '',
  social_impact_projects: '', has_consumer_complaint_mechanism: false,
  has_data_privacy_policy: false, has_product_labelling: false,
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

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
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
  const [activeTab, setActiveTab] = useState<'a' | 'b' | 'c'>('c');
  const [isEnterprise, setIsEnterprise] = useState(() => {
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

      if (profile?.country !== 'IN') { router.push('/dashboard'); return; }

      const cachedPlan = (() => { try { return sessionStorage.getItem(PLAN_CACHE_KEY); } catch { return null; } })();
      if (!cachedPlan) {
        const { data: planData } = await supabase.from('user_plans').select('plan').eq('user_id', user.id).maybeSingle();
        const plan = planData?.plan ?? 'free';
        try { sessionStorage.setItem(PLAN_CACHE_KEY, plan); } catch {}
        setIsEnterprise(plan === 'enterprise');
      }

      const { data: brsr } = await supabase.from('brsr_profile').select('*').eq('account_id', user.id).maybeSingle();

      if (brsr) {
        setForm({
          // Section A
          cin: brsr.cin ?? '',
          year_of_incorporation: brsr.year_of_incorporation?.toString() ?? '',
          registered_office_address: brsr.registered_office_address ?? '',
          company_website: brsr.company_website ?? '',
          paid_up_capital_inr: brsr.paid_up_capital_inr?.toString() ?? '',
          stock_exchange: brsr.stock_exchange ?? '',
          brsr_contact_name: brsr.brsr_contact_name ?? '',
          brsr_contact_designation: brsr.brsr_contact_designation ?? '',
          brsr_contact_email: brsr.brsr_contact_email ?? '',
          brsr_contact_phone: brsr.brsr_contact_phone ?? '',
          reporting_boundary: brsr.reporting_boundary ?? '',
          male_permanent_employees: brsr.male_permanent_employees?.toString() ?? '',
          female_permanent_employees: brsr.female_permanent_employees?.toString() ?? '',
          differently_abled_employees: brsr.differently_abled_employees?.toString() ?? '',
          women_on_board: brsr.women_on_board?.toString() ?? '',
          total_board_members: brsr.total_board_members?.toString() ?? '',
          women_in_kmp: brsr.women_in_kmp?.toString() ?? '',
          total_kmp: brsr.total_kmp?.toString() ?? '',
          num_national_locations: brsr.num_national_locations?.toString() ?? '',
          num_international_locations: brsr.num_international_locations?.toString() ?? '',
          export_pct: brsr.export_pct?.toString() ?? '',
          annual_turnover_inr: brsr.annual_turnover_inr?.toString() ?? '',
          net_worth_inr: brsr.net_worth_inr?.toString() ?? '',
          // Section B
          p1_policy_exists: brsr.p1_policy_exists ?? false, p1_board_approved: brsr.p1_board_approved ?? false, p1_policy_url: brsr.p1_policy_url ?? '', p1_extends_to_vc: brsr.p1_extends_to_vc ?? false,
          p2_policy_exists: brsr.p2_policy_exists ?? false, p2_board_approved: brsr.p2_board_approved ?? false, p2_policy_url: brsr.p2_policy_url ?? '', p2_extends_to_vc: brsr.p2_extends_to_vc ?? false,
          p3_policy_exists: brsr.p3_policy_exists ?? false, p3_board_approved: brsr.p3_board_approved ?? false, p3_policy_url: brsr.p3_policy_url ?? '', p3_extends_to_vc: brsr.p3_extends_to_vc ?? false,
          p4_policy_exists: brsr.p4_policy_exists ?? false, p4_board_approved: brsr.p4_board_approved ?? false, p4_policy_url: brsr.p4_policy_url ?? '', p4_extends_to_vc: brsr.p4_extends_to_vc ?? false,
          p5_policy_exists: brsr.p5_policy_exists ?? false, p5_board_approved: brsr.p5_board_approved ?? false, p5_policy_url: brsr.p5_policy_url ?? '', p5_extends_to_vc: brsr.p5_extends_to_vc ?? false,
          p6_policy_exists: brsr.p6_policy_exists ?? false, p6_board_approved: brsr.p6_board_approved ?? false, p6_policy_url: brsr.p6_policy_url ?? '', p6_extends_to_vc: brsr.p6_extends_to_vc ?? false,
          p7_policy_exists: brsr.p7_policy_exists ?? false, p7_board_approved: brsr.p7_board_approved ?? false, p7_policy_url: brsr.p7_policy_url ?? '', p7_extends_to_vc: brsr.p7_extends_to_vc ?? false,
          p8_policy_exists: brsr.p8_policy_exists ?? false, p8_board_approved: brsr.p8_board_approved ?? false, p8_policy_url: brsr.p8_policy_url ?? '', p8_extends_to_vc: brsr.p8_extends_to_vc ?? false,
          p9_policy_exists: brsr.p9_policy_exists ?? false, p9_board_approved: brsr.p9_board_approved ?? false, p9_policy_url: brsr.p9_policy_url ?? '', p9_extends_to_vc: brsr.p9_extends_to_vc ?? false,
          brsr_director_name: brsr.brsr_director_name ?? '',
          brsr_committee_name: brsr.brsr_committee_name ?? '',
          // Section C
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

    const n = (v: string) => v ? parseFloat(v) : null;
    const ni = (v: string) => v ? parseInt(v) : null;

    const payload = {
      account_id: user.id,
      // Section A
      cin: form.cin || null,
      year_of_incorporation: ni(form.year_of_incorporation),
      registered_office_address: form.registered_office_address || null,
      company_website: form.company_website || null,
      paid_up_capital_inr: n(form.paid_up_capital_inr),
      stock_exchange: form.stock_exchange || null,
      brsr_contact_name: form.brsr_contact_name || null,
      brsr_contact_designation: form.brsr_contact_designation || null,
      brsr_contact_email: form.brsr_contact_email || null,
      brsr_contact_phone: form.brsr_contact_phone || null,
      reporting_boundary: form.reporting_boundary || null,
      male_permanent_employees: ni(form.male_permanent_employees),
      female_permanent_employees: ni(form.female_permanent_employees),
      differently_abled_employees: ni(form.differently_abled_employees),
      women_on_board: ni(form.women_on_board),
      total_board_members: ni(form.total_board_members),
      women_in_kmp: ni(form.women_in_kmp),
      total_kmp: ni(form.total_kmp),
      num_national_locations: ni(form.num_national_locations),
      num_international_locations: ni(form.num_international_locations),
      export_pct: n(form.export_pct),
      annual_turnover_inr: n(form.annual_turnover_inr),
      net_worth_inr: n(form.net_worth_inr),
      // Section B
      p1_policy_exists: form.p1_policy_exists, p1_board_approved: form.p1_board_approved, p1_policy_url: form.p1_policy_url || null, p1_extends_to_vc: form.p1_extends_to_vc,
      p2_policy_exists: form.p2_policy_exists, p2_board_approved: form.p2_board_approved, p2_policy_url: form.p2_policy_url || null, p2_extends_to_vc: form.p2_extends_to_vc,
      p3_policy_exists: form.p3_policy_exists, p3_board_approved: form.p3_board_approved, p3_policy_url: form.p3_policy_url || null, p3_extends_to_vc: form.p3_extends_to_vc,
      p4_policy_exists: form.p4_policy_exists, p4_board_approved: form.p4_board_approved, p4_policy_url: form.p4_policy_url || null, p4_extends_to_vc: form.p4_extends_to_vc,
      p5_policy_exists: form.p5_policy_exists, p5_board_approved: form.p5_board_approved, p5_policy_url: form.p5_policy_url || null, p5_extends_to_vc: form.p5_extends_to_vc,
      p6_policy_exists: form.p6_policy_exists, p6_board_approved: form.p6_board_approved, p6_policy_url: form.p6_policy_url || null, p6_extends_to_vc: form.p6_extends_to_vc,
      p7_policy_exists: form.p7_policy_exists, p7_board_approved: form.p7_board_approved, p7_policy_url: form.p7_policy_url || null, p7_extends_to_vc: form.p7_extends_to_vc,
      p8_policy_exists: form.p8_policy_exists, p8_board_approved: form.p8_board_approved, p8_policy_url: form.p8_policy_url || null, p8_extends_to_vc: form.p8_extends_to_vc,
      p9_policy_exists: form.p9_policy_exists, p9_board_approved: form.p9_board_approved, p9_policy_url: form.p9_policy_url || null, p9_extends_to_vc: form.p9_extends_to_vc,
      brsr_director_name: form.brsr_director_name || null,
      brsr_committee_name: form.brsr_committee_name || null,
      // Section C
      is_listed_company: form.is_listed_company === 'yes',
      is_subsidiary_of_listed: form.is_listed_company === 'subsidiary',
      has_code_of_conduct: form.has_code_of_conduct,
      has_whistleblower_policy: form.has_whistleblower_policy,
      has_anti_corruption_policy: form.has_anti_corruption_policy,
      has_epr_compliance: form.has_epr_compliance,
      sustainable_product_pct: n(form.sustainable_product_pct),
      rd_sustainability_spend: n(form.rd_sustainability_spend),
      permanent_employees: ni(form.permanent_employees),
      permanent_workers: ni(form.permanent_workers),
      has_health_insurance: form.has_health_insurance,
      has_maternity_paternity: form.has_maternity_paternity,
      training_hours_per_employee: n(form.training_hours_per_employee),
      stakeholder_groups: form.stakeholder_groups || null,
      stakeholder_engagement_frequency: form.stakeholder_engagement_frequency || null,
      has_human_rights_policy: form.has_human_rights_policy,
      human_rights_training: form.human_rights_training,
      human_rights_complaints: ni(form.human_rights_complaints),
      industry_sector: form.industry_sector || null,
      renewable_elec_pct: n(form.renewable_elec_pct),
      has_ghg_reduction_plan: form.has_ghg_reduction_plan,
      ghg_reduction_detail: form.has_ghg_reduction_plan ? form.ghg_reduction_detail : null,
      industry_associations: form.industry_associations || null,
      policy_advocacy_positions: form.policy_advocacy_positions || null,
      csr_spend_inr: n(form.csr_spend_inr),
      social_impact_projects: form.social_impact_projects || null,
      has_consumer_complaint_mechanism: form.has_consumer_complaint_mechanism,
      has_data_privacy_policy: form.has_data_privacy_policy,
      has_product_labelling: form.has_product_labelling,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('brsr_profile').upsert(payload, { onConflict: 'account_id' });
    setSaving(false);

    if (error) { alert('Failed to save BRSR profile: ' + error.message); return; }

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

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  // Completion calculations
  const filled = (v: string) => v.trim() !== '';
  const aFields = [
    form.cin, form.year_of_incorporation, form.registered_office_address, form.company_website,
    form.paid_up_capital_inr, form.stock_exchange, form.brsr_contact_name, form.brsr_contact_designation,
    form.brsr_contact_email, form.brsr_contact_phone, form.reporting_boundary,
    form.male_permanent_employees, form.female_permanent_employees, form.differently_abled_employees,
    form.women_on_board, form.total_board_members, form.women_in_kmp, form.total_kmp,
    form.num_national_locations, form.num_international_locations, form.export_pct,
    form.annual_turnover_inr, form.net_worth_inr,
  ];
  const pctA = Math.round(aFields.filter(filled).length / aFields.length * 100);

  const bPrinciples = ['p1','p2','p3','p4','p5','p6','p7','p8','p9'] as const;
  const bFilled = bPrinciples.filter(p => form[`${p}_policy_exists`] || filled(form[`${p}_policy_url`])).length
    + (filled(form.brsr_director_name) ? 1 : 0)
    + (filled(form.brsr_committee_name) ? 1 : 0);
  const pctB = Math.round(bFilled / 11 * 100);

  // Section C: booleans always count as answered, strings need to be non-empty
  const cBooleans = 12; // 12 boolean fields always answered
  const cStrings = [
    form.is_listed_company, form.sustainable_product_pct, form.rd_sustainability_spend,
    form.permanent_employees, form.permanent_workers, form.training_hours_per_employee,
    form.stakeholder_groups, form.stakeholder_engagement_frequency, form.human_rights_complaints,
    form.industry_sector, form.renewable_elec_pct, form.industry_associations,
    form.policy_advocacy_positions, form.csr_spend_inr, form.social_impact_projects,
  ];
  const pctC = Math.round((cBooleans + cStrings.filter(filled).length) / (cBooleans + cStrings.length) * 100);

  const pctColor = (p: number) => p === 100 ? 'text-emerald-600' : p > 0 ? 'text-amber-500' : 'text-slate-400';

  const tabs = [
    { key: 'a' as const, label: 'Section A', sub: 'General Disclosures', pct: pctA },
    { key: 'b' as const, label: 'Section B', sub: 'Management & Policy', pct: pctB },
    { key: 'c' as const, label: 'Section C', sub: 'Performance Data', pct: pctC },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">

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
            {isEnterprise && <span className="text-[10px] uppercase tracking-widest text-violet-700 font-semibold bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">Enterprise</span>}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">BRSR Company Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            {isEnterprise
              ? 'Complete all three sections to generate a full SEBI BRSR filing. Section C performance data is auto-populated from your Greenio emissions entries.'
              : 'Required for SEBI Business Responsibility & Sustainability Report (BRSR) compliance. Complete Principle 6 to generate your BRSR Environment Disclosure.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Tab nav - enterprise only */}
          {isEnterprise && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {tabs.map(t => (
                <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                  <span className="font-semibold">{t.label}</span>
                  <span className="block text-[10px] font-normal opacity-70">{t.sub}</span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${t.pct === 100 ? 'bg-emerald-500' : t.pct > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${t.pct}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold tabular-nums ${t.pct === 100 ? 'text-emerald-600' : t.pct > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{t.pct}%</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ==================== SECTION A ==================== */}
          {isEnterprise && activeTab === 'a' && (
            <div className="space-y-4">

              {/* Entity Details */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">I. Entity Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="CIN (Corporate Identity Number)" hint="21-character CIN from MCA">
                    <input type="text" className={inputCls} placeholder="L12345MH2010PLC123456" value={form.cin} onChange={e => update('cin', e.target.value)} />
                  </Field>
                  <Field label="Year of incorporation">
                    <input type="number" className={inputCls} placeholder="e.g. 2005" min="1800" max="2100" value={form.year_of_incorporation} onChange={e => update('year_of_incorporation', e.target.value)} />
                  </Field>
                </div>
                <Field label="Registered office address">
                  <textarea className={inputCls} rows={2} placeholder="Full registered address" value={form.registered_office_address} onChange={e => update('registered_office_address', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Company website">
                    <input type="url" className={inputCls} placeholder="https://example.com" value={form.company_website} onChange={e => update('company_website', e.target.value)} />
                  </Field>
                  <Field label="Paid-up capital (INR)">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 10000000" value={form.paid_up_capital_inr} onChange={e => update('paid_up_capital_inr', e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Stock exchange listing">
                    <select className={inputCls} value={form.stock_exchange} onChange={e => update('stock_exchange', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="Unlisted">Unlisted</option>
                      <option value="BSE">BSE</option>
                      <option value="NSE">NSE</option>
                      <option value="BSE & NSE">BSE &amp; NSE</option>
                      <option value="NSE SME">NSE SME</option>
                      <option value="BSE SME">BSE SME</option>
                    </select>
                  </Field>
                  <Field label="Reporting boundary">
                    <select className={inputCls} value={form.reporting_boundary} onChange={e => update('reporting_boundary', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="Standalone">Standalone</option>
                      <option value="Consolidated">Consolidated</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* BRSR Contact */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">BRSR Contact Person</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" required>
                    <input type="text" className={inputCls} placeholder="Full name" value={form.brsr_contact_name} onChange={e => update('brsr_contact_name', e.target.value)} />
                  </Field>
                  <Field label="Designation">
                    <input type="text" className={inputCls} placeholder="e.g. Chief Sustainability Officer" value={form.brsr_contact_designation} onChange={e => update('brsr_contact_designation', e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inputCls} placeholder="name@company.com" value={form.brsr_contact_email} onChange={e => update('brsr_contact_email', e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" className={inputCls} placeholder="+91 98765 43210" value={form.brsr_contact_phone} onChange={e => update('brsr_contact_phone', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Workforce gender split */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">II. Workforce Composition</h2>
                <p className="text-xs text-slate-500">BRSR requires gender-disaggregated workforce data.</p>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Male permanent employees">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 200" value={form.male_permanent_employees} onChange={e => update('male_permanent_employees', e.target.value)} />
                  </Field>
                  <Field label="Female permanent employees">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 80" value={form.female_permanent_employees} onChange={e => update('female_permanent_employees', e.target.value)} />
                  </Field>
                  <Field label="Differently abled employees">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 5" value={form.differently_abled_employees} onChange={e => update('differently_abled_employees', e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Women on Board of Directors" hint="Number of women directors">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 2" value={form.women_on_board} onChange={e => update('women_on_board', e.target.value)} />
                  </Field>
                  <Field label="Total Board members">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 8" value={form.total_board_members} onChange={e => update('total_board_members', e.target.value)} />
                  </Field>
                  <Field label="Women in Key Management Personnel">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 1" value={form.women_in_kmp} onChange={e => update('women_in_kmp', e.target.value)} />
                  </Field>
                  <Field label="Total KMP count">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 5" value={form.total_kmp} onChange={e => update('total_kmp', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Markets & Operations */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">III. Markets & Operations</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="National locations (states / UTs)">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 5" value={form.num_national_locations} onChange={e => update('num_national_locations', e.target.value)} />
                  </Field>
                  <Field label="International locations (countries)">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 2" value={form.num_international_locations} onChange={e => update('num_international_locations', e.target.value)} />
                  </Field>
                  <Field label="Exports as % of total turnover">
                    <input type="number" min="0" max="100" step="0.1" className={inputCls} placeholder="e.g. 15" value={form.export_pct} onChange={e => update('export_pct', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Financials */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">IV. Financials</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Annual turnover (INR)" hint="For current financial year">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 500000000" value={form.annual_turnover_inr} onChange={e => update('annual_turnover_inr', e.target.value)} />
                  </Field>
                  <Field label="Net worth (INR)">
                    <input type="number" min="0" className={inputCls} placeholder="e.g. 200000000" value={form.net_worth_inr} onChange={e => update('net_worth_inr', e.target.value)} />
                  </Field>
                </div>
              </div>

            </div>
          )}

          {/* ==================== SECTION B ==================== */}
          {isEnterprise && activeTab === 'b' && (
            <div className="space-y-4">

              {/* Policy matrix */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Policy Coverage Matrix</h2>
                <p className="text-xs text-slate-500">For each BRSR principle, indicate whether a policy exists, whether it is Board-approved, whether it extends to value chain partners, and provide a URL if available.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="text-left px-3 py-2 font-medium w-48">Principle</th>
                        <th className="px-3 py-2 font-medium text-center">Policy exists</th>
                        <th className="px-3 py-2 font-medium text-center">Board approved</th>
                        <th className="px-3 py-2 font-medium text-center">Extends to value chain</th>
                        <th className="px-3 py-2 font-medium text-left">Policy URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {PRINCIPLES.map(p => {
                        const pk = p.key as 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8' | 'p9';
                        return (
                          <tr key={pk} className="hover:bg-slate-50">
                            <td className="px-3 py-3">
                              <span className="font-semibold text-emerald-700">{p.label}</span>
                              <span className="block text-slate-500 text-[10px] leading-tight mt-0.5">{p.title}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <input type="checkbox" checked={form[`${pk}_policy_exists`]} onChange={e => update(`${pk}_policy_exists`, e.target.checked)} className="accent-emerald-600" />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <input type="checkbox" checked={form[`${pk}_board_approved`]} onChange={e => update(`${pk}_board_approved`, e.target.checked)} className="accent-emerald-600" disabled={!form[`${pk}_policy_exists`]} />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <input type="checkbox" checked={form[`${pk}_extends_to_vc`]} onChange={e => update(`${pk}_extends_to_vc`, e.target.checked)} className="accent-emerald-600" disabled={!form[`${pk}_policy_exists`]} />
                            </td>
                            <td className="px-3 py-3">
                              <input type="url" className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="https://" value={form[`${pk}_policy_url`]} onChange={e => update(`${pk}_policy_url`, e.target.value)} disabled={!form[`${pk}_policy_exists`]} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Governance */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Governance</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Director responsible for BRSR" hint="Name and designation">
                    <input type="text" className={inputCls} placeholder="e.g. Priya Sharma, CFO" value={form.brsr_director_name} onChange={e => update('brsr_director_name', e.target.value)} />
                  </Field>
                  <Field label="Board committee overseeing BRSR" hint="Leave blank if none">
                    <input type="text" className={inputCls} placeholder="e.g. CSR & ESG Committee" value={form.brsr_committee_name} onChange={e => update('brsr_committee_name', e.target.value)} />
                  </Field>
                </div>
              </div>

            </div>
          )}

          {/* ==================== SECTION C ==================== */}
          {(!isEnterprise || activeTab === 'c') && (
            <div className="space-y-4">

              {/* Enterprise P1-P5 */}
              {isEnterprise ? (
                <>
                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P1" title="Ethics, Transparency & Accountability" desc="Policies governing ethical conduct, anti-corruption, and whistleblower protection." />
                    <div>
                      <label className="text-xs font-medium text-slate-700">Listed company status</label>
                      <div className="mt-2 flex flex-col gap-2">
                        {[{ value: 'yes', label: 'Yes - listed company' }, { value: 'no', label: 'No - unlisted company' }, { value: 'subsidiary', label: 'Subsidiary of a listed company' }].map(({ value, label }) => (
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

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P2" title="Sustainable & Safe Products / Services" desc="Product lifecycle, Extended Producer Responsibility (EPR), and R&D sustainability spend." />
                    <CheckField label="Extended Producer Responsibility (EPR) compliance" checked={form.has_epr_compliance} onChange={v => update('has_epr_compliance', v)} hint="Applicable if your products generate e-waste, plastic, or battery waste" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Sustainable products / services (%)" hint="% of turnover from sustainable products">
                        <input type="number" min="0" max="100" step="0.1" className={inputCls} placeholder="e.g. 30" value={form.sustainable_product_pct} onChange={e => update('sustainable_product_pct', e.target.value)} />
                      </Field>
                      <Field label="R&D sustainability spend (INR)" hint="Annual spend on sustainability R&D">
                        <input type="number" min="0" className={inputCls} placeholder="e.g. 500000" value={form.rd_sustainability_spend} onChange={e => update('rd_sustainability_spend', e.target.value)} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P3" title="Employee Wellbeing" desc="Health, safety, training, and welfare of employees and workers." />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Permanent employees" required hint="Full-time + part-time on payroll">
                        <input type="number" min="0" className={inputCls} placeholder="e.g. 250" value={form.permanent_employees} onChange={e => update('permanent_employees', e.target.value)} required />
                      </Field>
                      <Field label="Permanent workers" required hint="On-site contract / casual workers">
                        <input type="number" min="0" className={inputCls} placeholder="e.g. 80" value={form.permanent_workers} onChange={e => update('permanent_workers', e.target.value)} required />
                      </Field>
                    </div>
                    <Field label="Average training hours per employee per year">
                      <input type="number" min="0" step="0.5" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 20" value={form.training_hours_per_employee} onChange={e => update('training_hours_per_employee', e.target.value)} />
                    </Field>
                    <CheckField label="Health insurance provided to all employees" checked={form.has_health_insurance} onChange={v => update('has_health_insurance', v)} />
                    <CheckField label="Maternity / paternity benefits in place" checked={form.has_maternity_paternity} onChange={v => update('has_maternity_paternity', v)} />
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P4" title="Stakeholder Engagement" desc="Identification of and engagement with key stakeholder groups." />
                    <Field label="Key stakeholder groups" hint="Comma-separated list">
                      <input type="text" className={inputCls} placeholder="e.g. Employees, Customers, Suppliers, Investors, Community" value={form.stakeholder_groups} onChange={e => update('stakeholder_groups', e.target.value)} />
                    </Field>
                    <Field label="Engagement frequency">
                      <select className={inputCls} value={form.stakeholder_engagement_frequency} onChange={e => update('stakeholder_engagement_frequency', e.target.value)}>
                        <option value="">Select frequency...</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Half-yearly">Half-yearly</option>
                        <option value="Annually">Annually</option>
                        <option value="Ad hoc">Ad hoc</option>
                      </select>
                    </Field>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P5" title="Human Rights" desc="Policies, training, and grievance mechanisms covering human rights across the value chain." />
                    <CheckField label="Human rights policy in place" checked={form.has_human_rights_policy} onChange={v => update('has_human_rights_policy', v)} hint="Covers employees, workers, and supply chain partners" />
                    <CheckField label="Human rights training provided to employees" checked={form.human_rights_training} onChange={v => update('human_rights_training', v)} />
                    <Field label="Human rights complaints received (this year)">
                      <input type="number" min="0" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 0" value={form.human_rights_complaints} onChange={e => update('human_rights_complaints', e.target.value)} />
                    </Field>
                  </div>
                </>
              ) : (
                /* SME upgrade banner */
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Full BRSR Disclosure - Enterprise plan</p>
                      <p className="text-sm text-slate-600 mt-1">
                        Your current plan includes Environment Disclosure (Principle 6). Upgrade to Enterprise to unlock all 9 BRSR principles and Sections A and B for a complete SEBI filing.
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
                <Field label="Industry sector">
                  <select className={inputCls} value={form.industry_sector} onChange={e => update('industry_sector', e.target.value)}>
                    <option value="">Select sector...</option>
                    {INDUSTRY_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Renewable electricity percentage" hint="Share of electricity from renewable sources">
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" step="0.01" className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="0-100" value={form.renewable_elec_pct} onChange={e => update('renewable_elec_pct', e.target.value)} />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </Field>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.has_ghg_reduction_plan} onChange={e => update('has_ghg_reduction_plan', e.target.checked)} className="accent-emerald-600" />
                    We have a GHG reduction plan
                  </label>
                  {form.has_ghg_reduction_plan && (
                    <textarea className={`mt-2 ${inputCls}`} rows={3} placeholder="Briefly describe your GHG reduction plan..." value={form.ghg_reduction_detail} onChange={e => update('ghg_reduction_detail', e.target.value)} />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  GHG emissions, energy consumption, water, waste and air quality data are auto-populated from your Greenio emissions entries.
                </p>
              </div>

              {/* P7-P9: Enterprise only */}
              {isEnterprise && (
                <>
                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P7" title="Policy & Regulatory Advocacy" desc="Industry associations and public policy positions your company supports or advocates." />
                    <Field label="Industry / trade associations" hint="Associations your company is a member of">
                      <input type="text" className={inputCls} placeholder="e.g. CII, FICCI, NASSCOM" value={form.industry_associations} onChange={e => update('industry_associations', e.target.value)} />
                    </Field>
                    <Field label="Policy advocacy positions">
                      <textarea className={inputCls} rows={3} placeholder="Describe any public policy positions your company has taken..." value={form.policy_advocacy_positions} onChange={e => update('policy_advocacy_positions', e.target.value)} />
                    </Field>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P8" title="Inclusive Growth & Equitable Development" desc="CSR spending and social impact programmes benefiting communities." />
                    <Field label="CSR spend (INR)" hint="Annual CSR expenditure">
                      <input type="number" min="0" className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 2000000" value={form.csr_spend_inr} onChange={e => update('csr_spend_inr', e.target.value)} />
                    </Field>
                    <Field label="Social impact projects">
                      <textarea className={inputCls} rows={3} placeholder="Describe key CSR or social impact initiatives..." value={form.social_impact_projects} onChange={e => update('social_impact_projects', e.target.value)} />
                    </Field>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-6 shadow space-y-4">
                    <SectionHeader principle="P9" title="Consumer Responsibility" desc="Mechanisms for consumer complaints, data privacy, and product labelling." />
                    <CheckField label="Consumer complaint / grievance mechanism in place" checked={form.has_consumer_complaint_mechanism} onChange={v => update('has_consumer_complaint_mechanism', v)} />
                    <CheckField label="Data privacy policy in place" checked={form.has_data_privacy_policy} onChange={v => update('has_data_privacy_policy', v)} hint="Covers collection, storage and use of customer data" />
                    <CheckField label="Product labelling / disclosure in place" checked={form.has_product_labelling} onChange={v => update('has_product_labelling', v)} hint="Environmental or safety labelling on products" />
                  </div>
                </>
              )}

            </div>
          )}

          {/* Save button */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 shadow flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : isOnboarding ? 'Save & go to dashboard \u2192' : 'Save BRSR profile'}
            </button>
            {isEnterprise && activeTab !== 'c' && (
              <button type="button" onClick={() => setActiveTab(activeTab === 'a' ? 'b' : 'c')} className="rounded-full border border-slate-200 text-slate-700 px-5 py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                Next section &rarr;
              </button>
            )}
            {isOnboarding && (
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                Skip for now
              </Link>
            )}
            {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
          </div>

        </form>

        {/* India feature toggles */}
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
      const { data } = await supabase.from('profiles').select('india_water_enabled, india_waste_enabled, india_air_enabled').eq('id', user.id).maybeSingle();
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
    if (user) await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
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
