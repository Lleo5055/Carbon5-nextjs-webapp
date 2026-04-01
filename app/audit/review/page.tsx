'use client';

import { useEffect, useState, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AuditPackage = {
  id: string;
  org_id: string;
  site_id: string | null;
  financial_year: number;
  auditor_name: string;
  auditor_email: string;
  status: 'draft' | 'under_review' | 'verified' | 'clarification_requested';
  submitted_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  org_name: string | null;
  site_name: string | null;
};

type EmissionRow = {
  id: string;
  month: string;
  electricity_kwh?: number;
  electricity_kw?: number;
  diesel_litres?: number;
  petrol_litres?: number;
  gas_kwh?: number;
  lpg_kg?: number;
  cng_kg?: number;
  refrigerant_kg?: number;
  total_co2e_kg?: number;
  data_source?: string;
};

type AuditLogEntry = {
  id: string;
  action?: string;
  user_email?: string;
  month?: string;
  created_at: string;
  [key: string]: any;
};

type AuditComment = {
  id: string;
  package_id: string;
  author_type: 'auditor' | 'org';
  author_name: string;
  message: string;
  created_at: string;
};

type ReviewData = {
  package: AuditPackage;
  emissions: EmissionRow[];
  auditLog: AuditLogEntry[];
  comments: AuditComment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtMonthLabel(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(iso);
}

function safe(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
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
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function DataSourceBadge({ source }: { source?: string }) {
  if (!source || source === 'manual') {
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">manual</span>;
  }
  if (source === 'ai') {
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-600">ai</span>;
  }
  if (source === 'bulk') {
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-600">bulk</span>;
  }
  return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">{source}</span>;
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-xl">✗</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Need help? Contact{' '}
            <a href="mailto:hello@greenio.co" className="text-emerald-600 hover:underline">
              hello@greenio.co
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loadError, setLoadError] = useState<{ title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');

  // Audit trail toggle
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Action panel state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showClarificationPanel, setShowClarificationPanel] = useState(false);
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Mount: read token from URL and fetch data ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') ?? '';
    setToken(t);
    if (!t) {
      setLoadError({ title: 'Invalid audit link', message: 'Invalid or malformed audit link.' });
      setLoading(false);
      return;
    }
    fetchData(t);
  }, []);

  async function fetchData(t: string) {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/audit/review?token=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setLoadError({
            title: 'Link expired',
            message: 'This audit link has expired. Please contact the organisation to resend it.',
          });
        } else if (res.status === 404) {
          setLoadError({ title: 'Package not found', message: 'Audit package not found.' });
        } else {
          setLoadError({ title: 'Error', message: json.error ?? 'Failed to load audit data.' });
        }
        return;
      }
      setData(json);
    } catch {
      setLoadError({ title: 'Network error', message: 'Failed to load audit data. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  // ── Action handlers ──────────────────────────────────────────────────────
  async function handleApprove() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/audit/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'approve' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to approve');
      setShowApproveModal(false);
      await fetchData(token);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestClarification() {
    if (!clarificationMessage.trim()) {
      setActionError('Please enter a message before submitting.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/audit/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'request_clarification',
          message: clarificationMessage.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit');
      setShowClarificationPanel(false);
      setClarificationMessage('');
      await fetchData(token);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading audit package…</p>
      </main>
    );
  }

  if (loadError) {
    return <ErrorPage title={loadError.title} message={loadError.message} />;
  }

  if (!data) return null;

  const { package: pkg, emissions, auditLog, comments } = data;

  // ── Totals row ──────────────────────────────────────────────────────────
  const totals = emissions.reduce(
    (acc, r) => ({
      electricity: acc.electricity + safe(r.electricity_kwh ?? r.electricity_kw),
      diesel: acc.diesel + safe(r.diesel_litres),
      petrol: acc.petrol + safe(r.petrol_litres),
      gas: acc.gas + safe(r.gas_kwh),
      lpg: acc.lpg + safe(r.lpg_kg),
      cng: acc.cng + safe(r.cng_kg),
      refrigerant: acc.refrigerant + safe(r.refrigerant_kg),
      co2e: acc.co2e + safe(r.total_co2e_kg),
    }),
    { electricity: 0, diesel: 0, petrol: 0, gas: 0, lpg: 0, cng: 0, refrigerant: 0, co2e: 0 }
  );

  const fmt = (n: number, dp = 2) => n === 0 ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: dp });

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <img src="https://greenio.co/logogreenio.svg" alt="Greenio" className="h-7" />
        <span className="text-xs text-slate-400 border-l border-slate-200 pl-3">Audit Review</span>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* ── Section 1: Header card ── */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Audit Review — {pkg.org_name ?? 'Organisation'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Site: {pkg.site_name ?? 'All sites'} &nbsp;·&nbsp; Financial Year: FY{pkg.financial_year}
              </p>
            </div>
            <StatusBadge status={pkg.status} />
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Auditor', value: pkg.auditor_name },
              { label: 'Submitted', value: fmtDate(pkg.submitted_at) },
              { label: 'Verified', value: pkg.verified_at ? fmtDate(pkg.verified_at) : '—' },
              { label: 'Verified by', value: pkg.verified_by_name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm text-slate-800 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Emissions table ── */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Emissions data</h2>
            <p className="text-xs text-slate-400 mt-0.5">{emissions.length} records for FY{pkg.financial_year}</p>
          </div>

          {emissions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">
              No emissions records found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Month</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Electricity (kWh)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Diesel (L)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Petrol (L)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Gas (kWh)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">LPG (kg)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">CNG (kg)</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Refrigerant (kg)</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Total CO₂e (kg)</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-600">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {emissions.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap font-medium">
                        {fmtMonthLabel(row.month)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.electricity_kwh ?? row.electricity_kw))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.diesel_litres))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.petrol_litres))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.gas_kwh))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.lpg_kg))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.cng_kg))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(safe(row.refrigerant_kg))}</td>
                      <td className="px-4 py-2.5 text-right text-slate-800 font-semibold">{fmt(safe(row.total_co2e_kg))}</td>
                      <td className="px-3 py-2.5 text-center">
                        <DataSourceBadge source={row.data_source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">Totals</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.electricity)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.diesel)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.petrol)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.gas)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.lpg)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.cng)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">{fmt(totals.refrigerant)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">{fmt(totals.co2e)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 3: Audit trail ── */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAuditTrail(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 rounded-2xl transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Audit trail</h2>
              <p className="text-xs text-slate-400 mt-0.5">{auditLog.length} entries</p>
            </div>
            <span className="text-slate-400 text-xs">{showAuditTrail ? '▲ Hide' : '▼ Show audit trail →'}</span>
          </button>

          {showAuditTrail && (
            <div className="border-t border-slate-100 px-6 pb-5 pt-4">
              {auditLog.length === 0 ? (
                <p className="text-sm text-slate-400">No audit log entries found.</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700">
                          <span className="font-medium">{entry.action ?? 'Event'}</span>
                          {entry.month && <span className="text-slate-400"> · {entry.month}</span>}
                          {entry.user_email && <span className="text-slate-400"> · {entry.user_email}</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{fmtRelative(entry.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 4: Comments thread ── */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Comments</h2>

          {comments.length === 0 ? (
            <p className="text-sm text-slate-400">No comments yet.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const isAuditor = comment.author_type === 'auditor';
                return (
                  <div key={comment.id} className={`flex ${isAuditor ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        isAuditor
                          ? 'bg-blue-50 border border-blue-100 rounded-tl-sm'
                          : 'bg-slate-100 border border-slate-200 rounded-tr-sm'
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${isAuditor ? 'text-blue-700' : 'text-slate-600'}`}>
                        {comment.author_name}
                        <span className="ml-2 font-normal text-slate-400">{fmtRelative(comment.created_at)}</span>
                      </p>
                      <p className="text-sm text-slate-800 leading-relaxed">{comment.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 5: Action panel (under_review only) ── */}
        {pkg.status === 'under_review' && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Auditor actions</h2>
            <p className="text-xs text-slate-400 mb-5">
              Review the data above, then approve or request clarification from the organisation.
            </p>

            {actionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {!showApproveModal && !showClarificationPanel && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowApproveModal(true); setActionError(null); }}
                  className="flex-1 rounded-full bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  ✓ Approve &amp; Verify
                </button>
                <button
                  type="button"
                  onClick={() => { setShowClarificationPanel(true); setActionError(null); }}
                  className="flex-1 rounded-full bg-amber-500 text-white py-2.5 text-sm font-semibold hover:bg-amber-600 transition-colors"
                >
                  Request Clarification
                </button>
              </div>
            )}

            {/* Approve confirmation modal */}
            {showApproveModal && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
                <p className="text-sm text-emerald-800 font-medium">
                  This will mark the audit as verified. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowApproveModal(false); setActionError(null); }}
                    disabled={actionLoading}
                    className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 rounded-full bg-emerald-600 text-white py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Approving…' : 'Confirm approval'}
                  </button>
                </div>
              </div>
            )}

            {/* Clarification input */}
            {showClarificationPanel && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Message to organisation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Describe what needs clarification or correction…"
                    value={clarificationMessage}
                    onChange={e => setClarificationMessage(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowClarificationPanel(false); setClarificationMessage(''); setActionError(null); }}
                    disabled={actionLoading}
                    className="flex-1 rounded-full border border-slate-300 text-slate-700 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestClarification}
                    disabled={actionLoading || !clarificationMessage.trim()}
                    className="flex-1 rounded-full bg-amber-500 text-white py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verified banner */}
        {pkg.status === 'verified' && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-semibold text-emerald-700">
              Audit verified on {fmtDate(pkg.verified_at)}
            </p>
            {pkg.verified_by_name && (
              <p className="text-xs text-emerald-600 mt-1">Verified by {pkg.verified_by_name}</p>
            )}
          </div>
        )}

        {/* Clarification requested banner */}
        {pkg.status === 'clarification_requested' && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm font-semibold text-amber-700 mb-1">Clarification requested</p>
            <p className="text-xs text-amber-600">
              You have requested clarification from the organisation. This package will move back to
              "under review" once the organisation resubmits.
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by{' '}
          <a href="https://greenio.co" className="text-emerald-600 hover:underline">Greenio</a>
          {' '}· Carbon accounting intelligence
        </p>
      </div>
    </main>
  );
}