import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';

// Required to avoid static rendering errors in Vercel
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Get logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('Auth error:', userError);
      return new NextResponse('Auth error', { status: 401 });
    }

    if (!user) {
      return new NextResponse('Not authenticated', { status: 401 });
    }

    // Fetch emissions for this user
    const { data, error } = await supabase
      .from('emissions')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return new NextResponse('Failed loading emissions', { status: 500 });
    }

    // Build Excel file
    // Suggestion/Improvement: Add some formatting, even if basic, to make it worth downloading an .xlsx instead of a .csv file
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Emissions');

    sheet.addRow([
      'Month',
      'Electricity (kWh)',
      'Fuel (L)',
      'Refrigerant (kg)',
      'Total CO₂e (kg)',
    ]);

    data.forEach((r: any) => {
      sheet.addRow([
        r.month,
        r.electricity_kw ?? 0,
        r.fuel_liters ?? 0,
        r.refrigerant_kg ?? 0,
        r.total_co2e ?? 0,
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=emissions.xlsx',
      },
    });
  } catch (err: any) {
    console.error('XLS export failed:', err);
    return new NextResponse('Unexpected error', { status: 500 });
  }
}
