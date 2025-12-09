'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type UploadState = 'idle' | 'parsing' | 'uploading' | 'done' | 'error';

export default function ImportInvoices() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [insertedCount, setInsertedCount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview([]);
    setMessage(null);
    setError(null);
    setInsertedCount(null);
    setStatus('idle');
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please choose a CSV file first.');
      return;
    }

    setStatus('parsing');
    setError(null);
    setMessage(null);

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error('CSV has no data rows.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const monthIdx = headers.indexOf('month');
      const elecIdx = headers.indexOf('electricity_kwh');
      const fuelIdx = headers.indexOf('fuel_liters');
      const refIdx = headers.indexOf('refrigerant_kg');

      if (monthIdx === -1 || elecIdx === -1) {
        throw new Error(
          'CSV must include at least "month" and "electricity_kwh" columns.'
        );
      }

      const rows: {
        month: string;
        electricity_kw: number;
        fuel_liters: number;
        refrigerant_kg: number;
        total_co2e: number;
      }[] = [];

      const previewRows: string[][] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (!cols[monthIdx]) continue;

        const month = cols[monthIdx];
        const electricity_kw = Number(cols[elecIdx]) || 0;
        const fuel_liters =
          fuelIdx >= 0 && cols[fuelIdx] ? Number(cols[fuelIdx]) || 0 : 0;
        const refrigerant_kg =
          refIdx >= 0 && cols[refIdx] ? Number(cols[refIdx]) || 0 : 0;

        const total_co2e =
          electricity_kw * 0.4 + fuel_liters * 2.3 + refrigerant_kg * 1300;

        rows.push({
          month,
          electricity_kw,
          fuel_liters,
          refrigerant_kg,
          total_co2e,
        });

        if (previewRows.length < 5) {
          previewRows.push([
            month,
            electricity_kw.toString(),
            fuel_liters.toString(),
            refrigerant_kg.toString(),
            total_co2e.toFixed(1),
          ]);
        }
      }

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV.');
      }

      setPreview(previewRows);
      setStatus('uploading');

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        throw new Error('You are not logged in.');
      }

      const recordsWithUser = rows.map((r) => ({
        ...r,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from('emissions')
        .insert(recordsWithUser);

      if (insertError) {
        console.error(insertError);
        throw new Error('Failed to save imported emissions.');
      }

      setInsertedCount(recordsWithUser.length);
      setMessage(
        `Imported ${recordsWithUser.length} rows successfully. You can now review them in your emissions report.`
      );
      setStatus('done');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Something went wrong while importing.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-5">
        <p className="font-semibold text-slate-900 mb-1">
          Import from invoices (CSV)
        </p>
        <p className="text-sm text-slate-600 mb-3">
          Upload a CSV with columns:{' '}
          <code className="text-xs bg-slate-200 px-1 rounded">
            month,electricity_kwh,fuel_liters,refrigerant_kg
          </code>
          . We&apos;ll convert it into monthly emissions using the same emission
          factors as manual entry.
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
        />

        <button
          type="button"
          onClick={handleImport}
          disabled={status === 'parsing' || status === 'uploading'}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {status === 'parsing'
            ? 'Reading file…'
            : status === 'uploading'
            ? 'Importing…'
            : 'Import invoices'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      </div>

      {preview.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="font-semibold text-slate-900 mb-2">
            Preview (first {preview.length} rows)
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-4">Month</th>
                  <th className="py-1 pr-4">Electricity (kWh)</th>
                  <th className="py-1 pr-4">Fuel (L)</th>
                  <th className="py-1 pr-4">Refrigerant (kg)</th>
                  <th className="py-1 pr-4">Total CO₂e (kg)</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    {row.map((cell, i) => (
                      <td key={i} className="py-1 pr-4 text-slate-800">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {insertedCount !== null && (
            <p className="mt-2 text-xs text-slate-500">
              Imported {insertedCount} rows into your emissions history.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
