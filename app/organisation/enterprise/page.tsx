'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getOrgWithHierarchy,
  getUserOrgs,
  isEnterpriseUser,
  createEntity,
  createSite,
  type OrgWithHierarchy,
  type Entity,
  type Site,
  type OrgMember,
} from '@/lib/enterprise';

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberWithEmail = OrgMember & { email: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const flagEmoji = (code: string): string =>
  code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');

function fmtDate(iso: string | null): string {
  if (!iso) return 'Pending';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fyMonthLabel(n: number | null): string {
  if (!n) return '—';
  return FY_MONTHS.find(m => m.value === n)?.label ?? String(n);
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Agriculture & Farming', 'Construction', 'Education', 'Financial Services',
  'Food & Beverage', 'Healthcare', 'Hospitality & Tourism', 'IT & Technology',
  'Logistics & Transport', 'Manufacturing', 'Professional Services', 'Real Estate',
  'Retail', 'Utilities & Energy', 'Waste Management', 'Other',
];

const EU_COUNTRIES = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

function getComplianceConfig(country: string) {
  if (country === 'GB') return {
    framework: 'SECR', revenueLabel: 'Annual revenue (£)', postcodeLabel: 'Postcode',
    checkboxLabel: 'My company is required to comply with SECR (Streamlined Energy and Carbon Reporting).',
    description: 'Required for large UK companies (250+ employees or £36M+ turnover).',
    sectionTitle: 'SECR reporting', showEnergyActions: true,
    energyActionsLabel: 'Energy efficiency actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to BEIS/DEFRA official sources.',
  };
  if (EU_COUNTRIES.has(country)) return {
    framework: 'CSRD', revenueLabel: 'Annual revenue (€)', postcodeLabel: 'Postal code',
    checkboxLabel: 'My company is required to comply with CSRD (Corporate Sustainability Reporting Directive).',
    description: 'Applies to large EU companies (250+ employees or €40M+ net turnover).',
    sectionTitle: 'CSRD reporting', showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to Eurostat and IEA official sources.',
  };
  if (country === 'IN') return {
    framework: 'BRSR', revenueLabel: 'Annual revenue (₹)', postcodeLabel: 'PIN code',
    checkboxLabel: 'My company is required to comply with BRSR (Business Responsibility and Sustainability Report).',
    description: 'Mandatory for top 1,000 listed Indian companies under SEBI regulations.',
    sectionTitle: 'BRSR reporting', showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: "Greenio uses geo-optimised emission factors aligned to CEA/IEA official sources.",
  };
  return {
    framework: '', revenueLabel: 'Annual revenue', postcodeLabel: 'Postcode / ZIP / PIN',
    checkboxLabel: 'My company is subject to mandatory sustainability reporting.',
    description: 'Select a country above to see applicable compliance frameworks.',
    sectionTitle: 'Regulatory reporting', showEnergyActions: false,
    energyActionsLabel: 'Sustainability actions taken this reporting year',
    methodologyNote: 'Greenio uses geo-optimised emission factors aligned to official sources per country.',
  };
}

// ─── Activity helpers ─────────────────────────────────────────────────────────

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
      electricity_kwh: 'electricity (kWh)', diesel_l: 'diesel (L)', petrol_l: 'petrol (L)',
      gas_kwh: 'gas (kWh)', refrigerant_kg: 'refrigerant (kg)', co2e_kg: 'CO₂e (kg)',
    };
    return Object.entries(changes)
      .map(([k, v]) => `${LABELS[k] ?? k}: ${Number(v.from).toLocaleString()} → ${Number(v.to).toLocaleString()}`)
      .join(' · ');
  }
  if (action === 'delete') return detail.co2e_kg ? `${Number(detail.co2e_kg).toLocaleString()} kg CO₂e` : '';
  if (['export_pdf','export_csv','export_xls','snapshot','export_ccts_pkg','bulk_upload','bulk_update','tally_import'].includes(action))
    return detail.period ? String(detail.period) : (detail.month ? String(detail.month) : '');
  return '';
}

