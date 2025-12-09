'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  calcFuelCo2eKg,
  calcRefrigerantCo2e,
} from '@/lib/emissionFactors';

type EmissionRow = {
  id: string;
  month: string;
  electricity_kw: number | null;
  diesel_litres: number | null;
  petrol_litres: number | null;
  gas_kwh: number | null;
  fuel_liters: number | null;
  refrigerant_kg: number | null;
  refrigerant_code: string | null;
  total_co2e: number | null;
};

const REFRIGERANT_OPTIONS = [
  { value: 'R410A', label: 'R410A (split AC – common)' },
  { value: 'R134A', label: 'R134a (chillers / older systems)' },
  { value: 'R407C', label: 'R407C (comfort cooling)' },
  { value: 'R404A', label: 'R404A (cold rooms / refrigeration)' },
  {
    value: 'GENERIC_HFC',
    label: 'Not sure / generic HFC',
  },
];

export default function EditEmissionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const emissionId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [monthLabel, setMonthLabel] = useState<string>('');

  const [electricityKwh, setElectricityKwh] = useState<string>('');
  const [dieselLitres, setDieselLitres] = useState<string>('');
  const [petrolLitres, setPetrolLitres] = useState<string>('');
  const [gasKwh, setGasKwh] = useState<string>('');
  const [refrigerantKg, setRefrigerantKg] = useState<string>('');
  const [refrigerantCode, setRefrigerantCode] = useState<string>('GENERIC_HFC');

  // Fetch existing row (RLS will ensure they only see their own)
  useEffect(() => {
    async function fetchEmission() {
      setLoading(true);
      setLoadError(null);
      setSaveError(null);
      setMessage(null);

      const { data, error } = await supabase
        .from('emissions')
        .select('*')
        .eq('id', emissionId)
        .maybeSingle<EmissionRow>();

      if (error) {
        console.error('Error loading emission row', error);
        if (
          typeof error.message === 'string' &&
          error.message.toLowerCase().includes('row level security')
        ) {
          setLoadError(
            'You do not have permission to view this record. Please check you are signed in with the correct account.'
          );
        } else {
          setLoadError('Could not load this emission record.');
        }
        setLoading(false);
        return;
      }

      if (!data) {
        setLoadError('Emission record not found.');
        setLoading(false);
        return;
      }

      setMonthLabel(data.month ?? '');

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
      setRefrigerantCode(data.refrigerant_code || 'GENERIC_HFC');

      setLoading(false);
    }

    if (emissionId) {
      fetchEmission();
    }
  }, [emissionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setMessage(null);

    const elec = Number(electricityKwh) || 0;
    const diesel = Number(dieselLitres) || 0;
    const petrol = Number(petrolLitres) || 0;
    const gas = Number(gasKwh) || 0;
    const ref = Number(refrigerantKg) || 0;
    const refCode = refrigerantCode || 'GENERIC_HFC';

    const hasAnyActivity =
      elec !== 0 || diesel !== 0 || petrol !== 0 || gas !== 0 || ref !== 0;

    if (!hasAnyActivity) {
      setSaveError('Enter at least one non-zero value.');
      setSaving(false);
      return;
    }

    // Combined fuel_liters for backwards compatibility
    const legacyFuelLitres = diesel + petrol;

    // Recalculate total CO2e (UK logic)
    const elecCo2 = elec * EF_GRID_ELECTRICITY_KG_PER_KWH;
    const fuelCo2 = calcFuelCo2eKg({
      dieselLitres: diesel,
      petrolLitres: petrol,
      gasKwh: gas,
    });
    const refCo2 = calcRefrigerantCo2e(ref, refCode);
    const totalCo2e = elecCo2 + fuelCo2 + refCo2;

    try {
      const { error: updateError } = await supabase
        .from('emissions')
        .update({
          electricity_kw: elec,
          diesel_litres: diesel,
          petrol_litres: petrol,
          gas_kwh: gas,
          fuel_liters: legacyFuelLitres,
          refrigerant_kg: ref,
          refrigerant_code: refCode,
          total_co2e: totalCo2e,
          // ⚠️ Do NOT touch user_id – RLS + defaults handle ownership.
        })
        .eq('id', emissionId);

      if (updateError) {
        console.error('Error updating emission', updateError);
        if (
          typeof updateError.message === 'string' &&
          updateError.message.toLowerCase().includes('row level security')
        ) {
          throw new Error(
            'You do not have permission to update this record. Please check you are signed in with the correct account.'
          );
        }
        throw new Error('Could not update this emission record.');
      }

      setMessage('Emission record updated successfully.');
      // Optional: push back to history list after short delay
      setTimeout(() => {
        router.push('/dashboard/emissions/view-emissions');
      }, 800);
    } catch (err: any) {
      setSaveError(err?.message || 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        {/* Header */}
        <section className="rounded-xl bg-white border p-6 shadow flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Emissions
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              Edit monthly emissions
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Adjust the values for this month. We’ll recalculate the CO₂e
              footprint using your latest inputs.
            </p>
            {monthLabel && (
              <p className="mt-2 text-xs text-slate-500">
                Editing:{' '}
                <span className="font-medium text-slate-900">{monthLabel}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <Link
              href="/dashboard/emissions/view-emissions"
              className="h-[32px] px-4 rounded-full border text-xs font-medium bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center"
            >
              View emissions history
            </Link>
            <Link
              href="/dashboard"
              className="h-[32px] px-4 rounded-full border text-xs font-medium bg-slate-900 text-white border-slate-900 hover:bg-slate-800 flex items-center justify-center"
            >
              ← Back to dashboard
            </Link>
          </div>
        </section>

        {/* Content */}
        <section className="rounded-xl bg-white border p-6 shadow">
          {loading ? (
            <p className="text-xs text-slate-500">Loading emission data…</p>
          ) : loadError ? (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {loadError}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Month (read-only) */}
              {monthLabel && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Reporting month
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {monthLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Month is fixed for this record. To move data to another
                    month, create a new entry and delete this one from history.
                  </p>
                </div>
              )}

              {/* Activity inputs */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* LEFT: Electricity + fuel */}
                <div className="space-y-4">
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
                      Diesel &amp; petrol for vehicles, plus gas used for
                      heating.
                    </p>
                  </div>
                </div>

                {/* RIGHT: Refrigerant */}
                <div className="space-y-4">
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
                      If unsure, leave as “Not sure / generic HFC” – we’ll use a
                      conservative default factor.
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {(saveError || message) && (
                <div className="text-xs">
                  {saveError && (
                    <p className="text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                      {saveError}
                    </p>
                  )}
                  {message && (
                    <p className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
                      {message}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    router.push('/dashboard/emissions/view-emissions')
                  }
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 text-xs font-medium px-4 py-2 hover:bg-slate-900 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
