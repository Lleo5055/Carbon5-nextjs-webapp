'use client';

import Link from 'next/link';

export default function Scope3EditButton({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/emissions/${id}`}
      className="text-slate-600 hover:text-slate-900 text-sm"
    >
      Edit
    </Link>
  );
}
