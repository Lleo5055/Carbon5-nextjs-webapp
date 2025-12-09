// app/dashboard/emissions/view-emissions/DownloadReportButton.tsx
'use client';

import React from 'react';

export default function DownloadReportButton({ pdfHref }: { pdfHref: string }) {
  /**
   * Extract query params from current URL.
   * This gives us:
   * - period (1m, 3m, 6m, 12m, all)
   * - customStart (YYYY-MM)
   * - customEnd (YYYY-MM)
   */
  const getPeriodParams = () => {
    const url = new URL(window.location.href);
    const period = url.searchParams.get('period') || 'all';
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    // Option C intelligence: auto classify period
    let periodType: 'quick' | 'custom' | 'all' = 'all';

    if (period === 'all') {
      periodType = 'all';
    } else if (start && end) {
      periodType = 'custom';
    } else {
      periodType = 'quick';
    }

    return { periodType, period, start, end };
  };

  const handleClick = async () => {
    try {
      const { periodType, period, start, end } = getPeriodParams();

      // Build final URL
      const url = new URL(pdfHref, window.location.origin);

      url.searchParams.set('periodType', periodType);
      url.searchParams.set('period', period);

      if (periodType === 'custom') {
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
      }

      const finalHref = url.toString();

      const res = await fetch(finalHref, { method: 'GET' });

      if (!res.ok) {
        alert('Could not generate PDF report. Please try again.');
        return;
      }

      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);

      // Open PDF directly
      window.location.href = pdfUrl;

      setTimeout(() => {
        window.print();
      }, 900);
    } catch (err) {
      console.error(err);
      alert('Failed to download report.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
    >
      Download report (PDF)
    </button>
  );
}
