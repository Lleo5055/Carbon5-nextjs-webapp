// app/dashboard/emissions/ManualEmissionsForm.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ManualEmissionsInitialValues = {
  monthName: string;
  year: number;
  electricityKwh: number;
  dieselLitres: number;
  petrolLitres: number;
  gasKwh: number;
  refrigerantKg: number;
  refrigerantCode: string;
};

interface ManualEmissionsFormProps {
  mode: 'add' | 'edit';
  emissionId: string | null;
  initialValues: ManualEmissionsInitialValues | null;
}

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

function getDefaultMonthYear() {
  const now = new Date();
  return {
    monthName: now.toLocaleString('default', { month: 'long' }),
    year: now.getFullYear(),
  };
}

export default function ManualEmissionsForm({
  mode,
  emissionId,
  initialValues,
}: ManualEmissionsFormProps) {
  const router = useRouter();
  const defaultMonthYear = initialValues
    ? { monthName: initialValues.monthName, year: initialValues.year }
    : getDefaultMonthYear();

  const [monthName, setMonthName] = useState(defaultMonthYear.monthName);
  const [year, setYear] = useState<number>(defaultMonthYear.year);

  const [electricityKwh, setElectricityKwh] = useState(
    initialValues?.electricityKwh?.toString() ?? ''
  );
  const [dieselLitres, setDieselLitres] = useState(
    initialValues?.dieselLitres?.toString() ?? ''
  );
  const [petrolLitres, setPetrolLitres] = useState(
    initialValues?.petrolLitres?.toString() ?? ''
  );
  const [gasKwh, setGasKwh] = useState(initialValues?.gasKwh?.toString() ?? '');
  const [refrigerantKg, setRefrigerantKg] = useState(
    initialValues?.refrigerantKg?.toString() ?? ''
  );
  const [refrigerantCode, setRefrigerantCode] = useState(
    initialValues?.refrigerantCode ?? 'GENERIC_HFC'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/emissions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: emissionId,
          monthName,
          year,
          electricityKwh,
          dieselLitres,
          petrolLitres,
          gasKwh,
          refrigerantKg,
          refrigerantCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save month');
      }

      setSuccessMsg(
        mode === 'edit'
          ? 'Month updated successfully.'
          : 'Month saved successfully.'
      );

      // Give a tiny pause so the user can see the message, then go back
      setTimeout(() => {
        router.push('/dashboard/emissions/view-emissions');
        router.refresh();
      }, 400);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong while saving.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const buttonLabel = mode === 'edit' ? 'Update month' : 'Save month';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Reporting month */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reporting month
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            className="h-10 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            value={monthName}
            onChange={(e) => setMonthName(e.target.value)}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Electricity */}
      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-medium text-slate-800">
            Electricity (kWh)
          </h3>
          <p className="text-xs text-slate-500">
            Grid electricity used this month.
          </p>
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="e.g. 1,200"
          value={electricityKwh}
          onChange={(e) => setElectricityKwh(e.target.value)}
        />
      </section>

      {/* Road fuel */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-slate-800">
            Road fuel (litres)
          </h3>
          <p className="text-xs text-slate-500">
            Diesel & petrol for vehicles, plus any road fuel used for heating.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Diesel (L)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 350"
              value={dieselLitres}
              onChange={(e) => setDieselLitres(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Petrol (L)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 120"
              value={petrolLitres}
              onChange={(e) => setPetrolLitres(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Gas (kWh)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 800"
              value={gasKwh}
              onChange={(e) => setGasKwh(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Refrigerant */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-slate-800">
            Refrigerant (kg)
          </h3>
          <p className="text-xs text-slate-500">
            Top-ups or leaks across AC / cold-room systems this month.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr,3fr]">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Refrigerant (kg)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 2.5"
              value={refrigerantKg}
              onChange={(e) => setRefrigerantKg(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Refrigerant gas
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={refrigerantCode}
              onChange={(e) => setRefrigerantCode(e.target.value)}
            >
              <option value="GENERIC_HFC">Not sure / generic HFC</option>
              <option value="R410A">R410A</option>
              <option value="R407A">R407A</option>
              <option value="R134A">R134a</option>
              <option value="R404A">R404A</option>
            </select>
          </div>
        </div>
      </section>

      {/* Messages */}
      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {successMsg}
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving…' : buttonLabel}
        </button>
      </div>
    </form>
  );
}
