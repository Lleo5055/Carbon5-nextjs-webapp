'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Props = {
  id: number | string;
  monthLabel: string;
};

export default function RowActions({ id, monthLabel }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleConfirmDelete = () => {
    setOpen(false);
    // Trigger the delete route – it will redirect back with a success flag
    router.push(`/dashboard/emissions/delete?id=${id}`);
  };

  return (
    <>
      <div className="flex gap-2">
        <Link
          href={`/dashboard/emissions?id=${id}&month=${encodeURIComponent(
            monthLabel
          )}`}
          className="px-2 py-1 rounded-full border border-slate-300 text-[11px] hover:bg-slate-900 hover:text-white"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2 py-1 rounded-full border border-red-200 text-[11px] text-red-700 hover:bg-red-600 hover:text-white"
        >
          Delete
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-slate-900">
              Delete {monthLabel} emissions?
            </p>
            <p className="mt-1 text-xs text-slate-600">
              This will permanently remove this month&apos;s record. You
              can&apos;t undo this.
            </p>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-full bg-red-600 px-3 py-1 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
