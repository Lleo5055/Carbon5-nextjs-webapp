// app/dashboard/HotspotPieChart.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

type BreakdownBySource = {
  electricitySharePercent: number;
  fuelSharePercent: number;
  refrigerantSharePercent: number;
};

type SliceKey = 'electricity' | 'fuel' | 'refrigerant';

interface HotspotPieChartProps {
  breakdown: BreakdownBySource;
}

export default function HotspotPieChart({ breakdown }: HotspotPieChartProps) {
  const router = useRouter();

  const slices: {
    key: SliceKey;
    label: string;
    value: number;
    color: string;
    href: string;
  }[] = [
    {
      key: 'electricity',
      label: 'Electricity',
      value: breakdown.electricitySharePercent || 0,
      color: '#0EA5E9', // sky-500
      href: '/dashboard/emissions/electricity',
    },
    {
      key: 'fuel',
      label: 'Fuel',
      value: breakdown.fuelSharePercent || 0,
      color: '#F97316', // orange-500
      href: '/dashboard/emissions/fuel',
    },
    {
      key: 'refrigerant',
      label: 'Refrigerant',
      value: breakdown.refrigerantSharePercent || 0,
      color: '#22C55E', // green-500
      href: '/dashboard/emissions/refrigerant',
    },
  ];

  const total = slices.reduce((sum, s) => sum + (s.value || 0), 0) || 1;

  // pick the dominant slice for the centre label
  const topSlice =
    slices.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0] ??
    slices[0];

  // Pie geometry (donut)
  let cumulative = 0;
  const cx = 80;
  const cy = 80;
  const outerR = 70;

  function getCoordsForFraction(fraction: number) {
    const angle = 2 * Math.PI * fraction - Math.PI / 2; // start at top
    return {
      x: cx + outerR * Math.cos(angle),
      y: cy + outerR * Math.sin(angle),
    };
  }

  const paths = slices.map((slice) => {
    const startFraction = cumulative / total;
    cumulative += slice.value;
    const endFraction = cumulative / total;

    const start = getCoordsForFraction(startFraction);
    const end = getCoordsForFraction(endFraction);
    const largeArcFlag = endFraction - startFraction > 0.5 ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');

    return { ...slice, d };
  });

  const handleClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox="0 0 160 160"
        className="h-32 w-32 md:h-36 md:w-36 cursor-pointer"
        role="img"
        aria-label="Emissions breakdown by source"
      >
        {/* coloured wedges */}
        {paths.map((slice) => (
          <path
            key={slice.key}
            d={slice.d}
            fill={slice.color}
            onClick={() => handleClick(slice.href)}
            className="transition-opacity hover:opacity-80"
          />
        ))}

        {/* centre circle to make it a donut */}
        <circle cx={cx} cy={cy} r={42} fill="white" />

        {/* centre label – matches the “TOP SOURCE • Refrigerant” look */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="text-[8px] font-medium"
          fill="#64748b"
        >
          TOP SOURCE
        </text>
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          className="text-[10px] font-semibold"
          fill="#0f172a"
        >
          {topSlice?.label ?? ''}
        </text>
      </svg>

      {/* legend – each row also clickable into its page */}
      <div className="space-y-2 text-xs">
        {slices.map((slice) => (
          <button
            key={slice.key}
            type="button"
            onClick={() => handleClick(slice.href)}
            className="flex items-center gap-2 text-left hover:text-slate-900"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="flex-1 text-slate-600">{slice.label}</span>
            <span className="font-medium text-slate-900">
              {slice.value.toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
