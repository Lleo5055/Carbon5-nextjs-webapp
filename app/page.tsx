// app/page.tsx
// Detects the visitor's browser locale and redirects to the appropriate
// localised homepage (/en, /de, /fr, etc.).
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { detectLocale } from '@/lib/locales/index';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const locale = detectLocale();
    router.replace('/' + locale);
  }, [router]);

  // Minimal loading state shown for the split-second before redirect.
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
        <p className="text-[11px] text-slate-400">Loading…</p>
      </div>
    </div>
  );
}
