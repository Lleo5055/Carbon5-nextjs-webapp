'use client';

import Link from 'next/link';

export default function Scope3ActionsCell({ row }: { row: any }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/dashboard/emissions/${row.month}`}
        className="text-slate-600 hover:text-slate-900 text-sm"
      >
        Edit
      </Link>

      <Link
        href={`/dashboard/emissions/scope3/${row.id}/delete`}
        className="text-rose-600 hover:text-rose-800 text-sm"
      >
        Delete
      </Link>
    </div>
  );
}
