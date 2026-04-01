'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { isEnterpriseUser, getUserOrgs } from '@/lib/enterprise';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const router = useRouter();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  // New key reveal state (shown once after creation)
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formExpiry, setFormExpiry] = useState<string>('never');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Revoke confirm
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  // ── Load org and keys on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }

        const enterprise = await isEnterpriseUser(user.id);
        if (!enterprise) { router.replace('/organisation'); return; }

        const orgs = await getUserOrgs(user.id);
        if (orgs.length === 0) { router.replace('/enterprise/onboarding'); return; }

        const id = orgs[0].id;
        setOrgId(id);
        await fetchKeys(id);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const fetchKeys = useCallback(async (id: string) => {
    const res = await fetch(`/api/org/api-keys?org_id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setKeys(data);
    }
  }, []);

  // ── Create key ─────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const expDays: number | undefined =
        formExpiry === 'never' ? undefined
        : formExpiry === '30' ? 30
        : formExpiry === '90' ? 90
        : 365;

      const res = await fetch(`/api/org/api-keys?org_id=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          scopes: ['read'],
          expires_in_days: expDays,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create key');

      setNewKey(json.key);
      setShowForm(false);
      setFormName('');
      setFormExpiry('never');
      await fetchKeys(orgId);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  // ── Revoke key ─────────────────────────────────────────────────────────────
  async function handleRevoke(keyId: string) {
    if (!orgId) return;
    setRevokingId(keyId);
    try {
      const res = await fetch(`/api/org/api-keys?org_id=${orgId}&key_id=${keyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed to revoke key');
      }
      setConfirmRevokeId(null);
      await fetchKeys(orgId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRevokingId(null);
    }
  }

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
          <div className="h-8 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
          {[1,2].map(i => <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a
          href="/organisation/enterprise"
          className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          ← Organisation
        </a>
      </div>

      <div className="mx-auto max-w-3xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">API Access</h1>
            <p className="text-sm text-slate-500 mt-1">
              Use API keys to integrate Greenio data with your own systems.{' '}
              <a href="/help/api" className="text-emerald-600 hover:underline">
                View documentation →
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setFormError(null); }}
            className="inline-flex items-center gap-1.5 h-[36px] px-5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
          >
            {showForm ? '✕ Cancel' : '+ Generate API key'}
          </button>
        </div>

        {/* ── Global error ── */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── New key reveal banner ── */}
        {newKey && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Your new API key — copy it now
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  It will not be shown again after you dismiss this banner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewKey(null)}
                className="text-amber-500 hover:text-amber-700 text-lg leading-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white border border-amber-200 px-4 py-2.5 text-xs font-mono text-slate-800 break-all">
                {newKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-shrink-0 h-[36px] px-4 rounded-full bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-700">New API key</h3>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-600">
                Key name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. Production integration"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Scopes</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="scope-read"
                  checked
                  disabled
                  className="rounded"
                />
                <label htmlFor="scope-read" className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">read</span> — read-only access to emissions data
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Additional scopes coming soon.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Expires in</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                value={formExpiry}
                onChange={e => setFormExpiry(e.target.value)}
              >
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
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
                disabled={formLoading || !formName.trim()}
                className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {formLoading ? 'Generating…' : 'Generate key'}
              </button>
            </div>
          </form>
        )}

        {/* ── Keys table ── */}
        {keys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500 mb-1">No API keys yet.</p>
            <p className="text-xs text-slate-400">
              Generate a key above to start integrating with the Greenio API.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Prefix</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Scopes</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Last used</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Expires</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {keys.map((k) => {
                  const expired = isExpired(k.expires_at);
                  const active = k.is_active && !expired;

                  return (
                    <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-slate-800">{k.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Created {fmtDate(k.created_at)}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {k.key_prefix}…
                        </code>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(k.scopes ?? []).map(s => (
                            <span
                              key={s}
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {fmtRelative(k.last_used_at)}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {k.expires_at ? fmtDate(k.expires_at) : 'Never'}
                        {expired && (
                          <span className="ml-1.5 text-[10px] font-semibold text-red-500">expired</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {active ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">
                            {expired ? 'Expired' : 'Revoked'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {k.is_active && !expired && (
                          <>
                            {confirmRevokeId === k.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500">Confirm?</span>
                                <button
                                  type="button"
                                  onClick={() => handleRevoke(k.id)}
                                  disabled={revokingId === k.id}
                                  className="h-[24px] px-2.5 rounded-full bg-red-600 text-white text-[11px] font-medium hover:bg-red-700 disabled:opacity-50"
                                >
                                  {revokingId === k.id ? '…' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRevokeId(null)}
                                  className="h-[24px] px-2.5 rounded-full border border-slate-300 text-slate-600 text-[11px] font-medium hover:bg-slate-50"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(k.id)}
                                className="h-[28px] px-3 rounded-full border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-50"
                              >
                                Revoke
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── API quick reference ── */}
        <div className="mt-8 rounded-2xl bg-slate-900 text-slate-300 p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Quick reference
          </p>
          <div className="space-y-3 text-xs font-mono">
            {[
              { method: 'GET', path: '/api/v1/emissions', desc: 'List emissions' },
              { method: 'GET', path: '/api/v1/sites',     desc: 'List sites' },
              { method: 'GET', path: '/api/v1/entities',  desc: 'List entities' },
              { method: 'GET', path: '/api/v1/summary?financial_year=2025', desc: 'Annual summary' },
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-baseline gap-3">
                <span className="text-emerald-400 w-8">{method}</span>
                <code className="text-slate-200 flex-1">{path}</code>
                <span className="text-slate-500 text-[11px]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Authenticate with:{' '}
            <code className="text-slate-400">Authorization: Bearer gro_live_…</code>
          </p>
        </div>

      </div>
    </main>
  );
}