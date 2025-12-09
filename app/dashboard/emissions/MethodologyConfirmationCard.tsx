// app/dashboard/emissions/MethodologyConfirmationCard.tsx
'use client';

import React, { useState, useEffect } from 'react';

type MethodologyConfirmationValue = {
  confirmed: boolean;
  note: string;
};

interface MethodologyConfirmationCardProps {
  /** Initial value – useful when editing an existing report */
  initialValue?: MethodologyConfirmationValue;
  /** Called whenever the user toggles confirmation or updates the note */
  onChange?: (value: MethodologyConfirmationValue) => void;
  /** Disable interactions when saving/submitting */
  disabled?: boolean;
}

export default function MethodologyConfirmationCard({
  initialValue,
  onChange,
  disabled,
}: MethodologyConfirmationCardProps) {
  const [confirmed, setConfirmed] = useState<boolean>(
    initialValue?.confirmed ?? false
  );
  const [note, setNote] = useState<string>(initialValue?.note ?? '');

  useEffect(() => {
    if (onChange) {
      onChange({ confirmed, note });
    }
  }, [confirmed, note, onChange]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Methodology &amp; assumptions
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This section explains how Carbon Central calculates your emissions.
            Confirming this is required for SECR-style reporting.
          </p>
        </div>

        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
          Required for SECR
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
        <p className="font-medium text-slate-900">
          Carbon Central uses the following standard methodology:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>UK Government GHG Conversion Factors (DEFRA 2024).</li>
          <li>Operational control boundary approach.</li>
          <li>
            Scope 1: direct emissions from fuel use and refrigerant leakage.
          </li>
          <li>Scope 2: indirect emissions from purchased electricity.</li>
          <li>
            Optional Scope 3 categories where data has been provided (e.g.
            business travel, purchased goods).
          </li>
          <li>All emissions reported in kg CO₂e using standard formulas.</li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          If any parts of your organisation are excluded or use a different
          approach, add a short note below.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={disabled}
          />
          <span className="text-xs text-slate-800">
            I confirm this methodology is appropriate for my organisation&apos;s
            emissions reporting for this period.
          </span>
        </label>

        <div>
          <label className="flex items-center justify-between text-[11px] font-medium text-slate-700">
            Optional note
            <span className="text-[10px] font-normal text-slate-400">
              E.g. “Head office only, warehouse excluded in this year”
            </span>
          </label>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any clarifications about your boundary, exclusions, or estimation methods (optional)…"
            disabled={disabled}
          />
        </div>
      </div>

      {!confirmed && (
        <p className="mt-3 text-[11px] text-amber-600">
          To generate a SECR-style report, you&apos;ll need to confirm this
          methodology.
        </p>
      )}
    </section>
  );
}
