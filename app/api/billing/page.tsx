'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type PlanKey = 'growth' | 'pro';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');
  const successPlan = (searchParams.get('plan') as PlanKey | null) ?? null;

  async function startCheckout(plan: PlanKey) {
    try {
      setLoadingPlan(plan);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        console.error('Checkout failed', await res.text());
        alert('Could not start checkout. Please try again.');
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('No checkout URL returned from server.');
      }
    } catch (err) {
      console.error('Checkout error', err);
      alert('Something went wrong starting checkout.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* Toasts for success / cancel */}
        {(success || cancelled) && (
          <section className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center justify-between">
            <div>
              {success && successPlan && (
                <span>
                  ✅ Payment successful. Your{' '}
                  <span className="font-semibold capitalize">
                    {successPlan}
                  </span>{' '}
                  subscription is now active (Stripe sandbox).
                </span>
              )}
              {cancelled && !success && (
                <span>Checkout cancelled. No changes were made.</span>
              )}
            </div>
            <Link
              href="/dashboard/billing"
              className="underline underline-offset-2"
            >
              Dismiss
            </Link>
          </section>
        )}

        {/* Header */}
        <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-600">
                Billing &amp; plans
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Choose your Carbon Central plan
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Start on Free, then upgrade to unlock unlimited PDF reports and
                CSV/XLS exports. Payments are handled securely via Stripe.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <p className="font-medium text-slate-700">Current plan</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-800">
                Free
              </p>
              <p className="mt-1 max-w-xs text-right text-[11px] text-slate-500">
                We&apos;re still using manual plans from the{' '}
                <code>user_plans</code> table. Stripe sync via webhooks is next.
              </p>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="space-y-4">
          {/* Growth */}
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Growth</h2>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  £9.99{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / month
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  For SMEs who want unlimited reporting and CSV/XLS exports.
                </p>

                <ul className="mt-3 space-y-1 text-xs text-slate-700">
                  <li>• Unlimited PDF reports</li>
                  <li>• Unlimited CSV / XLS exports</li>
                  <li>• Email support</li>
                  <li>• Core AI insights (coming soon)</li>
                </ul>
              </div>
              <div className="hidden text-[10px] text-emerald-700 sm:block">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-medium">
                  Most popular
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => startCheckout('growth')}
                disabled={loadingPlan === 'growth'}
                className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {loadingPlan === 'growth'
                  ? 'Redirecting to Stripe…'
                  : 'Subscribe to Growth'}
              </button>
              <p className="mt-2 text-[11px] text-slate-500 text-center">
                You&apos;ll be redirected to a secure Stripe Checkout page. Use
                Stripe test cards while we are in sandbox mode.
              </p>
            </div>
          </article>

          {/* Pro */}
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pro</h2>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  £24.99{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / month
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  For teams who need multi-user access and advanced insights.
                </p>

                <ul className="mt-3 space-y-1 text-xs text-slate-700">
                  <li>• Everything in Growth</li>
                  <li>• Multi-user team access (coming soon)</li>
                  <li>• Advanced AI reduction insights (coming soon)</li>
                  <li>• Priority support</li>
                </ul>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => startCheckout('pro')}
                disabled={loadingPlan === 'pro'}
                className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {loadingPlan === 'pro'
                  ? 'Redirecting to Stripe…'
                  : 'Subscribe to Pro'}
              </button>
              <p className="mt-2 text-[11px] text-slate-500 text-center">
                You&apos;ll be redirected to a secure Stripe Checkout page. Use
                Stripe test cards while we are in sandbox mode.
              </p>
            </div>
          </article>
        </section>

        {/* Back link */}
        <section>
          <Link
            href="/dashboard"
            className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
