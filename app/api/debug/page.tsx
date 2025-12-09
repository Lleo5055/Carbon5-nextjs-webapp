// app/emissions/debug/page.tsx
import { getAllEmissions } from '@/lib/emissions';

export const dynamic = 'force-dynamic';

export default async function DebugEmissionsPage() {
  let emissions: any[] = [];
  let loadError: Error | null = null;

  try {
    emissions = await getAllEmissions();
  } catch (err: any) {
    loadError = err;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Supabase Emissions Debug</h1>

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load emissions: {loadError.message}
        </div>
      )}

      {!loadError && emissions.length === 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          No emission data yet. Try adding one from your forms or directly in
          Supabase.
        </div>
      )}

      {emissions.length > 0 && (
        <>
          <div className="text-sm text-gray-600">
            Loaded <strong>{emissions.length}</strong> rows from Supabase.
          </div>

          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">CO₂e (kg)</th>
                </tr>
              </thead>
              <tbody>
                {emissions.map((row: any) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {row.id}
                    </td>
                    <td className="px-3 py-2">
                      {row.date || row.activity_date || row.created_at || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.category || row.activity_type || '—'}
                    </td>
                    <td className="px-3 py-2">{row.scope || '—'}</td>
                    <td className="px-3 py-2">
                      {row.amount ?? row.quantity ?? '—'}
                    </td>
                    <td className="px-3 py-2">{row.unit || '—'}</td>
                    <td className="px-3 py-2">
                      {row.co2e_kg ?? row.co2e ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold">
              Raw Supabase data (debug)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">
              {JSON.stringify(emissions, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
