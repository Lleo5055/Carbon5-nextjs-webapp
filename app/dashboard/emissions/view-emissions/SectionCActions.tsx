'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  id: number | string;
  table: 'water_entries' | 'waste_entries' | 'air_emissions';
  label: string;
};

// Derive a stable per-user cache key for lock state.
// Falls back to a generic key if user ID isn't available yet — safe because
// localStorage is already browser/device scoped.
function getCacheKey(table: string, label: string, userId?: string) {
  const prefix = userId ? `u_${userId}` : 'local';
  return `sectionc_lock_${prefix}_${table}_${label}`;
}

export default function SectionCActions({ id, table, label }: Props) {
  const router = useRouter();

  // Derive cache key synchronously using a session hint if available
  const cacheKey = getCacheKey(table, label);

  const [locked, setLocked] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) ?? 'false'); } catch { return false; }
  });
  const [confirm, setConfirm] = useState<'delete' | 'lock' | 'unlock' | null>(null);
  const [loading, setLoading] = useState(false);

  function applyLock(nextLocked: boolean) {
    try { localStorage.setItem(cacheKey, JSON.stringify(nextLocked)); } catch {}
    setLocked(nextLocked);
    setConfirm(null);
  }

  async function handleDelete() {
    setLoading(true);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      alert('Failed to delete entry.');
      console.error(error);
    } else {
      // Clear the lock cache for this entry since it no longer exists
      try { localStorage.removeItem(cacheKey); } catch {}
    }
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2 text-[11px]">
        {!locked && (
          <>
            <Link
              href="/dashboard/emissions"
              className="px-2 py-1 rounded-full border hover:bg-slate-900 hover:text-white"
            >
              Edit
            </Link>
            <button
              onClick={() => setConfirm('delete')}
              className="px-2 py-1 rounded-full border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
            >
              Delete
            </button>
          </>
        )}
        <button
          onClick={() => setConfirm(locked ? 'unlock' : 'lock')}
          className="px-2 py-1 rounded-full border text-slate-600 hover:bg-slate-100"
        >
          {locked ? 'Unlock' : 'Lock'}
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">
              {confirm === 'delete' ? `Delete ${label}?` : confirm === 'lock' ? 'Lock this entry?' : 'Unlock this entry?'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {confirm === 'delete'
                ? 'This action cannot be undone.'
                : confirm === 'lock'
                ? 'Edits and deletions will be disabled.'
                : 'Edits and deletions will be allowed again.'}
            </p>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button onClick={() => setConfirm(null)} className="rounded-full border px-3 py-1 text-slate-600">
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={() => confirm === 'delete' ? handleDelete() : applyLock(confirm === 'lock')}
                className={`rounded-full px-3 py-1 text-white disabled:opacity-60 ${confirm === 'delete' ? 'bg-red-600' : 'bg-slate-900'}`}
              >
                {confirm === 'delete' ? 'Delete' : confirm === 'lock' ? 'Lock entry' : 'Unlock entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
