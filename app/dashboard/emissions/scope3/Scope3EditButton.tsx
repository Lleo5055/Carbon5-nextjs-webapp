// Suggestion: Move this file to components folder for better organization
// It is also duplicated in view-emissions, but with different styling
'use client';

import Link from 'next/link';

export default function Scope3EditButton({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/emissions/scope3/${id}`}
      className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 transition"
    >
      Edit
    </Link>
  );
}
