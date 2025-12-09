'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type PlanId = 'growth' | 'pro';

type Plan = {
  id: PlanId;
  name: string;
  priceLabel: string;
  badge?: string;
  description: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: 'growth',
    name: 'Growth',
    priceLabel: '£9.99 / month',
    badge: 'Most popular',
    description: 'For SMEs who want unlimited reporting and CSV/XLS exports.',
    features: [
      'Unlimited PDF reports',
      'Unlimited CSV / XLS exports',
      'Email support',
      'Core AI insights (coming soon)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '£24.99 / month',
    description: 'For teams who need multi-user access and advanced insights.',
    features: [
      'Everything in Growth',
      'Multi-user team access (coming soon)',
      'Advanced AI reduction insights (coming soon)',
      'Priority support',
    ],
  },
];

export default function BillingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: PlanId) {
    setLoadingPlan(plan);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        throw new Error('Could not start checkout. Please try again.');
      }

      const data = await res.json();

      if (!data?.url) {
        throw new Error('No checkout URL returned from the server.');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url as string;
    } catch (err: any) {
      console.error('Error starting checkout', err);
      setError(
        err?.message || 'Something went wrong while redirecting to Stripe.'
      );
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {/* Header */}
        <section className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-600">
                Billing &amp; plans
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Choose your Carbon Central plan
              </h1>
              <p className="mt-1 text-sm text-slate-600 max-w-xl">
                Start on Free, then upgrade to unlock unlimited PDF reports and
                CSV/XLS exports. Payments are handled securely via Stripe.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 text-right">
              <p className="font-medium text-slate-700">Current plan</p>
              <p className="mt-0.5">
                We&apos;re still using manual plans from the{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5">
                  user_plans
                </code>{' '}
                table. Stripe sync via webhooks is next.
              </p>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => {
            const isLoading = loadingPlan === plan.id;

            return (
              <article
                key={plan.id}
                className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                {plan.badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {plan.description}
                  </p>
                </div>

                <ul className="mb-4 space-y-1.5 text-xs text-slate-700">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-[2px] text-emerald-500">●</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isLoading
                      ? 'Redirecting to Stripe…'
                      : plan.id === 'growth'
                      ? 'Subscribe to Growth'
                      : 'Subscribe to Pro'}
                  </button>
                  <p className="text-[10px] text-slate-500">
                    You&apos;ll be redirected to a secure Stripe Checkout page.
                    Use Stripe test cards while we are in sandbox mode.
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        {/* Error + back link */}
        {error && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="text-xs text-slate-500">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
          >
            <span>← Back to dashboard</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
