'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PartnersPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', website: '', how_they_refer: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/partners/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError('Something went wrong. Please try again or email hello@greenio.co');
    }
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-12">

        {/* Hero */}
        <div className="text-center space-y-4">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Partner Programme
          </span>
          <h1 className="text-4xl font-bold text-slate-900">Earn by referring Greenio</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Refer businesses to Greenio and earn 15% of their monthly subscription for 12 months. No cap.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Apply', desc: 'Fill in the form below. We review and approve within 48 hours.' },
            { step: '2', title: 'Share your link', desc: 'Get your unique referral link and share it with your network.' },
            { step: '3', title: 'Earn commission', desc: 'Earn 15% of referred customers monthly plan for 12 months.' },
          ].map(item => (
            <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Commission table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">What you can earn</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-500">Plan</th>
                  <th className="text-left py-2 font-medium text-slate-500">Monthly price</th>
                  <th className="text-left py-2 font-medium text-slate-500">Your monthly commission</th>
                  <th className="text-left py-2 font-medium text-slate-500">Over 12 months</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-900">Growth</td>
                  <td className="py-3 text-slate-600">£14.99</td>
                  <td className="py-3 text-emerald-700 font-medium">£2.25</td>
                  <td className="py-3 text-emerald-700 font-medium">£26.98</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-900">Pro</td>
                  <td className="py-3 text-slate-600">£34.99</td>
                  <td className="py-3 text-emerald-700 font-medium">£5.25</td>
                  <td className="py-3 text-emerald-700 font-medium">£62.98</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-400">Commissions calculated on actual payments received. Minimum £50 balance to request payout.</p>
        </div>

        {/* Application form */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Apply to become a partner</h2>
          <p className="text-sm text-slate-500 mb-6">We'll review your application and get back to you within 48 hours.</p>

          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="font-semibold text-emerald-800">Application submitted!</p>
              <p className="text-sm text-emerald-700 mt-1">We'll review it and email you within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Acme Ltd"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://yoursite.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  How do you plan to refer customers? *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.how_they_refer}
                  onChange={e => setForm(f => ({ ...f, how_they_refer: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. I'm an accountant and will recommend to my SME clients, I run a sustainability blog, etc."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Apply to become a partner'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          Already a partner?{' '}
          <Link href="/partner-portal" className="text-emerald-600 hover:underline">
            View your portal →
          </Link>
        </p>
      </div>
    </main>
  );
}
