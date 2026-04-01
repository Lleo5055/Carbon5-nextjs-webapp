'use client';

import React from 'react';
import { loadViewState, getViewLabel } from '@/lib/enterpriseView';

interface Props {
  className?: string;
  label?: string;
}

export default function ViewIndicator({ className = '', label: labelProp }: Props) {
  const [label, setLabel] = React.useState<string | null>(labelProp ?? null);

  React.useEffect(() => {
    if (labelProp !== undefined) return;
    const state = loadViewState();
    setLabel(getViewLabel(state));
  }, [labelProp]);

  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3 w-3 flex-shrink-0"
      >
        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        <path
          fillRule="evenodd"
          d="M1.38 8.28a.87.87 0 0 1 0-.566 7.003 7.003 0 0 1 13.238.006.87.87 0 0 1 0 .566A7.003 7.003 0 0 1 1.38 8.28ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          clipRule="evenodd"
        />
      </svg>
      Viewing: {label}
    </span>
  );
}