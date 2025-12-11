'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  calcFuelCo2eKg,
  calcRefrigerantCo2e,
} from '../../../lib/emissionFactors';
import { Suspense } from 'react';
// --------------------------------
// FIX 1: Safe default Scope 3 key
// --------------------------------
const DEFAULT_SCOPE3 = 'business_travel';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function buildMonthLabel(monthName: string, year: number) {
  return `${monthName} ${year}`;
}

function parseMonthLabel(label: string | null | undefined) {
  if (!label || typeof label !== 'string') {
    const now = new Date();
    return {
      monthName: MONTHS[now.getMonth()],
      year: now.getFullYear(),
    };
  }

  const parts = label.split(' ');
  if (parts.length >= 2) {
    const maybeYear = Number(parts[parts.length - 1]);
    const monthName = parts.slice(0, parts.length - 1).join(' ');
    if (!Number.isNaN(maybeYear) && MONTHS.includes(monthName)) {
      return { monthName, year: maybeYear };
    }
  }

  const now = new Date();
  return {
    monthName: MONTHS[now.getMonth()],
    year: now.getFullYear(),
  };
}

const REFRIGERANT_OPTIONS = [
  { value: 'R410A', label: 'R410A (split AC – common)' },
  { value: 'R134A', label: 'R134a (chillers / older systems)' },
  { value: 'R407C', label: 'R407C (comfort cooling)' },
  { value: 'R404A', label: 'R404A (cold rooms / refrigeration)' },
  { value: 'GENERIC_HFC', label: 'Not sure / generic HFC' },
];

// --------------------------------
// SCOPE 3 categories & factors
// --------------------------------
const SCOPE3_CATEGORIES = [
  { value: 'purchased_goods', label: 'Purchased goods & services' },
  { value: 'business_travel', label: 'Business travel' },
  { value: 'employee_commuting', label: 'Employee commuting' },
  { value: 'waste', label: 'Waste generated in operations' },
  { value: 'upstream_transport', label: 'Upstream transport & distribution' },
  { value: 'downstream_transport', label: 'Downstream transport & use' },
  { value: 'other', label: 'Other Scope 3' },
];

// (unchanged factors)
const SCOPE3_FACTOR_CONFIG: Record<
  string,
  {
    unitLabel: string;
    inputLabel: string;
    helper: string;
    factorKgPerUnit: number;
  }
> = {
  purchased_goods: {
    unitLabel: '£ spend',
    inputLabel: 'Spend this month (£)',
    helper:
      'Total spend on goods & services that are mainly purchased for operations (ex-VAT where possible).',
    factorKgPerUnit: 0.35,
  },
  business_travel: {
    unitLabel: 'km travelled',
    inputLabel: 'Business travel distance (km)',
    helper:
      'Approximate total distance for business travel (flights, trains, taxis, etc.) this month.',
    factorKgPerUnit: 0.18,
  },
  employee_commuting: {
    unitLabel: 'km commuted',
    inputLabel: 'Employee commuting distance (km)',
    helper:
      'Rough total commute distance for staff this month (all modes combined).',
    factorKgPerUnit: 0.12,
  },
  waste: {
    unitLabel: 'kg waste',
    inputLabel: 'Waste generated (kg)',
    helper:
      'Mixed operational waste sent to landfill / energy-from-waste / recycling this month.',
    factorKgPerUnit: 0.5,
  },
  upstream_transport: {
    unitLabel: 'tonne·km',
    inputLabel: 'Upstream transport (tonne·km)',
    helper:
      'Freight for inbound goods – tonnes moved × distance in km (rough estimate is fine).',
    factorKgPerUnit: 0.12,
  },
  downstream_transport: {
    unitLabel: 'tonne·km',
    inputLabel: 'Downstream transport (tonne·km)',
    helper:
      'Freight for delivering products/services to customers – tonnes moved × distance.',
    factorKgPerUnit: 0.12,
  },
  other: {
    unitLabel: 'kg CO₂e',
    inputLabel: 'Known Scope 3 CO₂e (kg)',
    helper:
      'If you already have a CO₂e figure from another tool, enter it directly here.',
    factorKgPerUnit: 1,
  },
};

function EmissionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editingId = searchParams.get('id');
  const isEditMode = Boolean(editingId);

  const today = new Date();
  const currentYear = today.getFullYear();

  const [monthName, setMonthName] = useState<string>(MONTHS[today.getMonth()]);
  const [year, setYear] = useState<number>(currentYear);

  const [electricityKwh, setElectricityKwh] = useState<string>('');
  const [dieselLitres, setDieselLitres] = useState<string>('');
  const [petrolLitres, setPetrolLitres] = useState<string>('');
  const [gasKwh, setGasKwh] = useState<string>('');
  const [refrigerantKg, setRefrigerantKg] = useState<string>('');
  const [refrigerantCode, setRefrigerantCode] = useState<string>('GENERIC_HFC');

  // --------------------------------
  // Scope 3 FIXED: guaranteed default
  // --------------------------------
  const [scope3Enabled, setScope3Enabled] = useState<boolean>(false);
  const [scope3Category, setScope3Category] = useState<string>(DEFAULT_SCOPE3);
  const [scope3Label, setScope3Label] = useState<string>('');
  const [scope3ActivityValue, setScope3ActivityValue] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // -------------------------------
  // Load existing row when editing
  // -------------------------------
  useEffect(() => {
    if (!editingId) return;

    let cancelled = false;

    async function loadForEdit() {
      try {
        const { data, error } = await supabase
          .from('emissions')
          .select('*')
          .eq('id', editingId)
          .maybeSingle();

        if (error) {
          console.error('Error loading emission for edit', error);
          return;
        }
        if (!data || cancelled) return;

        const parsed = parseMonthLabel(data.month as string | null);
        setMonthName(parsed.monthName);
        setYear(parsed.year);

        setElectricityKwh(
          data.electricity_kw != null ? String(data.electricity_kw) : ''
        );
        setDieselLitres(
          data.diesel_litres != null ? String(data.diesel_litres) : ''
        );
        setPetrolLitres(
          data.petrol_litres != null ? String(data.petrol_litres) : ''
        );
        setGasKwh(data.gas_kwh != null ? String(data.gas_kwh) : '');
        setRefrigerantKg(
          data.refrigerant_kg != null ? String(data.refrigerant_kg) : ''
        );

        const code =
          (data.refrigerant_code as string | null) ??
          (data.refrigerant_type as string | null) ??
          'GENERIC_HFC';

        setRefrigerantCode(code);
      } catch (err) {
        console.error('Unexpected error loading emission for edit', err);
      }
    }

    loadForEdit();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  // -------------------------------------------
  // FIX 2: Safe Scope 3 config + calc block
  // -------------------------------------------
  const activeScope3Config =
    SCOPE3_FACTOR_CONFIG[scope3Category] ??
    SCOPE3_FACTOR_CONFIG[DEFAULT_SCOPE3];

  const parsedActivity = Number(scope3ActivityValue) || 0;

  const calculatedScope3Kg =
    scope3Enabled && parsedActivity > 0
      ? parsedActivity * activeScope3Config.factorKgPerUnit
      : 0;

  // -------------------------------------------
  // FORM SUBMIT
  // -------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const monthLabel = buildMonthLabel(monthName, year);

    const elec = Number(electricityKwh) || 0;
    const diesel = Number(dieselLitres) || 0;
    const petrol = Number(petrolLitres) || 0;
    const gas = Number(gasKwh) || 0;
    const ref = Number(refrigerantKg) || 0;
    const refCode = refrigerantCode || 'GENERIC_HFC';

    const hasScope12Activity =
      elec !== 0 || diesel !== 0 || petrol !== 0 || gas !== 0 || ref !== 0;

    const hasScope3Activity = scope3Enabled && calculatedScope3Kg > 0;

    // ensure logged in
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You must be signed in to save emissions.');
      setLoading(false);
      return;
    }

    const fuelCo2 = calcFuelCo2eKg({
      dieselLitres: diesel,
      petrolLitres: petrol,
      gasKwh: gas,
    });

    const elecCo2 = elec * EF_GRID_ELECTRICITY_KG_PER_KWH;
    const refCo2 = calcRefrigerantCo2e(ref, refCode);
    const totalCo2e = elecCo2 + fuelCo2 + refCo2;

    try {
      let scope12MessagePart = '';
      let scope3MessagePart = '';

      // ----------------------------------
      // SCOPE 1 & 2 — unchanged logic
      // ----------------------------------
      if (hasScope12Activity) {
        const { data: existingRows } = await supabase
          .from('emissions')
          .select('*')
          .eq('month', monthLabel);

        const existing = existingRows?.[0];

        if (existing) {
          // EDIT MODE → REPLACE VALUES, DO NOT ACCUMULATE
          const { error: updateError } = await supabase
            .from('emissions')
            .update({
              electricity_kw: elec,
              diesel_litres: diesel,
              petrol_litres: petrol,
              gas_kwh: gas,
              refrigerant_kg: ref,
              refrigerant_code: refCode,
              total_co2e: totalCo2e,
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          scope12MessagePart = `Scope 1 & 2 updated for ${monthLabel}. `;
        } else {
          // ADD MODE → INSERT NEW ROW
          const { error: insertError } = await supabase
            .from('emissions')
            .insert({
              user_id: user.id,
              month: monthLabel,
              electricity_kw: elec,
              diesel_litres: diesel,
              petrol_litres: petrol,
              gas_kwh: gas,
              refrigerant_kg: ref,
              refrigerant_code: refCode,
              total_co2e: totalCo2e,
            });

          if (insertError) throw insertError;

          scope12MessagePart = `Scope 1 & 2 saved for ${monthLabel}. `;
        }
      }

      // ----------------------------------
      // SCOPE 3 — FIXED for consistency
      // ----------------------------------
      if (hasScope3Activity) {
        const { error: scope3Error } = await supabase
          .from('scope3_activities')
          .insert({
            user_id: user.id,
            month: monthLabel,
            category: scope3Category,
            label: scope3Label || null,
            data: {
              activity_value: parsedActivity,
              unit: activeScope3Config.unitLabel,
              factor_kg_per_unit: activeScope3Config.factorKgPerUnit,
            },
            co2e_kg: calculatedScope3Kg,
          });

        if (scope3Error) throw scope3Error;

        scope3MessagePart = `Scope 3 activity recorded (${calculatedScope3Kg.toFixed(
          1
        )} kg CO₂e).`;
      }

      const combinedMsg = `${scope12MessagePart}${scope3MessagePart}`.trim();
      setMessage(combinedMsg || 'Saved.');

      if (!isEditMode) {
        setElectricityKwh('');
        setDieselLitres('');
        setPetrolLitres('');
        setGasKwh('');
        setRefrigerantKg('');
        setScope3ActivityValue('');
        setScope3Label('');
      } else {
        setTimeout(() => {
          router.push('/dashboard/emissions/view-emissions');
          router.refresh();
        }, 300);
      }
    } catch (err: any) {
      console.error('SAVE ERROR:', err);
      setError(err.message || 'Something went wrong while saving.');
    } finally {
      setLoading(false);
    }
  }
  const heading = isEditMode
    ? 'Edit monthly emissions'
    : 'Add monthly emissions';

  const subCopy = isEditMode
    ? 'Update fuel, electricity and refrigerant activity for an existing month. You can also add a simple Scope 3 activity.'
    : 'Log fuel, electricity and refrigerant activity for a single month. You can also add a simple Scope 3 activity in the same step.';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* HEADER CARD */}
        <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50 px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* LEFT SIDE TEXT */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                Emissions · Scope 1 &amp; 2 (+ Scope 3)
              </p>

              <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900">
                {heading}
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md">
                {subCopy}
              </p>

              <p className="mt-2 text-[11px] text-slate-500">
                We store emissions as a single record per month (e.g. “
                <span className="font-medium">
                  {buildMonthLabel(monthName, year)}
                </span>
                ”) and automatically combine multiple entries when you add more
                data for the same month.
              </p>

              {isEditMode && (
                <p className="mt-1 text-[11px] text-emerald-700">
                  You&apos;re editing an existing month. Changes here will
                  replace the saved totals for this month.
                </p>
              )}
            </div>

            {/* RIGHT-SIDE CARD */}
            <div className="w-full sm:w-auto">
              <div className="rounded-2xl border border-emerald-100 bg-white/70 px-3 py-3 sm:px-4 sm:py-3 flex flex-col gap-3 sm:min-w-[260px]">
                <div className="text-[11px] text-slate-600">
                  <p className="font-medium text-slate-800">
                    One combined record per month.
                  </p>
                  <p className="mt-1">
                    Perfect for entering monthly totals from bills, fuel cards
                    or meter reads, plus one optional Scope 3 line item.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Link
                    href="/dashboard/emissions/view-emissions"
                    className="h-[30px] px-3 rounded-full border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                  >
                    View emissions history
                  </Link>

                  <Link
                    href="/dashboard"
                    className="h-[30px] px-3 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center hover:bg-slate-800"
                  >
                    ← Back to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FORM SECTION */}
        <section className="rounded-xl bg-white border p-6 shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* MONTH SELECTION */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Reporting month
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <select
                  value={monthName}
                  onChange={(e) => setMonthName(e.target.value)}
                  className="border rounded-full px-3 py-1.5 text-xs bg-white"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={year}
                  onChange={(e) =>
                    setYear(Number(e.target.value) || currentYear)
                  }
                  className="border rounded-full px-3 py-1.5 text-xs bg-white w-24"
                  min={currentYear - 10}
                  max={currentYear + 10}
                />
              </div>
            </div>

            {/* SCOPE 1 + 2 GRID */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* LEFT SIDE FIELDS */}
              <div className="space-y-4">
                {/* ELECTRICITY */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Electricity (kWh)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={electricityKwh}
                    onChange={(e) => setElectricityKwh(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                    placeholder="e.g. 1,200"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Grid electricity used this month.
                  </p>
                </div>

                {/* ROAD FUEL BLOCK */}
                <div className="border rounded-lg px-3 py-3 bg-slate-50 space-y-3">
                  <p className="text-[11px] font-medium text-slate-700">
                    Road fuel (litres)
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Diesel (L)
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={dieselLitres}
                        onChange={(e) => setDieselLitres(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 350"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Petrol (L)
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={petrolLitres}
                        onChange={(e) => setPetrolLitres(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 120"
                      />
                    </div>
                  </div>

                  {/* GAS */}
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Gas (kWh)
                    </label>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={gasKwh}
                      onChange={(e) => setGasKwh(e.target.value)}
                      className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                      placeholder="e.g. 800"
                    />
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Diesel & petrol for vehicles, plus gas used for heating.
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE = REFRIGERANT */}
              <div className="space-y-4">
                {/* REFRIG KG */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Refrigerant (kg)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refrigerantKg}
                    onChange={(e) => setRefrigerantKg(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                    placeholder="e.g. 2.5"
                  />

                  <p className="mt-1 text-[11px] text-slate-500">
                    Top-ups or leaks across AC / cold-room systems this month.
                  </p>
                </div>

                {/* REFRIG TYPE */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Refrigerant gas
                  </label>

                  <select
                    value={refrigerantCode}
                    onChange={(e) => setRefrigerantCode(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    {REFRIGERANT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-[11px] text-slate-500">
                    If unsure, leave as “Not sure / generic HFC”.
                  </p>
                </div>
              </div>
            </div>
            {/* Scope 3 calculator */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Scope 3 (optional)
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Choose a category and enter simple activity data. We'll
                    estimate CO₂e and store it in your Scope 3 log.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-300"
                    checked={scope3Enabled}
                    onChange={(e) => setScope3Enabled(e.target.checked)}
                  />
                  Enable
                </label>
              </div>

              {scope3Enabled && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Category
                      </label>
                      <select
                        value={scope3Category}
                        onChange={(e) => {
                          setScope3Category(e.target.value);
                          setScope3ActivityValue('');
                        }}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                      >
                        {SCOPE3_CATEGORIES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Label / description (optional)
                      </label>
                      <input
                        type="text"
                        value={scope3Label}
                        onChange={(e) => setScope3Label(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        placeholder="e.g. Flights to client meetings"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        {activeScope3Config.inputLabel}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={scope3ActivityValue}
                        onChange={(e) => setScope3ActivityValue(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        placeholder={`e.g. 1,000 ${activeScope3Config.unitLabel}`}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {activeScope3Config.helper}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span>
                      Estimated Scope 3 for this activity:{' '}
                      <span className="font-semibold">
                        {calculatedScope3Kg > 0
                          ? `${calculatedScope3Kg.toFixed(1)} kg CO₂e`
                          : '0 kg CO₂e'}
                      </span>
                    </span>

                    <span className="text-[10px] text-slate-500">
                      {activeScope3Config.factorKgPerUnit.toFixed(2)} kg CO₂e
                      per {activeScope3Config.unitLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            {(error || message) && (
              <div className="text-xs">
                {error && (
                  <p className="text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {message && (
                  <p className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
                    {message}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-60"
              >
                {loading
                  ? 'Saving…'
                  : isEditMode
                  ? 'Update month'
                  : 'Save month'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function EmissionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmissionsPageInner />
    </Suspense>
  );
}