function actionLabel(action: string): { label: string; color: string } {
  switch (action) {
    case 'create':            return { label: 'Added emission',        color: 'bg-emerald-100 text-emerald-700' };
    case 'update':            return { label: 'Edited emission',       color: 'bg-amber-100 text-amber-700' };
    case 'delete':            return { label: 'Deleted emission',      color: 'bg-rose-100 text-rose-700' };
    case 'bulk_upload':       return { label: 'Bulk uploaded',         color: 'bg-emerald-100 text-emerald-700' };
    case 'bulk_update':       return { label: 'Bulk consolidated',     color: 'bg-amber-100 text-amber-700' };
    case 'tally_import':      return { label: 'Tally import applied',  color: 'bg-violet-100 text-violet-700' };
    case 'export_csv':        return { label: 'Exported CSV',          color: 'bg-blue-100 text-blue-700' };
    case 'export_xls':        return { label: 'Exported Excel',        color: 'bg-blue-100 text-blue-700' };
    case 'export_ccts_pkg':   return { label: 'CCTS package exported', color: 'bg-blue-100 text-blue-700' };
    case 'snapshot':          return { label: 'Downloaded Snapshot',   color: 'bg-purple-100 text-purple-700' };
    case 'export_pdf':        return { label: 'Downloaded Report',     color: 'bg-indigo-100 text-indigo-700' };
    default:                  return { label: action,                  color: 'bg-slate-100 text-slate-600' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: OrgMember['role'] }) {
  const styles: Record<string, string> = {
    owner:  'bg-slate-800 text-white',
    admin:  'bg-blue-100 text-blue-700',
    member: 'bg-emerald-100 text-emerald-700',
    viewer: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[role] ?? styles.viewer}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: OrgMember['status'] }) {
  const styles: Record<string, string> = {
    active:    'bg-emerald-100 text-emerald-700',
    pending:   'bg-amber-100 text-amber-700',
    suspended: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EnterpriseOrgPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<OrgWithHierarchy | null>(null);
  const [tab, setTab] = useState<'overview' | 'entities' | 'profile' | 'activity' | 'members'>('overview');

  // Profile tab state
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    company_name: '', industry: '', country: '', city: '', address: '', postcode: '',
    company_size: '', secr_required: false, data_confirmed_by_user: false,
    sustainability_stage: '', contact_name: '', contact_email: '',
    has_company_vehicles: false, renewable_energy_tariff: false,
    annual_revenue: '', employee_count: '', annual_output_units: '',
    methodology_confirmed: false, energy_efficiency_actions: '',
  });

  // Activity tab state
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Overview — expanded entity ids
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  // Entities tab — add entity form
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [entitySaving, setEntitySaving] = useState(false);
  const [entityForm, setEntityForm] = useState({
    name: '', country_code: '', industry: '', fy_start_month: 4,
    secr_required: false, csrd_required: false, brsr_required: false,
  });

  // Entities tab — add site form (keyed by entity id, or null)
  const [addSiteForEntity, setAddSiteForEntity] = useState<string | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteForm, setSiteForm] = useState({
    name: '', address: '', city: '', postcode: '', country_code: '', is_primary: true,
  });

  // Members tab — invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Mount: guard + load ───────────────────────────────────────────────────
  useEffect(() => {
    // Seed from cache for instant paint
    try {
      const cached = sessionStorage.getItem('greenio_enterprise_org_v1');
      if (cached) {
        const { orgData: cachedOrg, members: cachedMembers } = JSON.parse(cached);
        if (cachedOrg) { setOrgData(cachedOrg); setLoading(false); }
        if (cachedMembers) setMembers(cachedMembers);
      }
    } catch {}

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { router.replace('/login'); return; }

        setCurrentUserId(user.id);
        const enterprise = await isEnterpriseUser(user.id);
        if (!enterprise) { router.replace('/organisation'); return; }

        const orgs = await getUserOrgs(user.id);
        if (orgs.length === 0) { router.replace('/enterprise/onboarding'); return; }

        const data = await getOrgWithHierarchy(orgs[0].id);
        if (!data) throw new Error('Organisation not found.');
        setOrgData(data);
        setLoading(false);

        // Fetch member emails from API — include auth token
        try {
          const token = session?.access_token;
          const res = await fetch(`/api/org/members?org_id=${data.id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const resolved = await res.json();
            setMembers(resolved);
            // Write to cache so next visit is instant
            try { sessionStorage.setItem('greenio_enterprise_org_v1', JSON.stringify({ orgData: data, members: resolved })); } catch {}
          } else {
            try { sessionStorage.setItem('greenio_enterprise_org_v1', JSON.stringify({ orgData: data, members: [] })); } catch {}
          }
        } catch {
          try { sessionStorage.setItem('greenio_enterprise_org_v1', JSON.stringify({ orgData: data, members: [] })); } catch {}
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load organisation.');
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        setProfileForm({
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
          contact_name:              profile.contact_name              || '',
          contact_email:             profile.contact_email             || '',
          has_company_vehicles:      profile.has_company_vehicles      || false,
          renewable_energy_tariff:   profile.renewable_energy_tariff   || false,
          annual_revenue:            profile.annual_revenue            || '',
          employee_count:            profile.employee_count            || '',
          annual_output_units:       profile.annual_output_units       || '',
          methodology_confirmed:     profile.methodology_confirmed     || false,
          energy_efficiency_actions: profile.energy_efficiency_actions || '',
        });
      }
      setProfileLoading(false);
    }
    loadProfile();
  }, []);

  // ── Load activity ─────────────────────────────────────────────────────────
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

  // ── Save profile ──────────────────────────────────────────────────────────
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      ...profileForm,
      annual_revenue:      profileForm.annual_revenue      ? Number(profileForm.annual_revenue)      : null,
      employee_count:      profileForm.employee_count      ? Number(profileForm.employee_count)      : null,
      annual_output_units: profileForm.annual_output_units ? Number(profileForm.annual_output_units) : null,
    };
    const { error: saveErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setProfileSaving(false);
    if (saveErr) { console.error(saveErr); alert('Failed to save profile.'); return; }
    alert('Profile updated successfully.');
  }

  // ── Invite member ──────────────────────────────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!orgData || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch('/api/org/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgData.id, email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send invite');
      const sentEmail = inviteEmail.trim();
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
      setInviteSuccess(`Invite sent to ${sentEmail}`);
      setTimeout(() => setInviteSuccess(null), 3000);
      await reloadOrg();
    } catch (err: any) {
      setInviteError(err?.message ?? 'Something went wrong.');
    } finally {
      setInviteLoading(false);
    }
  }

// ── Helpers ───────────────────────────────────────────────────────────────

  async function reloadOrg() {
    if (!orgData) return;
    const data = await getOrgWithHierarchy(orgData.id);
    if (data) setOrgData(data);
  }

  function toggleEntity(id: string) {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Add entity ────────────────────────────────────────────────────────────

  async function handleAddEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!orgData || !entityForm.name.trim() || !entityForm.country_code) return;
    setEntitySaving(true);
    setError(null);
    try {
      await createEntity(orgData.id, {
        name: entityForm.name.trim(),
        country_code: entityForm.country_code,
        industry: entityForm.industry.trim() || null,
        fy_start_month: entityForm.fy_start_month,
        secr_required: entityForm.secr_required,
        csrd_required: entityForm.csrd_required,
        brsr_required: entityForm.brsr_required,
        currency: null,
        locale: null,
        company_size: null,
        annual_revenue: null,
        employee_count: null,
      });
      setEntityForm({ name: '', country_code: '', industry: '', fy_start_month: 4, secr_required: false, csrd_required: false, brsr_required: false });
      setShowAddEntity(false);
      await reloadOrg();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create entity.');
    } finally {
      setEntitySaving(false);
    }
  }

  // ── Add site ──────────────────────────────────────────────────────────────

  function openAddSite(entity: Entity & { sites: Site[] }) {
    setSiteForm({ name: '', address: '', city: '', postcode: '', country_code: entity.country_code, is_primary: true });
    setAddSiteForEntity(entity.id);
  }

  async function handleAddSite(e: React.FormEvent, entityId: string) {
    e.preventDefault();
    if (!orgData || !siteForm.name.trim() || !siteForm.country_code) return;
    setSiteSaving(true);
    setError(null);
    try {
      await createSite(entityId, orgData.id, {
        name: siteForm.name.trim(),
        address: siteForm.address.trim() || null,
        city: siteForm.city.trim() || null,
        postcode: siteForm.postcode.trim() || null,
        country_code: siteForm.country_code,
        is_primary: siteForm.is_primary,
      });
      setAddSiteForEntity(null);
      setSiteForm({ name: '', address: '', city: '', postcode: '', country_code: '', is_primary: true });
      await reloadOrg();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create site.');
    } finally {
      setSiteSaving(false);
    }
  }

  // ── Derived permissions ──────────────────────────────────────────────────
  const currentUserRole = orgData?.members.find(m => m.user_id === currentUserId)?.role;
  const canManage = currentUserRole === 'admin' || currentUserRole === 'owner';

  // ── Derived activity ──────────────────────────────────────────────────────
  const compliance = getComplianceConfig(profileForm.country);
  const roProfileClass = !canManage ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : '';
  const distinctMembers = Array.from(new Map(activityRows.map((r) => [r.actor_id, r.actor_name])).entries());
  const filteredActivity = activityRows.filter((r) => {
    if (memberFilter && r.actor_id !== memberFilter) return false;
    if (actionFilter === 'emissions' && !['create','update','delete','bulk_upload','bulk_update','tally_import'].includes(r.action)) return false;
    if (actionFilter === 'exports' && !['export_csv','export_xls','export_ccts_pkg','snapshot','export_pdf'].includes(r.action)) return false;
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded" />
          <div className="flex gap-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 w-24 bg-slate-200 rounded-full" />)}</div>
          <div className="rounded-xl bg-white border border-slate-200 shadow p-6 space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="h-6 bg-slate-100 rounded w-full" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
          ← Dashboard
        </a>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Enterprise organisation</h1>
          {orgData && !canManage && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
              View only
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">Manage your organisation, legal entities, sites, and members.</p>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tab bar */}
        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {(['overview', 'entities', 'profile', 'activity', 'members'] as const).map((t) => (
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
          <a
            href="/organisation/enterprise/audit"
            className="px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors border-transparent text-slate-500 hover:text-slate-700"
          >
            Audit
          </a>
          <a
            href="/organisation/enterprise/api-keys"
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-transparent text-slate-500 hover:text-slate-700"
          >
            API Keys
          </a>
        </div>

        {/* ── TAB 1: Overview ── */}
        {tab === 'overview' && orgData && (
          <div className="mt-6 space-y-6">

            {/* Summary card */}
            <div className="rounded-xl bg-white border border-slate-200 shadow p-6">
              <h2 className="text-xl font-semibold text-slate-900">{orgData.name}</h2>
              <p className="text-xs text-slate-400 mt-1">Created {fmtDate(orgData.created_at)}</p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                {[
                  { label: 'Entities', value: orgData.entities.length },
                  { label: 'Sites', value: orgData.entities.reduce((n, e) => n + e.sites.length, 0) },
                  { label: 'Members', value: orgData.members.length },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Entity → site hierarchy */}
            <div className="rounded-xl bg-white border border-slate-200 shadow p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Hierarchy</h3>
              {orgData.entities.length === 0 ? (
                <p className="text-sm text-slate-400">No entities yet.</p>
              ) : (
                <div className="space-y-2">
                  {orgData.entities.map((entity) => (
                    <div key={entity.id} className="rounded-lg border border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleEntity(entity.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{flagEmoji(entity.country_code)}</span>
                          <span className="text-sm font-medium text-slate-800">{entity.name}</span>
                          <span className="text-xs text-slate-400">{entity.country_code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{entity.sites.length} site{entity.sites.length !== 1 ? 's' : ''}</span>
                          <span className="text-slate-400 text-xs">{expandedEntities.has(entity.id) ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {expandedEntities.has(entity.id) && (
                        <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-2">
                          {entity.sites.length === 0 ? (
                            <p className="text-xs text-slate-400 py-1">No sites for this entity.</p>
                          ) : (
                            entity.sites.map((site) => (
                              <div key={site.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-sm">{site.country_code ? flagEmoji(site.country_code) : '🏢'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-700">{site.name}</p>
                                  {(site.city || site.country_code) && (
                                    <p className="text-[11px] text-slate-400">{[site.city, site.country_code].filter(Boolean).join(', ')}</p>
                                  )}
                                </div>
                                {site.is_primary && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                    primary
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Entities ── */}
        {tab === 'entities' && orgData && (
          <div className="mt-6 space-y-4">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{orgData.entities.length} legal {orgData.entities.length === 1 ? 'entity' : 'entities'}</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => { setShowAddEntity(v => !v); setError(null); }}
                  className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  {showAddEntity ? '✕ Cancel' : '+ Add entity'}
                </button>
              )}
            </div>

            {/* Add entity inline form */}
            {showAddEntity && (
              <form
                onSubmit={handleAddEntity}
                className="rounded-xl bg-white border border-slate-200 shadow p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-slate-700">New legal entity</h3>
                <div>
                  <label className="text-xs font-medium text-slate-600">Entity name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. Acme UK Ltd"
                    value={entityForm.name}
                    onChange={e => setEntityForm(f => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Country <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={entityForm.country_code}
                    onChange={e => setEntityForm(f => ({ ...f, country_code: e.target.value, secr_required: false, csrd_required: false, brsr_required: false }))}
                    required
                  >
                    <option value="">Select country…</option>
                    {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Industry <span className="text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. Manufacturing"
                    value={entityForm.industry}
                    onChange={e => setEntityForm(f => ({ ...f, industry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Financial year start month <span className="text-slate-400">(optional)</span></label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={entityForm.fy_start_month}
                    onChange={e => setEntityForm(f => ({ ...f, fy_start_month: Number(e.target.value) }))}
                  >
                    {FY_MONTHS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {entityForm.country_code && (
                  <div className="space-y-2 pt-1">
                    {entityForm.country_code === 'GB' && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entityForm.secr_required}
                          onChange={e => setEntityForm(f => ({ ...f, secr_required: e.target.checked }))}
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
                    {['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE'].includes(entityForm.country_code) && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entityForm.csrd_required}
                          onChange={e => setEntityForm(f => ({ ...f, csrd_required: e.target.checked }))}
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
                    {entityForm.country_code === 'IN' && (
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={entityForm.brsr_required}
                          onChange={e => setEntityForm(f => ({ ...f, brsr_required: e.target.checked }))}
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
                <button
                  type="submit"
                  disabled={entitySaving}
                  className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {entitySaving ? 'Saving…' : 'Create entity'}
                </button>
              </form>
            )}

            {/* Entity list */}
            {orgData.entities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No entities yet. Add your first legal entity above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orgData.entities.map((entity) => (
                  <div key={entity.id} className="rounded-xl bg-white border border-slate-200 shadow">
                    {/* Entity header */}
                    <div className="flex items-start justify-between px-5 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{flagEmoji(entity.country_code)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{entity.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-xs text-slate-400">{entity.country_code}</span>
                            {entity.industry && (
                              <span className="text-xs text-slate-400">· {entity.industry}</span>
                            )}
                            <span className="text-xs text-slate-400">· FY starts {fyMonthLabel(entity.fy_start_month)}</span>
                            {entity.secr_required && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">SECR</span>
                            )}
                            {entity.csrd_required && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">CSRD</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (addSiteForEntity === entity.id) {
                            setAddSiteForEntity(null);
                          } else {
                            openAddSite(entity);
                            setError(null);
                          }
                        }}
                        className="shrink-0 ml-4 inline-flex items-center h-[28px] px-3 rounded-full border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50"
                      >
                        {addSiteForEntity === entity.id ? '✕ Cancel' : '+ Add site'}
                      </button>
                    </div>

                    {/* Add site inline form */}
                    {addSiteForEntity === entity.id && (
                      <form
                        onSubmit={e => handleAddSite(e, entity.id)}
                        className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50 rounded-b-xl"
                      >
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">New site for {entity.name}</h4>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Site name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                            placeholder="e.g. London HQ"
                            value={siteForm.name}
                            onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                            required
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Address <span className="text-slate-400">(optional)</span></label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                            placeholder="e.g. 10 Oxford Street"
                            value={siteForm.address}
                            onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-600">City <span className="text-slate-400">(optional)</span></label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                              placeholder="e.g. London"
                              value={siteForm.city}
                              onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Postcode <span className="text-slate-400">(optional)</span></label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                              placeholder="e.g. W1D 1NN"
                              value={siteForm.postcode}
                              onChange={e => setSiteForm(f => ({ ...f, postcode: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Country <span className="text-red-500">*</span></label>
                          <select
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                            value={siteForm.country_code}
                            onChange={e => setSiteForm(f => ({ ...f, country_code: e.target.value }))}
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
                            checked={siteForm.is_primary}
                            onChange={e => setSiteForm(f => ({ ...f, is_primary: e.target.checked }))}
                          />
                          Mark as primary site for this entity
                        </label>
                        <button
                          type="submit"
                          disabled={siteSaving}
                          className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                        >
                          {siteSaving ? 'Saving…' : 'Create site'}
                        </button>
                      </form>
                    )}

                    {/* Sites list */}
                    {entity.sites.length > 0 && (
                      <div className="border-t border-slate-100 px-5 pb-4 pt-3 space-y-2">
                        {entity.sites.map((site) => (
                          <div key={site.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                            <span className="text-sm">{site.country_code ? flagEmoji(site.country_code) : '🏢'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700">{site.name}</p>
                              {(site.city || site.postcode || site.country_code) && (
                                <p className="text-[11px] text-slate-400">
                                  {[site.address, site.city, site.postcode, site.country_code].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                            {site.is_primary && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                primary
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Profile ── */}
        {tab === 'profile' && (
          <>
            {profileLoading ? (
              <p className="mt-8 text-sm text-slate-500">Loading profile…</p>
            ) : (
              <form onSubmit={saveProfile} className="mt-6 space-y-8 rounded-xl bg-white p-6 shadow border border-slate-200">

                {/* COMPANY DETAILS */}
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Company details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Company name</label>
                      <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                        value={profileForm.company_name} readOnly={!canManage}
                        onChange={(e) => setProfileForm(p => ({ ...p, company_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Industry</label>
                      <select className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                        value={profileForm.industry} disabled={!canManage}
                        onChange={(e) => setProfileForm(p => ({ ...p, industry: e.target.value }))}>
                        <option value="">Select industry…</option>
                        {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Country</label>
                        <select className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                          value={profileForm.country} disabled={!canManage}
                          onChange={(e) => setProfileForm(p => ({ ...p, country: e.target.value }))}>
                          <option value="">Select country…</option>
                          {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                            <option key={code} value={code}>{label}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-400">Used to apply the correct emission factors.</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">City</label>
                        <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                          value={profileForm.city} readOnly={!canManage}
                          onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Address</label>
                      <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                        value={profileForm.address} readOnly={!canManage}
                        onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">{compliance.postcodeLabel}</label>
                      <input type="text" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                        value={profileForm.postcode} readOnly={!canManage}
                        onChange={(e) => setProfileForm(p => ({ ...p, postcode: e.target.value }))} />
                    </div>
                  </div>
                </section>

                {/* ORG SIZE */}
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Organisation scale</h2>
                  <select className={`w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                    value={profileForm.company_size} disabled={!canManage}
                    onChange={(e) => setProfileForm(p => ({ ...p, company_size: e.target.value }))}>
                    <option value="">Select size…</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="10-100">10–100 employees</option>
                    <option value="100-500">100–500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </section>

                {/* COMPLIANCE */}
                {compliance.framework && (
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">{compliance.sectionTitle}</h2>
                    <div className="space-y-3">
                      <label className="flex w-full items-start gap-2 text-sm text-slate-700">
                        <input type="checkbox" className="mt-0.5 shrink-0"
                          checked={profileForm.secr_required} disabled={!canManage}
                          onChange={(e) => setProfileForm(p => ({ ...p, secr_required: e.target.checked }))} />
                        <span>
                          {compliance.checkboxLabel}
                          <span className="block text-xs text-slate-400 mt-0.5">{compliance.description}</span>
                        </span>
                      </label>
                      <div className="space-y-4 mt-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600">{compliance.revenueLabel}</label>
                          <input type="number" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                            value={profileForm.annual_revenue} readOnly={!canManage}
                            onChange={(e) => setProfileForm(p => ({ ...p, annual_revenue: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Number of employees</label>
                          <input type="number" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                            value={profileForm.employee_count} readOnly={!canManage}
                            onChange={(e) => setProfileForm(p => ({ ...p, employee_count: e.target.value }))} />
                        </div>
                      </div>
                      {compliance.showEnergyActions && (
                        <div className="mt-2">
                          <label className="text-xs font-medium text-slate-600">{compliance.energyActionsLabel}</label>
                          <textarea className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm h-24 ${roProfileClass}`}
                            value={profileForm.energy_efficiency_actions} readOnly={!canManage}
                            onChange={(e) => setProfileForm(p => ({ ...p, energy_efficiency_actions: e.target.value }))}
                            placeholder="Describe any actions taken to reduce energy use." />
                        </div>
                      )}
                      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Methodology:</strong> {compliance.methodologyNote}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* SUSTAINABILITY */}
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Sustainability & Operations</h2>
                  <select className={`w-full rounded-lg border px-3 py-2 text-sm ${roProfileClass}`}
                    value={profileForm.sustainability_stage} disabled={!canManage}
                    onChange={(e) => setProfileForm(p => ({ ...p, sustainability_stage: e.target.value }))}>
                    <option value="">Select stage…</option>
                    <option value="early">Early</option>
                    <option value="progressing">Progressing</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <label className="flex w-full items-center gap-2 text-sm text-slate-700 mt-3">
                    <input type="checkbox" className="shrink-0"
                      checked={profileForm.has_company_vehicles} disabled={!canManage}
                      onChange={(e) => setProfileForm(p => ({ ...p, has_company_vehicles: e.target.checked }))} />
                    <span>We operate company-owned vehicles.</span>
                  </label>
                  <label className="flex w-full items-center gap-2 text-sm text-slate-700 mt-2">
                    <input type="checkbox" className="shrink-0"
                      checked={profileForm.renewable_energy_tariff} disabled={!canManage}
                      onChange={(e) => setProfileForm(p => ({ ...p, renewable_energy_tariff: e.target.checked }))} />
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
                        value={profileForm.contact_name}
                        onChange={(e) => setProfileForm(p => ({ ...p, contact_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Contact email</label>
                      <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={profileForm.contact_email}
                        onChange={(e) => setProfileForm(p => ({ ...p, contact_email: e.target.value }))} />
                    </div>
                  </div>
                </section>

                {canManage && (
                  <button type="submit" disabled={profileSaving}
                    className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
                    {profileSaving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </form>
            )}
          </>
        )}

        {/* ── TAB 4: Activity ── */}
        {tab === 'activity' && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {distinctMembers.length > 1 && (
                <select className="rounded-lg border px-3 py-1.5 text-xs bg-white"
                  value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
                  <option value="">All members</option>
                  {distinctMembers.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-1">
                {(['', 'emissions', 'exports'] as const).map((f) => (
                  <button key={f} onClick={() => setActionFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      actionFilter === f
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}>
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

        {/* ── TAB 5: Members ── */}
        {tab === 'members' && orgData && (
          <div className="mt-6 space-y-4">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{orgData.members.length} {orgData.members.length === 1 ? 'member' : 'members'}</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => { setShowInviteForm(v => !v); setInviteError(null); setInviteSuccess(null); }}
                  className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  {showInviteForm ? '✕ Cancel' : '+ Invite member'}
                </button>
              )}
            </div>

            {/* Invite success banner */}
            {inviteSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
                {inviteSuccess}
              </div>
            )}

            {/* Invite form */}
            {showInviteForm && (
              <form
                onSubmit={handleInvite}
                className="rounded-xl bg-white border border-slate-200 shadow p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-slate-700">Invite a member</h3>

                {inviteError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {inviteError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-600">Email address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Role <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  >
                    <option value="admin">Admin — can add entities, sites, and members</option>
                    <option value="member">Member — can enter and edit emissions data</option>
                    <option value="viewer">Viewer — read-only access</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowInviteForm(false); setInviteError(null); }}
                    className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    {inviteLoading ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </form>
            )}

            {/* Members table */}
            {members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No members yet.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-white border border-slate-200 shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">User</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          {member.email
                            ? <span className="text-xs text-slate-700">{member.email}</span>
                            : <span className="text-xs text-slate-400 font-mono">{member.user_id}</span>
                          }
                        </td>
                        <td className="px-5 py-3">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {fmtDate(member.joined_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}