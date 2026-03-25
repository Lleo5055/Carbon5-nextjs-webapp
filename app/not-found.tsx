import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M17 8C8 10 5.9 16.17 3.82 19.1c.95.83 2.14 1.4 3.48 1.4 3 0 6.5-2 7.5-6 .5-2-1-3-2-3s-2 1-2 2 1 2 2 2c2.67 0 4-1.67 4-5"
              stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Page not found</h1>
        <p className="text-sm text-slate-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="h-[36px] px-5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 inline-flex items-center"
          >
            ← Dashboard
          </Link>
          <Link
            href="/"
            className="h-[36px] px-5 rounded-full border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 inline-flex items-center"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
