'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [wrongAccount, setWrongAccount] = useState(false);
  const [nextUrl, setNextUrl] = useState('/dashboard');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hint = params.get('hint');
    const next = params.get('next');
    if (next) setNextUrl(next);
    if (hint === 'wrong_account') {
      setWrongAccount(true);
      return;
    }
    // Redirect to dashboard if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Login failed');
      setLoading(false);
      return;
    }

    router.push(nextUrl);
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      {wrongAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="text-3xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Wrong account</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              This link is for a different account. Please log out and log in with the correct account to view your dashboard.
            </p>
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Log out and switch account
            </button>
          </div>
        </div>
      )}
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">Log in</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end">
            <a href="/forgot-password" className="text-xs text-slate-500 hover:text-slate-800">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-semibold hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </main>
  );
}
