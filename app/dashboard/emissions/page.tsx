'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { calcRefrigerantCo2e } from '../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { logActivity } from '../../../lib/logActivity';
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

  // ✅ Scope 3 edit support
  const edit = searchParams.get('edit');
  const editingId = searchParams.get('id');
  const isEditMode = edit === 'scope3' && Boolean(editingId);

  const today = new Date();
  const currentYear = today.getFullYear();

  const [monthName, setMonthName] = useState<string>(MONTHS[today.getMonth()]);
  const [year, setYear] = useState<number>(currentYear);

  const [electricityKwh, setElectricityKwh] = useState<string>('');
  const [dieselLitres, setDieselLitres] = useState<string>('');
  const [petrolLitres, setPetrolLitres] = useState<string>('');
  const [gasKwh, setGasKwh] = useState<string>('');
  const [refrigerantKg, setRefrigerantKg] = useState<string>('');
  const [refrigerantCode, setRefrigerantCode] =
    useState<string>('GENERIC_HFC');

  // --------------------------------
  // Bill scan state
  // --------------------------------
  const [scanMode, setScanMode] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billDocType, setBillDocType] = useState<'electricity' | 'diesel' | 'petrol' | 'gas' | 'refrigerant'>('electricity');
  const [billScanning, setBillScanning] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [billSuggestion, setBillSuggestion] = useState<null | {
    month: string;
    electricity_kwh: number;
    fuel_litres: number;
    gas_kwh: number;
    refrigerant_kg: number;
    refrigerant_type: string;
  }>(null);

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
// --------------------------------
// Load existing Scope 3 row when editing
// --------------------------------
useEffect(() => {
  if (!isEditMode || !editingId) return;

  supabase
    .from('scope3_activities')
    .select('*')
    .eq('id', editingId)
    .single()
    .then(({ data }) => {
      if (!data) return;

      const parsed = parseMonthLabel(data.month as string | null);
      setMonthName(parsed.monthName);
      setYear(parsed.year);

      setScope3Enabled(true);
      setScope3Category(data.category ?? DEFAULT_SCOPE3);
      setScope3Label(data.label ?? '');
      setScope3ActivityValue(
        data.data?.activity_value != null ? String(data.data.activity_value) : ''
      );
    });
}, [isEditMode, editingId]); // ✅ correct


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
  // BILL SCAN
  // -------------------------------------------
  async function handleBillScan() {
    if (!billFile) return;
    setBillScanning(true);
    setBillError(null);
    setBillSuggestion(null);
    const fd = new FormData();
    fd.append('file', billFile);
    fd.append('docType', billDocType);
    fd.append('monthHint', buildMonthLabel(monthName, year));
    const res = await fetch('/api/parse-invoice', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok || !json.suggestion) {
      setBillError(json.error ?? 'Could not read bill. Try a clearer image.');
    } else {
      setBillSuggestion(json.suggestion);
    }
    setBillScanning(false);
  }

  function applyBillSuggestion() {
    if (!billSuggestion) return;
    const parsed = parseMonthLabel(billSuggestion.month);
    setMonthName(parsed.monthName);
    setYear(parsed.year);
    if (billSuggestion.electricity_kwh > 0) setElectricityKwh(String(billSuggestion.electricity_kwh));
    if (billSuggestion.fuel_litres > 0) {
      if (billDocType === 'diesel') setDieselLitres(String(billSuggestion.fuel_litres));
      if (billDocType === 'petrol') setPetrolLitres(String(billSuggestion.fuel_litres));
    }
    if (billSuggestion.gas_kwh > 0) setGasKwh(String(billSuggestion.gas_kwh));
    if (billSuggestion.refrigerant_kg > 0) setRefrigerantKg(String(billSuggestion.refrigerant_kg));
    if (billSuggestion.refrigerant_type) setRefrigerantCode(billSuggestion.refrigerant_type);
    setScanMode(false);
    setBillSuggestion(null);
    setBillFile(null);
  }

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

    // Load country-aware factors from user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', user.id)
      .single();
    const ef = getFactorsForCountry(profile?.country ?? 'GB');

