'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type PlanKey = 'growth' | 'pro';
type Interval = 'monthly' | 'annual';
type CurrentPlan = 'free' | 'growth' | 'pro';

export default function BillingClient({ initialLocale }: { initialLocale: string }) {
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [interval, setInterval] = useState<Interval>('monthly');
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan>('free');
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [locale, setLocale] = useState<string>(initialLocale);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');
  const successPlan = (searchParams.get('plan') as PlanKey | null) ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const [{ data: planRow }, { data: profile }] = await Promise.all([
          supabase.from('user_plans').select('plan').eq('user_id', uid).single(),
          supabase.from('profiles').select('locale, currency').eq('id', uid).single(),
        ]);
        setCurrentPlan((planRow?.plan as CurrentPlan) ?? 'free');
        // Derive region from locale first, currency as fallback
        const detectedLocale =
          profile?.country === 'IN' || profile?.currency === 'INR' || profile?.locale?.startsWith('en-IN') ? 'in' :
          profile?.currency === 'GBP' || profile?.locale === 'en' ? 'en' :
          'en';
        // Persist in cookie so server can read it on next request (no hydration mismatch)
        document.cookie = `greenio_locale=${detectedLocale}; path=/; max-age=31536000; SameSite=Lax`;
        setLocale(detectedLocale);
      } else {
        setCurrentPlan('free');
      }
    });
  }, []);

  async function startCheckout(plan: PlanKey) {
    if (!userId) { alert('You must be logged in to subscribe.'); return; }
    try {
      setLoadingPlan(plan);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval, user_id: userId }),
      });
      if (!res.ok) { alert(`Checkout error: ${await res.text()}`); return; }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error', err);
      alert('Something went wrong starting checkout.');
    } finally {
      setLoadingPlan(null);
    }
  }

  async function confirmDowngrade() {
    setShowDowngradeModal(false);
    try {
      setChangingPlan(true);
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'growth', interval, user_id: userId }),
      });
      if (!res.ok) { alert(`Error: ${await res.text()}`); return; }
      setCurrentPlan('growth');
    } catch (err) {
      console.error('Change plan error', err);
      alert('Something went wrong.');
    } finally {
      setChangingPlan(false);
    }
  }

  const prices = {
    growth: { monthly: locale === 'in' ? '₹1,499' : locale === 'en' ? '£14.99' : '€14.99', annual: locale === 'in' ? '₹14,990' : locale === 'en' ? '£149' : '€149' },
    pro:    { monthly: locale === 'in' ? '₹3,499' : locale === 'en' ? '£34.99' : '€34.99', annual: locale === 'in' ? '₹34,990' : locale === 'en' ? '£349' : '€349' },
  };

  const annualSavings = {
    growth: locale === 'in' ? 'Save ₹2,998/yr' : locale === 'en' ? 'Save £30.88/yr' : 'Save €30.88/yr',
    pro:    locale === 'in' ? 'Save ₹6,998/yr' : locale === 'en' ? 'Save £70.88/yr' : 'Save €70.88/yr',
  };

  const complianceItem = locale === 'in' ? 'BRSR & ESG reporting' : locale === 'en' ? 'SECR & CSRD reporting' : 'CSRD reporting';

  const growthFeatures = [
    'Unlimited carbon accounts/reports',
    'CSV / XLS exports',
    complianceItem,
    'Email support',
  ];

  const proFeatures = [
    'Everything in Growth',
    'Multi-user team access',
    'Leadership Snapshot',
    ...(locale === 'in' ? ['CCTS compliance module'] : []),
    'Early AI reduction insights',
    'Priority support',
  ];

  const planBadge = (plan: CurrentPlan) => (
    <span className={`mt-1 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${
      plan === 'free'   ? 'border-slate-200 bg-white text-slate-800' :
      plan === 'growth' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          'border-purple-200 bg-purple-50 text-purple-700'
    }`}>{plan}</span>
  );

  return (
    <main className="min-h-screen bg-slate-50">

      {/* DOWNGRADE MODAL */}
      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-base">⚠</span>
              <h2 className="text-base font-semibold text-slate-900">Downgrade to Growth?</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">You'll lose access to the following Pro features immediately:</p>
            <ul className="mt-3 space-y-2">
              {[
                'Multi-user team access',
                ...(locale === 'in' ? ['CCTS compliance module'] : []),
                'Priority support',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 text-[10px]">✕</span>
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">A prorated credit will be applied to your next invoice. You can upgrade again at any time.</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDowngradeModal(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Pro
              </button>
              <button
                onClick={confirmDowngrade}
                className="flex-1 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Yes, downgrade
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* Back link */}
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Back to dashboard
        </Link>

        {/* Toasts */}
        {(success || cancelled) && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${success ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
            <span>
              {success && successPlan && <>✅ Payment successful. Your <span className="font-semibold capitalize">{successPlan}</span> plan is now active.</>}
              {cancelled && !success && <>Checkout cancelled. No changes were made.</>}
            </span>
            <Link href="/billing" className="ml-4 text-xs underline underline-offset-2 opacity-70 hover:opacity-100">Dismiss</Link>
          </div>
        )}

        {/* Header */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50 px-6 py-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-600">Billing &amp; plans</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Choose your Greenio plan</h1>
            <p className="mt-1 text-sm text-slate-500">Upgrade to unlock unlimited reports and compliance exports.</p>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-[11px] font-medium text-slate-500">Current plan</p>
            {planBadge(currentPlan)}
          </div>
        </div>

        {/* Interval toggle */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setInterval('monthly')}
            className={interval === 'monthly'
              ? 'rounded-full bg-slate-900 text-white px-4 py-1.5 text-xs font-medium'
              : 'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 hover:border-slate-300'}
          >Monthly</button>
          <button
            onClick={() => setInterval('annual')}
            className={interval === 'annual'
              ? 'rounded-full bg-slate-900 text-white px-4 py-1.5 text-xs font-medium'
              : 'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 hover:border-slate-300'}
          >
            Annual <span className={interval === 'annual' ? 'text-emerald-400' : 'text-emerald-600'}>Save 17%</span>
          </button>
        </div>

        {/* Plans */}
        <div className="space-y-4">

          {/* Growth */}
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Growth</h2>
            <p className="text-2xl font-semibold text-slate-900">
              {prices.growth[interval]} <span className="text-xs font-normal text-slate-500">/ {interval === 'monthly' ? 'month' : 'year'}</span>
            </p>
            {interval === 'annual' && <p className="text-[11px] text-emerald-600 mt-0.5">{annualSavings.growth}</p>}
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {growthFeatures.map(f => <li key={f}>• {f}</li>)}
            </ul>
            <div className="mt-5">
              {currentPlan === 'growth' ? (
                <p className="w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 text-center">✓ Your current plan</p>
              ) : currentPlan === 'pro' ? (
                <button
                  onClick={() => setShowDowngradeModal(true)}
                  disabled={changingPlan}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-white disabled:opacity-60"
                >
                  {changingPlan ? 'Updating…' : 'Downgrade to Growth'}
                </button>
              ) : (
                <button
                  onClick={() => startCheckout('growth')}
                  disabled={loadingPlan === 'growth'}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  {loadingPlan === 'growth' ? 'Redirecting to Stripe…' : 'Subscribe to Growth'}
                </button>
              )}
            </div>
          </article>

          {/* Pro */}
          <article className="rounded-xl border-2 border-emerald-400 bg-white p-6 shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-slate-900">Pro</h2>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Most popular</span>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {prices.pro[interval]} <span className="text-xs font-normal text-slate-500">/ {interval === 'monthly' ? 'month' : 'year'}</span>
            </p>
            {interval === 'annual' && <p className="text-[11px] text-emerald-600 mt-0.5">{annualSavings.pro}</p>}
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {proFeatures.map(f => <li key={f}>• {f}</li>)}
            </ul>
            <div className="mt-5">
              {currentPlan === 'pro' ? (
                <p className="w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 text-center">✓ Your current plan</p>
              ) : (
                <button
                  onClick={() => startCheckout('pro')}
                  disabled={loadingPlan === 'pro'}
                  className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {loadingPlan === 'pro' ? 'Redirecting to Stripe…' : 'Subscribe to Pro'}
                </button>
              )}
            </div>
          </article>

          {/* Enterprise */}
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Enterprise</h2>
            <p className="mt-1 text-2xl font-semibold text-slate-900">Custom <span className="text-xs font-normal text-slate-500">pricing</span></p>
            <p className="mt-1 text-xs text-slate-500">For multi-site organisations, CA firms, and custom compliance needs.</p>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              <li>• Everything in Pro</li>
              <li>• Multiple entities &amp; locations</li>
              <li>• Custom onboarding &amp; dedicated support</li>
              <li>• SLA &amp; white-glove implementation</li>
            </ul>
            <div className="mt-5">
              <a
                href="mailto:hello@greenio.co?subject=Enterprise%20Plan%20Enquiry&body=Hi%20Greenio%20team%2C%0A%0AI%27m%20interested%20in%20the%20Enterprise%20plan.%20Here%27s%20a%20bit%20about%20our%20needs%3A%0A%0ACompany%3A%20%0ATeam%20size%3A%20%0AUse%20case%3A%20%0A%0ALooking%20forward%20to%20hearing%20from%20you."
                className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-white"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                Contact us: hello@greenio.co
              </a>
            </div>
          </article>

        </div>

        <p className="text-center text-xs text-slate-400">Cancel or switch plans any time. No long-term contracts.</p>

      </div>
    </main>
  );
}
