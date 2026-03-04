// app/api/export/xls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Client POSTs pre-fetched emissions rows (same pattern as /api/snapshot).
// Plan gating is enforced client-side; this route just builds the file.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Emissions');

    // Header row
    sheet.addRow([
      'Month',
      'Electricity (kWh)',
      'Diesel (L)',
      'Petrol (L)',
      'Gas (kWh)',
      'Refrigerant (kg)',
      'Total CO₂e (kg)',
    ]);

    rows.forEach((r: any) => {
      sheet.addRow([
        r.month ?? '',
        r.electricity_kw ?? 0,
        r.diesel_litres ?? 0,
        r.petrol_litres ?? 0,
        r.gas_kwh ?? 0,
        r.refrigerant_kg ?? 0,
        Number(r.total_co2e ?? 0).toFixed(2),
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="emissions-export.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('XLS export failed:', err);
    return new NextResponse('Unexpected error', { status: 500 });
  }
}
