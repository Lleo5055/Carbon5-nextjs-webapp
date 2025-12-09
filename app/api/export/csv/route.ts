import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // ✅ Use the original working Supabase client (anon key)
    // This will include the apikey & authorization automatically.

    // 🔒 Check user plan (Growth/Pro/Enterprise only)
    const { data: planRow, error: planError } = await supabase
      .from('user_plans')
      .select('plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) {
      console.error('CSV export: error loading user plan', planError);
    }

    if (!planRow || planRow.plan === 'free') {
      return new NextResponse(
        'CSV export is only available on Growth, Pro or Enterprise plans.',
        {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }
      );
    }

    // Optional period filter
    const url = new URL(req.url);
    const period = url.searchParams.get('period') ?? 'all';
    void period;

    // Load emissions data
    const { data, error } = await supabase
      .from('emissions')
      .select(
        'month,electricity_kw,diesel_litres,petrol_litres,gas_kwh,refrigerant_kg,total_co2e'
      )
      .order('month', { ascending: true });

    if (error) {
      console.error('CSV export: error loading emissions', error);
      return new NextResponse('Failed to load emissions', { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // Build CSV header
    const header = [
      'Month',
      'Electricity_kWh',
      'Diesel_L',
      'Petrol_L',
      'Gas_kWh',
      'Refrigerant_kg',
      'Total_CO2e_kg',
    ];

    // Build lines
    const lines = rows.map((row) => {
      return [
        String(row.month ?? ''),
        String(row.electricity_kw ?? 0),
        String(row.diesel_litres ?? 0),
        String(row.petrol_litres ?? 0),
        String(row.gas_kwh ?? 0),
        String(row.refrigerant_kg ?? 0),
        Number(row.total_co2e ?? 0).toFixed(2),
      ].join(',');
    });

    const csv = [header.join(','), ...lines].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="emissions-export.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('CSV export: unexpected error', err);
    return new NextResponse('Failed to generate CSV', { status: 500 });
  }
}