// ----------------------------------
// BLOCK SAVE IF MONTH IS LOCKED
// ----------------------------------
const { data: lock } = await supabase
  .from('report_locks')
  .select('locked')
  .eq('user_id', user.id)
  .eq('month', monthLabel)
  .maybeSingle();

if (lock?.locked) {
  setError('This month is locked. Unlock it to make changes.');
  setLoading(false);
  return;
}

    const fuelCo2 =
      diesel * ef.diesel +
      petrol * ef.petrol +
      gas * ef.gas;

    const elecCo2 = elec * ef.electricity;
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
          const updatedElectricity = isEditMode
  ? elec
  : (existing.electricity_kw ?? 0) + elec;

const updatedDiesel = isEditMode
  ? diesel
  : (existing.diesel_litres ?? 0) + diesel;

const updatedPetrol = isEditMode
  ? petrol
  : (existing.petrol_litres ?? 0) + petrol;

const updatedGas = isEditMode
  ? gas
  : (existing.gas_kwh ?? 0) + gas;

const updatedRefrigerant = isEditMode
  ? ref
  : (existing.refrigerant_kg ?? 0) + ref;

const updatedFuelCo2 =
  updatedDiesel * ef.diesel +
  updatedPetrol * ef.petrol +
  updatedGas * ef.gas;

const updatedElecCo2 = updatedElectricity * ef.electricity;

const updatedRefCo2 = calcRefrigerantCo2e(
  updatedRefrigerant,
  refCode
);

const updatedTotalCo2e =
  updatedElecCo2 + updatedFuelCo2 + updatedRefCo2;

          const { error: updateError } = await supabase
            .from('emissions')
            .update({
              electricity_kw: updatedElectricity,
diesel_litres: updatedDiesel,
petrol_litres: updatedPetrol,
gas_kwh: updatedGas,
refrigerant_kg: updatedRefrigerant,
refrigerant_code: refCode,
total_co2e: updatedTotalCo2e,

            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'emissions',
  entity_id: existing.id,
  action: 'edit',
});

// Build field-level diff for activity log (only changed fields)
const changes: Record<string, { from: number; to: number }> = {};
const oldElec = existing.electricity_kw ?? existing.electricity_kwh ?? 0;
if (oldElec !== updatedElectricity) changes.electricity_kwh = { from: oldElec, to: updatedElectricity };
if ((existing.diesel_litres ?? 0) !== updatedDiesel) changes.diesel_l = { from: existing.diesel_litres ?? 0, to: updatedDiesel };
if ((existing.petrol_litres ?? 0) !== updatedPetrol) changes.petrol_l = { from: existing.petrol_litres ?? 0, to: updatedPetrol };
if ((existing.gas_kwh ?? 0) !== updatedGas) changes.gas_kwh = { from: existing.gas_kwh ?? 0, to: updatedGas };
if ((existing.refrigerant_kg ?? 0) !== updatedRefrigerant) changes.refrigerant_kg = { from: existing.refrigerant_kg ?? 0, to: updatedRefrigerant };
const oldCo2 = existing.total_co2e ?? 0;
if (Math.abs(oldCo2 - updatedTotalCo2e) > 0.01) changes.co2e_kg = { from: oldCo2, to: updatedTotalCo2e };
if (Object.keys(changes).length > 0) {
  logActivity('update', 'emission', { month: monthLabel, changes });
}

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
              data_source: 'manual',
              ef_version: ef.version,
            });
if (insertError) throw insertError;

await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'emissions',
  entity_id: null, // insert
  action: 'add',
});
logActivity('create', 'emission', {
  month: monthLabel,
  electricity_kwh: elec || undefined,
  diesel_l: diesel || undefined,
  petrol_l: petrol || undefined,
  gas_kwh: gas || undefined,
  refrigerant_kg: ref || undefined,
  co2e_kg: totalCo2e,
});

      
          


          scope12MessagePart = `Scope 1 & 2 saved for ${monthLabel}. `;
        }
      }

      // ----------------------------------
