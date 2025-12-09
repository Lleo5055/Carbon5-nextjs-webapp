'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email to confirm your account.');
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="max-w-md w-full bg-white shadow-md rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-4 text-slate-900">
          Create account
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-slate-700">{message}</p>}

        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-slate-900 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
