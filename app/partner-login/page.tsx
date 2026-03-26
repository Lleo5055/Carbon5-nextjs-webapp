'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'magic'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    // Ensure this is a partner account, not a regular Greenio user
    if (data.user?.user_metadata?.account_type !== 'partner') {
      await supabase.auth.signOut();
      setError('This login is for Greenio partners only. If you have a Greenio account, please log in at /login.');
      setLoading(false);
      return;
    }

    router.replace('/partner-portal');
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/partner-portal`,
        shouldCreateUser: false, // only allow existing partner accounts
      },
    });

    if (magicError) {
      setError('Could not send login link. Please check your email address.');
    } else {
      setMessage('Login link sent! Check your email — it expires in 24 hours.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <img src="/logogreenio.svg" alt="Greenio" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-slate-900">Partner login</h1>
          <p className="text-sm text-slate-500 mt-1">Access your partner portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

          {/* Mode toggle */}
          <div className="flex rounded-full border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => { setMode('login'); setError(null); setMessage(null); }}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${mode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode('magic'); setError(null); setMessage(null); }}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${mode === 'magic' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Email link
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
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
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>
              <p className="text-center text-xs text-slate-400">
                No password?{' '}
                <button type="button" onClick={() => setMode('magic')} className="text-emerald-600 hover:underline">
                  Send me a login link
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
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
          )}
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