// SCOPE 3 — INSERT OR UPDATE (FIXED)
// ----------------------------------
if (hasScope3Activity) {
  if (isEditMode && editingId) {
    const { error } = await supabase
      .from('scope3_activities')
      .update({
        category: scope3Category,
        label: scope3Label || null,
        data: {
          activity_value: parsedActivity,
          unit: activeScope3Config.unitLabel,
          factor_kg_per_unit: activeScope3Config.factorKgPerUnit,
        },
        co2e_kg: calculatedScope3Kg,
      })
      .eq('id', editingId);

    if (error) throw error;
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'scope3',
  entity_id: editingId,
  action: 'edit',
});



    scope3MessagePart = `Scope 3 updated (${calculatedScope3Kg.toFixed(
      1
    )} kg CO₂e).`;
  } else {
    const { error } = await supabase
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

    if (error) throw error;
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'scope3',
  entity_id: null, // new row
  action: 'add',
});

    scope3MessagePart = `Scope 3 activity recorded (${calculatedScope3Kg.toFixed(
      1
    )} kg CO₂e).`;
  }
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
                We store emissions as a single record per month (e.g. "
                <span className="font-medium">
                  {buildMonthLabel(monthName, year)}
                </span>
                ") and automatically combine multiple entries when you add more
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
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FORM SECTION */}
        <section className="rounded-xl bg-white border p-6 shadow">
          {/* ENTRY MODE TABS */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setScanMode(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                !scanMode
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Enter manually
            </button>
            <button
              type="button"
              onClick={() => { setScanMode(true); setBillSuggestion(null); setBillError(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                scanMode
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Scan a bill
            </button>
          </div>

          {scanMode ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-800">Scan a bill</p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload a photo or image of your bill and we&apos;ll extract the key numbers for you to review.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bill type</label>
                <select
                  value={billDocType}
                  onChange={(e) => {
                    setBillDocType(e.target.value as 'electricity' | 'diesel' | 'petrol' | 'gas' | 'refrigerant');
                    setBillSuggestion(null);
                  }}
                  className="border rounded-lg px-3 py-2 text-xs bg-white w-48"
                >
                  <option value="electricity">Electricity</option>
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="gas">Gas</option>
                  <option value="refrigerant">Refrigerant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Bill image</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <span className="text-xs text-slate-500">Click to upload image</span>
                  <span className="mt-1 text-[11px] text-slate-400">JPEG · PNG · WEBP supported (not PDF)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      setBillFile(e.target.files?.[0] ?? null);
                      setBillSuggestion(null);
                      setBillError(null);
                    }}
                  />
                </label>
                {billFile && (
                  <p className="mt-1 text-[11px] text-slate-600">{billFile.name}</p>
                )}
              </div>

              <button
                type="button"
                disabled={!billFile || billScanning}
                onClick={handleBillScan}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-50"
              >
                {billScanning ? 'Reading your bill…' : 'Extract from bill →'}
              </button>

              {billError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {billError}
                </p>
              )}

              {billSuggestion && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">Extracted values — please review</p>
                  <div className="text-xs text-slate-700 space-y-1">
                    <p>Detected period: <span className="font-medium">{billSuggestion.month}</span></p>
                    {billSuggestion.electricity_kwh > 0 && (
                      <p>Electricity: <span className="font-medium">{billSuggestion.electricity_kwh.toLocaleString()} kWh</span></p>
                    )}
                    {billSuggestion.fuel_litres > 0 && (
                      <p>{billDocType === 'diesel' ? 'Diesel' : 'Petrol'}: <span className="font-medium">{billSuggestion.fuel_litres.toLocaleString()} L</span></p>
                    )}
                    {billSuggestion.gas_kwh > 0 && (
                      <p>Gas: <span className="font-medium">{billSuggestion.gas_kwh.toLocaleString()} kWh</span></p>
                    )}
                    {billSuggestion.refrigerant_kg > 0 && (
                      <p>Refrigerant: <span className="font-medium">{billSuggestion.refrigerant_kg} kg</span> ({billSuggestion.refrigerant_type})</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={applyBillSuggestion}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-medium px-4 py-1.5 hover:bg-emerald-800"
                  >
                    Apply to form →
                  </button>
                </div>
              )}
            </div>
          ) : (
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
                    If unsure, leave as "Not sure / generic HFC".
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
          )}
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