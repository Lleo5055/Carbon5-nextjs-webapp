// app/dashboard/AIInsightsSection.tsx
'use client';

import React, { useEffect, useState } from 'react';

type AISummary = {
  periodLabel: string;
  totalCo2eKg: number;
  monthsCount: number;
  hotspot: 'Electricity' | 'Fuel' | 'Refrigerant' | null;
  electricitySharePercent: number;
  fuelSharePercent: number;
  refrigerantSharePercent: number;
  monthChangePercent: number;
};

interface Props {
  summary: AISummary;
}

export default function AIInsightsSection({ summary }: Props) {
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiRisk, setAiRisk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    periodLabel,
    monthsCount,
    hotspot,
    electricitySharePercent,
    fuelSharePercent,
    refrigerantSharePercent,
    monthChangePercent,
  } = summary;

  // Local fallback insights (your original logic)
  const defaultInsights: string[] = [];

  if (refrigerantSharePercent > 60) {
    defaultInsights.push(
      `Refrigerant dominates your footprint (~${refrigerantSharePercent.toFixed(
        1
      )}%). Focus on leak checks and servicing for cooling assets.`
    );
  }

  if (Math.abs(monthChangePercent) < 3) {
    defaultInsights.push(
      'Month-to-month movement is almost flat. Run one focused pilot (e.g. on fuel or electricity) to create a visible shift.'
    );
  }

  if (
    refrigerantSharePercent <= 60 &&
    electricitySharePercent >= 5 &&
    defaultInsights.length < 3
  ) {
    defaultInsights.push(
      'Electricity is still meaningful. Tighten HVAC set-points, timers and idle equipment to capture quick wins.'
    );
  }

  if (defaultInsights.length === 0) {
    defaultInsights.push(
      'Your footprint is fairly balanced. Pick one hotspot and run a 2–3 month experiment, then compare the dashboard before vs after.'
    );
  }

  // Auto-fetch AI insights on mount
  useEffect(() => {
    async function loadAI() {
      try {
        setLoading(true);

        const res = await fetch('/api/ai', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch AI insights.');

        const data = await res.json();

        setAiSummary(data.summary || null);
        setAiInsights(Array.isArray(data.insights) ? data.insights : null);
        setAiSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : null
        );
        setAiRisk(data.risk || null);
      } catch (err: any) {
        setError(err?.message || 'AI failed. Using local insights.');
      } finally {
        setLoading(false);
      }
    }

    loadAI();
  }, []);

  const bullets = aiInsights ?? defaultInsights;

  return (
    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        AI insights
      </p>

      <p className="mt-1 text-[11px] text-slate-500">
        Based on {monthsCount} month{monthsCount === 1 ? '' : 's'} of data (
        {periodLabel.toLowerCase()}) and your current hotspot{' '}
        {hotspot ? `(${hotspot.toLowerCase()})` : '(not enough data yet)'}.
      </p>

      {loading && (
        <p className="mt-3 text-[11px] text-slate-400">Generating insights…</p>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}

      {/* AI summary */}
      {aiSummary && !loading && (
        <p className="mt-3 text-xs font-semibold text-slate-900">{aiSummary}</p>
      )}

      {/* Insights */}
      {!loading && (
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[11px] text-slate-600">
          {bullets.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}

      {/* AI suggestions */}
      {aiSuggestions && !loading && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-800 mb-1">
            Suggestions
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
            {aiSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI risk */}
      {aiRisk && !loading && (
        <p className="mt-3 text-[11px] font-medium text-red-600">{aiRisk}</p>
      )}
    </div>
  );
}
