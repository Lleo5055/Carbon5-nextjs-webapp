// app/dashboard/automations/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type AutomationKey =
  | 'monthlyReminder'
  | 'refrigerantAlert'
  | 'lowDataNudge'
  | 'simpleReportEmail';

export default function AutomationsPage() {
  const [enabled, setEnabled] = useState<Record<AutomationKey, boolean>>({
    monthlyReminder: true,
    refrigerantAlert: true,
    lowDataNudge: false,
    simpleReportEmail: false,
  });

  const toggle = (key: AutomationKey) =>
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const pillClass =
    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        {/* Header */}
        <section className="rounded-2xl border shadow bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50 p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Automations · Beta
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1">
              Keep things moving automatically.
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Light-touch automation so your carbon reporting doesn&apos;t rely
              on memory and spreadsheets.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/dashboard"
              className="text-xs text-slate-600 underline hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
            <span
              className={`${pillClass} bg-slate-900 text-white border border-slate-900`}
            >
              Beta preview
            </span>
          </div>
        </section>

        {/* Helper text */}
        <section className="rounded-xl bg-white border p-4 shadow text-[11px] text-slate-600">
          <p>
            These switches are{' '}
            <span className="font-semibold text-slate-900">preview only</span>.
            In the full product they&apos;ll control real reminders and alerts
            (email / in-app). For now, they&apos;re a safe way to design the
            experience without touching your live data.
          </p>
        </section>

        {/* Automations grid */}
        <section className="grid md:grid-cols-2 gap-4">
          {/* Monthly reminder */}
          <article className="rounded-xl bg-white border p-5 shadow flex flex-col gap-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Data hygiene
                </p>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">
                  Monthly data reminder
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggle('monthlyReminder')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  enabled.monthlyReminder
                    ? 'bg-slate-900 border-slate-900'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    enabled.monthlyReminder ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </header>

            <p className="text-xs text-slate-600">
              Once a month, we nudge your team to upload bills and meter
              readings so this dashboard never falls behind.
            </p>

            <ul className="mt-1 text-[11px] text-slate-500 list-disc pl-4 space-y-1">
              <li>Simple email-style nudge with a link to “Add emissions”.</li>
              <li>Targets your primary account email by default.</li>
            </ul>
          </article>

          {/* Refrigerant alert */}
          <article className="rounded-xl bg-white border p-5 shadow flex flex-col gap-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-sky-600">
                  Risk
                </p>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">
                  Refrigerant spike alert
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggle('refrigerantAlert')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  enabled.refrigerantAlert
                    ? 'bg-slate-900 border-slate-900'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    enabled.refrigerantAlert ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </header>

            <p className="text-xs text-slate-600">
              Flags unusual refrigerant usage so you can treat leaks as
              emergencies, not background noise.
            </p>

            <ul className="mt-1 text-[11px] text-slate-500 list-disc pl-4 space-y-1">
              <li>
                Triggers when refrigerant exceeds a threshold share of monthly
                CO₂e.
              </li>
              <li>In the full version, you&apos;ll pick who gets alerted.</li>
            </ul>
          </article>

          {/* Low data nudge */}
          <article className="rounded-xl bg-white border p-5 shadow flex flex-col gap-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-600">
                  Completeness
                </p>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">
                  Low-data nudge
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggle('lowDataNudge')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  enabled.lowDataNudge
                    ? 'bg-slate-900 border-slate-900'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    enabled.lowDataNudge ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </header>

            <p className="text-xs text-slate-600">
              If a month looks suspiciously low compared to your baseline, we
              suggest checking for missing bills or meters.
            </p>

            <ul className="mt-1 text-[11px] text-slate-500 list-disc pl-4 space-y-1">
              <li>Helps catch partial uploads before board packs go out.</li>
              <li>Designed to avoid noisy, every-day notifications.</li>
            </ul>
          </article>

          {/* Simple monthly report email */}
          <article className="rounded-xl bg-white border p-5 shadow flex flex-col gap-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-600">
                  Reporting
                </p>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">
                  Simple monthly report email
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggle('simpleReportEmail')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  enabled.simpleReportEmail
                    ? 'bg-slate-900 border-slate-900'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    enabled.simpleReportEmail
                      ? 'translate-x-5'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </header>

            <p className="text-xs text-slate-600">
              A lightweight email summary with last month&apos;s CO₂e, main
              hotspot and a simple chart – ready to forward to leadership.
            </p>

            <ul className="mt-1 text-[11px] text-slate-500 list-disc pl-4 space-y-1">
              <li>Pulls numbers directly from your dashboard.</li>
              <li>Future version can export attached PDF as well.</li>
            </ul>
          </article>
        </section>

        {/* Roadmap note */}
        <section className="rounded-xl bg-white border p-5 shadow text-[11px] text-slate-600">
          <p className="font-semibold text-slate-900 mb-1">
            What happens when we “switch these on” for real?
          </p>
          <p>
            In Phase 2 we&apos;ll back these toggles with real automations
            stored in Supabase – including schedules, channels (email /
            in-product), and audit logs – without you needing to change this
            screen. For now, treat this as the UX your customers will see.
          </p>
        </section>
      </div>
    </main>
  );
}
