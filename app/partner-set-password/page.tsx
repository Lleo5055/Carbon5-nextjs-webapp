'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PartnerSetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to PASSWORD_RECOVERY event (fires after Supabase processes the URL token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
      }
    });

    // Also check if session already exists (token may have been processed before mount)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    // If still not ready after 10s, the link is invalid/expired
    const timeout = setTimeout(() => {
      setReady(prev => {
        if (!prev) setExpired(true);
        return prev;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    window.location.href = '/partner-portal';
  }

  if (expired) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="text-xl">⛔</p>
        <h1 className="text-lg font-semibold text-slate-900">Link expired or invalid</h1>
        <p className="text-sm text-slate-500">Please contact <a href="mailto:hello@greenio.co" className="text-emerald-600 underline">hello@greenio.co</a> to get a new link.</p>
      </div>
    </main>
  );

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Verifying link…
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logogreenio.svg" alt="Greenio" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-slate-900">Set your password</h1>
          <p className="text-sm text-slate-500 mt-1">Choose a password to access your partner portal.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Set password & go to portal'}
          </button>
        </form>
      </div>
    </main>
  );
}
