'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Stats = {
  ref_code: string;
  ref_link: string;
  total_clicks: number;
  total_signups: number;
  active_customers: number;
  total_earned_gbp: number;
  total_paid_gbp: number;
  pending_balance_gbp: number;
  can_request_payout: boolean;
  recent_payouts: { amount_gbp: number; status: string; requested_at: string; paid_at: string | null }[];
};

export default function PartnerPortalPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notPartner, setNotPartner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutDone, setPayoutDone] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.href = '/partner-login';
        return;
      }

      // Block regular Greenio accounts from accessing partner portal
      if (data.session.user.user_metadata?.account_type !== 'partner') {
        window.location.href = '/dashboard';
        return;
      }

      const token = data.session.access_token;
      const res = await fetch('/api/partner-portal/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 404) {
        setNotPartner(true);
      } else if (res.ok) {
        setStats(await res.json());
      }
      setLoading(false);
    });
  }, []);

  async function requestPayout() {
    setRequestingPayout(true);
    setPayoutError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/partner-portal/payout-request', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
    });
    if (res.ok) {
      setPayoutDone(true);
      setStats(prev => prev ? { ...prev, can_request_payout: false } : prev);
    } else {
      setPayoutError(await res.text());
    }
    setRequestingPayout(false);
  }

  function copyLink() {
    if (!stats) return;
    navigator.clipboard.writeText(stats.ref_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>
  );

  if (notPartner) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">You're not a partner yet</h1>
        <p className="text-sm text-slate-500">Apply to the Greenio partner programme to get your referral link and start earning.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/partners" className="inline-block rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            Apply now →
          </Link>
          <Link href="/partner-login" className="inline-block rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );

  if (!stats) return null;

  const conversionRate = stats.total_clicks > 0
    ? ((stats.total_signups / stats.total_clicks) * 100).toFixed(1)
    : '0.0';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50 px-6 py-5 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-600">Partner Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Your referral dashboard</h1>
        </div>

        {/* Referral link */}
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-2">Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-emerald-700 font-medium truncate">
              {stats.ref_link}
            </code>
            <button
              onClick={copyLink}
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Share this link. Anyone who signs up via it will be attributed to you.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total clicks', value: stats.total_clicks.toLocaleString() },
            { label: 'Signups', value: stats.total_signups.toLocaleString() },
            { label: 'Conversion', value: `${conversionRate}%` },
            { label: 'Active customers', value: stats.active_customers.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Earnings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Earnings</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">Total earned</p>
              <p className="text-xl font-bold text-slate-900">£{stats.total_earned_gbp.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total paid</p>
              <p className="text-xl font-bold text-slate-900">£{stats.total_paid_gbp.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Available balance</p>
              <p className={`text-xl font-bold ${stats.pending_balance_gbp >= 50 ? 'text-emerald-700' : 'text-slate-900'}`}>
                £{stats.pending_balance_gbp.toFixed(2)}
              </p>
            </div>
          </div>

          {payoutDone ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Payout request submitted. We'll process it within 5 business days.
            </div>
          ) : stats.can_request_payout ? (
            <div>
              {payoutError && <p className="text-xs text-red-600 mb-2">{payoutError}</p>}
              <button
                onClick={requestPayout}
                disabled={requestingPayout}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {requestingPayout ? 'Requesting…' : `Request payout — £${stats.pending_balance_gbp.toFixed(2)}`}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Minimum £50 required to request a payout.
              {stats.pending_balance_gbp > 0 && ` You need £${(50 - stats.pending_balance_gbp).toFixed(2)} more.`}
            </p>
          )}
        </div>

        {/* Payout history */}
        {stats.recent_payouts.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Payout history</h2>
            <div className="space-y-2">
              {stats.recent_payouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-900">£{Number(p.amount_gbp).toFixed(2)}</p>
                    <p className="text-xs text-slate-400">
                      Requested {new Date(p.requested_at).toLocaleDateString('en-GB')}
                      {p.paid_at && ` · Paid ${new Date(p.paid_at).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                    p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Questions? <a href="mailto:hello@greenio.co" className="text-emerald-600 hover:underline">hello@greenio.co</a>
        </p>
      </div>
    </main>
  );
}
