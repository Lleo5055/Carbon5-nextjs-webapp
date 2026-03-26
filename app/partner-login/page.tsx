'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function PartnerLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/partner-portal`,
        shouldCreateUser: false,
      },
    });

    if (magicError) {
      setError('Could not send login link. Make sure you applied and were approved as a partner.');
    } else {
      setMessage('Login link sent! Check your email — it expires in 24 hours.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center">
          <img src="/logogreenio.svg" alt="Greenio" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-slate-900">Partner login</h1>
          <p className="text-sm text-slate-500 mt-1">Access your partner portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="you@company.com"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {message ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message}
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send login link'}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Not a partner yet?{' '}
          <Link href="/partners" className="text-emerald-600 hover:underline">Apply here →</Link>
        </p>

        <p className="text-center text-xs text-slate-400">
          Looking for your Greenio account?{' '}
          <Link href="/login" className="text-slate-600 hover:underline">Log in here</Link>
        </p>

      </div>
    </main>
  );
}
