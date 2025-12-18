'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  id: number | string;
  monthLabel: string;
};

export default function RowActions({ id, monthLabel }: Props) {
  const router = useRouter();

  // ✅ FIX: deterministic initial lock (only current month unlocked)
  const now = new Date();
  const currentMonthLabel = `${now.toLocaleString('default', {
    month: 'long',
  })} ${now.getFullYear()}`;

  const [locked, setLocked] = useState(monthLabel !== currentMonthLabel);
  const [confirm, setConfirm] = useState<'lock' | 'unlock' | 'delete' | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadLockOverride() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('report_locks')
        .select('locked')
        .eq('user_id', user.id)
        .eq('month', monthLabel)
        .maybeSingle();

      if (!mounted || data?.locked === undefined) return;

// 🔒 Enforce rule: only current month can be unlocked
if (monthLabel !== currentMonthLabel) {
  setLocked(true);
} else {
  setLocked(data.locked);
}

    }

    loadLockOverride();
    return () => {
      mounted = false;
    };
  }, [monthLabel]);

  async function applyLock(nextLocked: boolean) {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('report_locks').upsert({
      user_id: user.id,
      month: monthLabel,
      locked: nextLocked,
    });

    await supabase.from('edit_history').insert({
      user_id: user.id,
      month: monthLabel,
      entity: 'report',
      entity_id: null,
      action: nextLocked ? 'lock' : 'unlock',
    });

    setLocked(nextLocked);
    setConfirm(null);
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);

    const { error } = await supabase.from('emissions').delete().eq('id', id);

    if (error) {
      alert('Failed to delete emission.');
      console.error(error);
    }

    setConfirm(null);
    setLoading(false);
    router.refresh(); // ✅ REQUIRED
  }

  return (
    <>
      <div className="flex gap-2 text-[11px]">
        {!locked && (
          <>
            <Link
              href={`/dashboard/emissions?id=${id}&month=${encodeURIComponent(
                monthLabel
              )}`}
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
              {confirm === 'delete'
                ? `Delete emissions for ${monthLabel}?`
                : confirm === 'lock'
                ? 'Lock this month?'
                : 'Unlock this month?'}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              {confirm === 'delete'
                ? 'This action cannot be undone.'
                : confirm === 'lock'
                ? 'Edits and deletions will be disabled.'
                : 'Edits and deletions will be allowed again.'}
            </p>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-full border px-3 py-1 text-slate-600"
              >
                Cancel
              </button>

              <button
                disabled={loading}
                onClick={() =>
                  confirm === 'delete'
                    ? handleDelete()
                    : applyLock(confirm === 'lock')
                }
                className={`rounded-full px-3 py-1 text-white ${
                  confirm === 'delete'
                    ? 'bg-red-600'
                    : 'bg-slate-900'
                }`}
              >
                {confirm === 'delete'
                  ? 'Delete'
                  : confirm === 'lock'
                  ? 'Lock month'
                  : 'Unlock month'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
