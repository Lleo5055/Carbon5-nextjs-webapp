'use client';

import React, { useEffect, useState } from 'react';

export default function BenchmarkingSection({
  yourCo2e,
}: {
  yourCo2e: number;
}) {
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiRisk, setAiRisk] = useState<string | null>(null);

  useEffect(() => {
    async function loadBenchmark() {
      try {
        const res = await fetch('/api/ai', { cache: 'no-store' });
        const data = await res.json();

        // Your API returns:
        // summary: string
        // insights: [ ... ]
        // recommendations: [ ... ]
        // trends: string | undefined
        // key_metrics: { ... }

        setAiSummary(data.summary ?? null);
        setAiInsight(data.insights?.[0] ?? null);
        setAiRisk(data.trends ?? null); // using "trends" as the risk text
      } catch {
        setAiSummary('Benchmarking unavailable');
        setAiInsight('Unable to compare against SME norms at the moment.');
      } finally {
        setLoading(false);
      }
    }

    loadBenchmark();
  }, []);

  const industryAverage = 1.82; // your static UK value
  const you = yourCo2e ?? 0;

  const performanceRank =
    you < industryAverage ? 'Top 25% performance' : 'Below SME average';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        Benchmarking
      </p>

      {loading ? (
        <p className="mt-2 text-[11px] text-slate-400">Loading benchmarking…</p>
      ) : (
        <>
          {/* AI SUMMARY */}
          {aiSummary && (
            <p className="mt-2 text-[12px] font-semibold text-slate-900">
              {aiSummary}
            </p>
          )}

          {/* AI INSIGHT */}
          {aiInsight && (
            <p className="mt-2 text-[11px] text-slate-600">{aiInsight}</p>
          )}

          {/* AI RISK / TRENDS */}
          {aiRisk && (
            <p className="mt-2 text-[11px] text-red-600 font-medium">
              {aiRisk}
            </p>
          )}

          {/* EXISTING UI (UNCHANGED) */}
          <div className="mt-4">
            <p className="text-[11px] text-slate-500">INDUSTRY AVERAGE</p>
            <p className="text-sm font-semibold text-slate-900">
              {industryAverage} tCO₂e
            </p>

            <p className="mt-3 text-[11px] text-slate-500">YOU</p>
            <p className="text-sm font-semibold text-slate-900">{you} tCO₂e</p>

            <div className="mt-2 rounded-full bg-emerald-100 px-2 py-1 w-fit">
              <p className="text-[10px] font-medium text-emerald-700">
                {performanceRank}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
