'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-2">Error</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-8">
          An unexpected error occurred. Try again or go back to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="h-[36px] px-5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 inline-flex items-center"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="h-[36px] px-5 rounded-full border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 inline-flex items-center"
          >
            ← Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
