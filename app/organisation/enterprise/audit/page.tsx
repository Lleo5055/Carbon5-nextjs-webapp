'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  isEnterpriseUser,
  getUserOrgs,
  getOrgWithHierarchy,
  type OrgWithHierarchy,
  type Site,
  type Entity,
} from '@/lib/enterprise';
import { getFinancialYear, fyStartMonthForCountry } from '@/lib/financialYear';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AuditPackage = {
  id: string;
  org_id: string;
  site_id: string | null;
  financial_year: number;
  auditor_name: string;
  auditor_email: string;
  status: 'draft' | 'under_review' | 'verified' | 'clarification_requested';
  created_at: string;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
};

type SiteOption = Site & { entity_name: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StatusBadge({ status }: { status: AuditPackage['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:                   { label: 'Draft',                  cls: 'bg-slate-100 text-slate-600' },
    under_review:            { label: 'Under review',           cls: 'bg-amber-100 text-amber-700' },
    verified:                { label: 'Verified',               cls: 'bg-emerald-100 text-emerald-700' },
    clarification_requested: { label: 'Clarification requested', cls: 'bg-red-100 text-red-600' },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrgAuditPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<OrgWithHierarchy | null>(null);
  const [packages, setPackages] = useState<AuditPackage[]>([]);
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formSiteId, setFormSiteId] = useState('');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formAuditorName, setFormAuditorName] = useState('');
  const [formAuditorEmail, setFormAuditorEmail] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Row-level action state
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // ── Mount: auth guard + load ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }

        const enterprise = await isEnterpriseUser(user.id);
        if (!enterprise) { router.replace('/organisation'); return; }

        const orgs = await getUserOrgs(user.id);
        if (orgs.length === 0) { router.replace('/enterprise/onboarding'); return; }

        const data = await getOrgWithHierarchy(orgs[0].id);
        if (!data) throw new Error('Organisation not found.');
        setOrgData(data);

        // Build flat site options with entity name
        const sites: SiteOption[] = data.entities.flatMap((e: Entity & { sites: Site[] }) =>
          e.sites.map(s => ({ ...s, entity_name: e.name }))
        );
        setSiteOptions(sites);
        if (sites.length > 0) setFormSiteId(sites[0].id);

        await loadPackages(orgs[0].id);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function loadPackages(orgId: string) {
    const { data, error: dbErr } = await supabase
      .from('audit_packages')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setPackages(data ?? []);
  }

  // ── Create package ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgData) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch('/api/audit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgData.id,
          site_id: formSiteId || null,
          financial_year: formYear,
          auditor_name: formAuditorName.trim(),
          auditor_email: formAuditorEmail.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create');
      setShowForm(false);
      setFormAuditorName('');
      setFormAuditorEmail('');
      await loadPackages(orgData.id);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  // ── Submit / resend package ───────────────────────────────────────────────
  async function handleSubmit(pkg: AuditPackage) {
    if (!orgData) return;
    setSubmittingId(pkg.id);
    setRowError(null);
    try {
      const res = await fetch('/api/audit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkg.id, org_id: orgData.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit');
      await loadPackages(orgData.id);
    } catch (err: any) {
      setRowError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading audit packages…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6 flex items-center gap-3">
        <a
          href="/organisation/enterprise"
          className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          ← Organisation
        </a>
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Audit packages</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create packages for external auditors and track review status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setFormError(null); }}
            className="inline-flex items-center gap-1.5 h-[36px] px-5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
          >
            {showForm ? '✕ Cancel' : '+ New audit package'}
          </button>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Row-level error */}
        {rowError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rowError}
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-700">New audit package</h3>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Site <span className="text-red-500">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  value={formSiteId}
                  onChange={e => setFormSiteId(e.target.value)}
                  required
                >
                  {siteOptions.length === 0 && (
                    <option value="">No sites — add sites first</option>
                  )}
                  {siteOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.entity_name} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Financial year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formYear}
                  onChange={e => setFormYear(Number(e.target.value))}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the start year of the financial year (e.g. 2025 for FY 2025-26)
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Auditor name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. John Smith"
                  value={formAuditorName}
                  onChange={e => setFormAuditorName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Auditor email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="auditor@firm.com"
                  value={formAuditorEmail}
                  onChange={e => setFormAuditorEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading || siteOptions.length === 0}
                className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {formLoading ? 'Creating…' : 'Create package'}
              </button>
            </div>
          </form>
        )}

        {/* ── Packages table ── */}
        {packages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500 mb-1">No audit packages yet.</p>
            <p className="text-xs text-slate-400">
              Create a package to invite an auditor to review your emissions data.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Site</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">FY</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Auditor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Submitted</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {packages.map((pkg) => {
                  const siteName = siteOptions.find(s => s.id === pkg.site_id)?.name ?? 'All sites';
                  const entityName = siteOptions.find(s => s.id === pkg.site_id)?.entity_name;
                  const isSubmitting = submittingId === pkg.id;

                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-slate-800">{siteName}</p>
                        {entityName && (
                          <p className="text-[11px] text-slate-400">{entityName}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        FY{pkg.financial_year}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={pkg.status} />
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-slate-800">{pkg.auditor_name}</p>
                        <p className="text-[11px] text-slate-400">{pkg.auditor_email}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {fmtDate(pkg.submitted_at)}
                      </td>
                      <td className="px-5 py-3">
                        {pkg.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleSubmit(pkg)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1 h-[28px] px-3 rounded-full bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-700 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Sending…' : 'Submit for audit →'}
                          </button>
                        )}

                        {(pkg.status === 'under_review' || pkg.status === 'clarification_requested') && (
                          <button
                            type="button"
                            onClick={() => handleSubmit(pkg)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1 h-[28px] px-3 rounded-full border border-slate-300 text-slate-600 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Sending…' : 'Resend link'}
                          </button>
                        )}

                        {pkg.status === 'verified' && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              Verified ✓
                            </span>
                            {pkg.verified_at && (
                              <span className="text-[11px] text-slate-400">{fmtDate(pkg.verified_at)}</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}