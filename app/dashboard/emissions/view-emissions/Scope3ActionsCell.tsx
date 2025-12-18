'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  row: any;
};

function isPastMonth(monthLabel: string) {
  const parsed = new Date(`${monthLabel} 01`);
  if (isNaN(parsed.getTime())) return false;

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return parsed < currentMonthStart;
}

export default function Scope3ActionsCell({ row }: Props) {
  const router = useRouter();
  const monthLabel = row.month;

  const [locked, setLocked] = useState(() => isPastMonth(monthLabel));
  const [lockConfirm, setLockConfirm] = useState<'lock' | 'unlock' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadLockOverride() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('report_locks')
        .select('locked')
        .eq('user_id', user.id)
        .eq('month', monthLabel)
        .maybeSingle();

      if (!mounted || data?.locked === undefined) return;
      setLocked(data.locked);
    }

    loadLockOverride();
    return () => {
      mounted = false;
    };
  }, [monthLabel]);

  async function confirmDelete() {
    setLoading(true);

    const { error } = await supabase
      .from('scope3_activities')
      .delete()
      .eq('id', row.id);

    if (error) {
      console.error('Scope 3 delete failed:', error);
      alert('Could not delete Scope 3 activity');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('edit_history').insert({
        user_id: user.id,
        month: monthLabel,
        entity: 'scope3',
        entity_id: row.id,
        action: 'delete',
      });
    }

    setDeleteConfirm(false);
    setLoading(false);
    router.refresh();
  }

  async function applyLock(nextLocked: boolean) {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
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
    setLockConfirm(null);
    setLoading(false);
  }

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        {!locked && (
          <>
            <Link
              href={`/dashboard/emissions?edit=scope3&id=${row.id}`}
              className="text-slate-600 hover:text-slate-900"
            >
              Edit
            </Link>

            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-rose-600 hover:text-rose-800"
            >
              Delete
            </button>
          </>
        )}

        <button
          onClick={() => setLockConfirm(locked ? 'unlock' : 'lock')}
          className="text-slate-500 hover:text-slate-900"
        >
          {locked ? 'Unlock' : 'Lock'}
        </button>
      </div>

      {/* DELETE MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">
              Delete Scope 3 activity?
            </p>
            <p className="mt-1 text-xs text-slate-600">
              This will permanently delete the entry for <b>{monthLabel}</b>.
            </p>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-full border px-3 py-1 text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={confirmDelete}
                className="rounded-full bg-rose-600 px-3 py-1 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCK MODAL */}
      {lockConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">
              {lockConfirm === 'lock'
                ? 'Lock this month?'
                : 'Unlock this month?'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {lockConfirm === 'lock'
                ? 'Edits and deletions will be disabled.'
                : 'Edits and deletions will be allowed again.'}
            </p>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setLockConfirm(null)}
                className="rounded-full border px-3 py-1 text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={() => applyLock(lockConfirm === 'lock')}
                className="rounded-full bg-slate-900 px-3 py-1 text-white"
              >
                {lockConfirm === 'lock' ? 'Lock month' : 'Unlock month'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
