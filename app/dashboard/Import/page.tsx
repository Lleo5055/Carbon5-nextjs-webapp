// app/dashboard/import/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import {
  normaliseRefrigerantCode,
} from '../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { calculateCo2e } from '../../../lib/calcCo2e';

type ParsedSuggestion = {
  docType: 'electricity' | 'fuel';
  month: string;
  electricity_kwh: number;
  fuel_liters: number;
  refrigerant_kg: number;
  refrigerant_type: string;
  note?: string;
};

export default function ImportInvoicesPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'electricity' | 'fuel'>('electricity');
  const [month, setMonth] = useState('');
  const [electricity, setElectricity] = useState('');
  const [fuel, setFuel] = useState('');
  const [refrigerant, setRefrigerant] = useState('');
  const [refrigerantType, setRefrigerantType] = useState('GENERIC_HFC');

  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
  };

  const handleParse = async () => {
    if (!file) {
      setError('Please upload a PDF or image first.');
      return;
    }

    setError(null);
    setParsing(true);
    setParseNote(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      formData.append('monthHint', month);

      const res = await fetch('/api/parse-invoice', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Parse API returned an error');
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to parse invoice');
      }

      const suggestion = json.suggestion as ParsedSuggestion;

      setMonth(suggestion.month || month);
      setElectricity(
        suggestion.electricity_kwh ? String(suggestion.electricity_kwh) : ''
      );
      setFuel(suggestion.fuel_liters ? String(suggestion.fuel_liters) : '');
      setRefrigerant(
        suggestion.refrigerant_kg ? String(suggestion.refrigerant_kg) : ''
      );
      setRefrigerantType(suggestion.refrigerant_type || 'GENERIC_HFC');
      setParseNote(
        suggestion.note ||
          'Values parsed. Please review and adjust before saving.'
      );
    } catch (err) {
      console.error(err);
      setError(
        'Could not parse this invoice automatically. Please enter the values manually.'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        setError('You are not logged in.');
        setSaving(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .single();

      const countryCode = profile?.country ?? 'GB';
      const ef = getFactorsForCountry(countryCode);

      const electricityNum = Number(electricity) || 0;
      const fuelNum        = Number(fuel)         || 0;
      const refrigerantNum = Number(refrigerant)  || 0;
      const refCode        = normaliseRefrigerantCode(refrigerantType);

      // Use existing engine for consistency
      const result = calculateCo2e(
        {
          electricityKwh:  electricityNum,
          dieselLitres:    fuelNum,
          refrigerantType: refCode,
          refrigerantKg:   refrigerantNum,
        },
        ef
      );

      // Full auditable breakdown for CCTS
      const calc_breakdown = {
        electricity: {
          qty:     electricityNum,
          unit:    'kWh',
          factor:  ef.electricity,
          kg_co2e: result.electricity,
        },
        diesel: {
          qty:     fuelNum,
          unit:    'litres',
          factor:  ef.diesel,
          kg_co2e: result.diesel,
        },
        refrigerant: {
          qty:     refrigerantNum,
          unit:    'kg',
          type:    refCode,
          factor:  ef.refrigerants[refCode] ?? 0,
          kg_co2e: result.refrigerant,
        },
        total_kg_co2e:  result.total,
        country_code:   countryCode,
        factor_version: ef.version,
        calculated_at:  new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('emissions').insert([{
        user_id:          user.id,
        month,
        electricity_kw:   electricityNum,
        diesel_litres:    fuelNum,
        refrigerant_kg:   refrigerantNum,
        refrigerant_code: refCode,
        total_co2e:       result.total,
        country_code:     countryCode,
        data_source:      'bill_scan',
        ef_version:       ef.version,
        ef_electricity:   ef.electricity,
        ef_diesel:        ef.diesel,
        ef_refrigerant:   ef.refrigerants[refCode] ?? null,
        calc_breakdown,
      }]);

      if (insertError) {
        console.error(insertError);
        setError('Error saving emissions record.');
        setSaving(false);
        return;
      }

      // Fire refrigerant watch check (non-blocking)
      fetch('/api/refrigerant-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => {});

      router.push('/dashboard/view-emissions');
    } catch (err) {
      console.error(err);
      setError('Unexpected error while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-start justify-center p-6">
      <div className="max-w-2xl w-full bg-white shadow-md rounded-xl p-8 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          ← Dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Import invoices & receipts
          </h1>
          <p className="text-sm text-slate-600">
            Upload DEWA / ADDC bills or fuel receipts. The AI parser (stubbed in
            this environment) will pre-fill your emissions data – always review
            values before saving.
          </p>
        </div>

        {/* 1. Upload & classify */}
        <section className="space-y-4 border border-slate-200 rounded-lg p-4 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">
            1. Upload document
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Document type
              </label>
              <select
                value={docType}
                onChange={(e) =>
                  setDocType(e.target.value as 'electricity' | 'fuel')
                }
                className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm w-full sm:w-64"
              >
                <option value="electricity">
                  Electricity bill (DEWA / ADDC)
                </option>
                <option value="fuel">Fuel receipt (petrol / diesel)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Billing month (if known)
              </label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="e.g. January 2025"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Invoice or receipt file
              </label>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                className="block text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                PDF or clear image (JPG/PNG). Max 10MB recommended.
              </p>
            </div>

            <button
              type="button"
              onClick={handleParse}
              disabled={!file || parsing}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {parsing ? 'Parsing…' : 'Run AI parser (stub)'}
            </button>

            {parseNote && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {parseNote}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>
        </section>

        {/* 2. Review + save as emissions */}
        <section className="space-y-4 border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            2. Review extracted data
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Month
                </label>
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="e.g. January 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Electricity (kWh)
                </label>
                <input
                  type="number"
                  value={electricity}
                  onChange={(e) => setElectricity(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="Total kWh on bill"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fuel (litres)
                </label>
                <input
                  type="number"
                  value={fuel}
                  onChange={(e) => setFuel(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="Litres of petrol / diesel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Refrigerant leakage (kg)
                </label>
                <input
                  type="number"
                  value={refrigerant}
                  onChange={(e) => setRefrigerant(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="Leakage in kg (if any)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Refrigerant type
                </label>
                <select
                  value={refrigerantType}
                  onChange={(e) => setRefrigerantType(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full bg-white"
                >
                  <option value="R410A">R410A (split AC – common)</option>
                  <option value="R134a">
                    R134a (chillers / older systems)
                  </option>
                  <option value="R407C">R407C (comfort cooling)</option>
                  <option value="R404A">
                    R404A (cold rooms / refrigeration)
                  </option>
                  <option value="GENERIC_HFC">
                    Generic HFC (not specified)
                  </option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save as emissions record'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}