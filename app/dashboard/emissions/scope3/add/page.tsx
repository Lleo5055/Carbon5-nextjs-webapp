'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import {
  Scope3Category,
  Scope3ActivityInput,
  calculateScope3Co2eKg,
} from '../../../../../lib/scope3Calculations';

const MONTH_OPTIONS = [
  { label: 'January 2025', value: '2025-01-01' },
  { label: 'February 2025', value: '2025-02-01' },
  { label: 'March 2025', value: '2025-03-01' },
  { label: 'April 2025', value: '2025-04-01' },
  { label: 'May 2025', value: '2025-05-01' },
  { label: 'June 2025', value: '2025-06-01' },
  { label: 'July 2025', value: '2025-07-01' },
  { label: 'August 2025', value: '2025-08-01' },
  { label: 'September 2025', value: '2025-09-01' },
  { label: 'October 2025', value: '2025-10-01' },
  { label: 'November 2025', value: '2025-11-01' },
  { label: 'December 2025', value: '2025-12-01' },
];

const CATEGORY_LABELS: { id: Scope3Category; label: string }[] = [
  { id: 'employee_commuting', label: 'Employee commuting' },
  { id: 'business_travel', label: 'Business travel' },
  { id: 'purchased_goods', label: 'Purchased goods & services' },
  { id: 'waste', label: 'Waste generated in operations' },
  { id: 'upstream_transport', label: 'Upstream transport & distribution' },
  { id: 'downstream_transport', label: 'Downstream transport & distribution' },
];

export default function AddScope3ActivityPage() {
  const router = useRouter();

  // month
  const [month, setMonth] = useState(MONTH_OPTIONS[0]);

  // commuting fields
  const [oneWayKm, setOneWayKm] = useState<number>(0);
  const [daysPerMonth, setDaysPerMonth] = useState<number>(0);
  const [mode, setMode] = useState<'car' | 'train' | 'bus' | 'bike_walk'>(
    'car'
  );

  // core fields
  const [category, setCategory] =
    useState<Scope3Category>('employee_commuting');
  const [label, setLabel] = useState<string>('');

  // business travel
  const [flightType, setFlightType] = useState<'short_haul' | 'long_haul'>(
    'short_haul'
  );
  const [flightKm, setFlightKm] = useState<number>(0);
  const [taxiKm, setTaxiKm] = useState<number>(0);
  const [trainKm, setTrainKm] = useState<number>(0);

  // shared inputs
  const [number1, setNumber1] = useState<string>('');
  const [number2, setNumber2] = useState<string>('');
  const [number3, setNumber3] = useState<string>('');
  const [method, setMethod] = useState<string>('');
  const [wasteType, setWasteType] = useState<
    'mixed_recycling' | 'general_landfill' | 'food'
  >('general_landfill');

  // status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // ------------------- BUILD INPUT (FIXED) -------------------

  function buildInput(): Scope3ActivityInput | null {
    const base = {
      month: month.value, // ✅ ALWAYS string
      label: label || undefined,
    };

    switch (category) {
      case 'employee_commuting':
        return {
          category,
          ...base,
          mode,
          oneWayKm: Number(number1) || 0,
          daysPerMonth: Number(number2) || 0,
        };

      case 'business_travel':
        return {
          category,
          ...base,
          flightType,
          flightKm: Number(number1) || 0,
          taxiKm: Number(number2) || 0,
          trainKm: Number(number3) || 0,
        };

      case 'purchased_goods':
        return {
          category,
          ...base,
          spendGbp: Number(number1) || 0,
        };

      case 'waste':
        return {
          category,
          ...base,
          wasteType,
          weightKg: Number(number1) || 0,
        };

      case 'upstream_transport':
      case 'downstream_transport':
        return {
          category,
          ...base,
          mode: method as 'road' | 'sea' | 'air',
          weightKg: Number(number1) || 0,
          distanceKm: Number(number2) || 0,
        };

      default:
        return null;
    }
  }

  // ------------------- SUBMIT HANDLER -------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    const input = buildInput();
    if (!input) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    const co2e = calculateScope3Co2eKg(input);
    if (!co2e || co2e <= 0) {
      setErrorMsg('CO₂e result is zero – add some activity values.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('You must be signed in to add activities.');

      const { error } = await supabase.from('scope3_activities').insert({
        user_id: user.id,
        month: input.month,
        category: input.category,
        label: input.label ?? null,
        data: input,
        co2e_kg: co2e,
      });

      if (error) throw error;

      setSuccessMsg(`Scope 3 activity saved (${co2e.toFixed(2)} kg CO₂e).`);

      setTimeout(() => {
        router.push('/dashboard/emissions/view-emissions');
      }, 900);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ------------------- CATEGORY FIELDS -------------------

  function renderCategoryFields() {
    switch (category) {
      case 'employee_commuting':
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Transport mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="car">Car</option>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="bike_walk">Bike / walk</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  One-way distance (km)
                </label>
                <input
                  type="number"
                  value={number1}
                  onChange={(e) => setNumber1(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Days per month
                </label>
                <input
                  type="number"
                  value={number2}
                  onChange={(e) => setNumber2(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>
          </>
        );

      case 'business_travel':
        return (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Flight type
                </label>
                <select
                  value={flightType}
                  onChange={(e) =>
                    setFlightType(e.target.value as 'short_haul' | 'long_haul')
                  }
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="short_haul">Short-haul</option>
                  <option value="long_haul">Long-haul</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Flight distance (km)
                </label>
                <input
                  type="number"
                  value={number1}
                  onChange={(e) => setNumber1(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Taxi / ride-hail (km)
                </label>
                <input
                  type="number"
                  value={number2}
                  onChange={(e) => setNumber2(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Train (km)
                </label>
                <input
                  type="number"
                  value={number3}
                  onChange={(e) => setNumber3(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>
          </>
        );

      case 'purchased_goods':
        return (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Spend (£)
            </label>
            <input
              type="number"
              value={number1}
              onChange={(e) => setNumber1(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
            />
          </div>
        );

      case 'waste':
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Waste type
              </label>
              <select
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="general_landfill">General landfill</option>
                <option value="mixed_recycling">Mixed recycling</option>
                <option value="food">Food waste</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                value={number1}
                onChange={(e) => setNumber1(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              />
            </div>
          </>
        );

      case 'upstream_transport':
      case 'downstream_transport':
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Transport method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="road">Road</option>
                <option value="sea">Sea</option>
                <option value="air">Air</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={number1}
                  onChange={(e) => setNumber1(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  value={number2}
                  onChange={(e) => setNumber2(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  // ------------------- RENDER -------------------

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        {/* Header */}
        <section className="rounded-xl bg-white border p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">
            Add Scope 3 Activity
          </h1>
        </section>

        {/* Form */}
        <section className="rounded-xl bg-white border p-6 shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Month + category */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reporting month
                </label>
                <select
                  value={month.value}
                  onChange={(e) =>
                    setMonth(
                      MONTH_OPTIONS.find((m) => m.value === e.target.value)!
                    )
                  }
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as Scope3Category);
                    setNumber1('');
                    setNumber2('');
                    setNumber3('');
                    setMethod('');
                    setFlightType('short_haul');
                    resetMessages();
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                >
                  {CATEGORY_LABELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional label */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              />
            </div>

            {/* Category-specific */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
              {renderCategoryFields()}
            </div>

            {/* Messages */}
            {errorMsg && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {successMsg}
              </p>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push('/dashboard/emissions/view-emissions')
                }
                className="rounded-full border border-slate-300 bg-white text-slate-700 text-xs font-medium px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save Scope 3 activity'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
