'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  row: any;
};

export default function Scope3ActionsCell({ row }: Props) {
  const router = useRouter();
  const monthLabel = row.month;

  const now = new Date();
  const currentMonthLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const [locked, setLocked] = useState(monthLabel !== currentMonthLabel);
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

      // Enforce rule: only current month can ever be unlocked
      if (monthLabel !== currentMonthLabel) {
        setLocked(true);
      } else {
        setLocked(data.locked);
      }
    }

    loadLockOverride();
    return () => { mounted = false; };
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
      <div className="flex gap-2 text-[11px]">
        {!locked && (
          <>
            <Link
              href={`/dashboard/emissions?edit=scope3&id=${row.id}`}
              className="px-2 py-1 rounded-full border hover:bg-slate-900 hover:text-white"
            >
              Edit
            </Link>

            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-2 py-1 rounded-full border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
            >
              Delete
            </button>
          </>
        )}

        <button
          onClick={() => setLockConfirm(locked ? 'unlock' : 'lock')}
          className="px-2 py-1 rounded-full border text-slate-600 hover:bg-slate-100"
        >
          {locked ? 'Unlock' : 'Lock'}
        </button>
      </div>

      {/* DELETE MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">Delete Scope 3 activity?</p>
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
              {lockConfirm === 'lock' ? 'Lock this month?' : 'Unlock this month?'}
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
