import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import {
  EF_GRID_ELECTRICITY_KG_PER_KWH,
  EF_DIESEL_KG_PER_LITRE,
  EF_PETROL_KG_PER_LITRE,
  EF_NATURAL_GAS_KG_PER_KWH,
  calcRefrigerantCo2e,
} from '../../../lib/emissionFactors';

export const runtime = 'nodejs';

// --------------------------------------------------
// SERVER-SIDE SUPABASE CLIENT (SAFE FOR API ROUTES)
// --------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --------------------------------------------------
// TYPES
// --------------------------------------------------
type EmissionRow = {
  id: string | number;
  month: string;
  electricity_kw: number;
  diesel_litres: number;
  petrol_litres: number;
  gas_kwh: number;
  refrigerant_kg: number;
  refrigerant_code?: string | null;
  total_co2e: number;
};

function parseISO(m: string | null): Date | null {
  if (!m) return null;
  const d = new Date(m);
  return isNaN(d.getTime()) ? null : d;
}

// --------------------------------------------------
// LOAD SCOPE 1 & 2
// --------------------------------------------------
async function loadScope12(periodType, period, start, end) {
  const { data, error } = await supabase
    .from('emissions')
    .select('*')
    .order('month', { ascending: true });

  if (error || !data) return [];

  let rows: EmissionRow[] = Array.isArray(data) ? (data as any) : [];

  if (periodType === 'custom' && start && end) {
    rows = rows.filter((r) => r.month && r.month >= start && r.month <= end);
  }

  if (periodType === 'quick') {
    const backMap = { '1m': 1, '3m': 3, '6m': 6, '12m': 12, all: 999 };
    const back = backMap[period] ?? 999;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - back);

    rows = rows.filter((r) => {
      const d = parseISO(r.month);
      return d && d >= cutoff;
    });
  }

  rows.sort((a, b) => {
    const da = parseISO(a.month);
    const db = parseISO(b.month);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  return rows;
}

// --------------------------------------------------
// LOAD SCOPE 3
// --------------------------------------------------
async function loadScope3(allMonths: string[]) {
  const { data } = await supabase
    .from('scope3_activities')
    .select('*')
    .order('month', { ascending: true });

  if (!data) return [];

  return (data as any[]).filter((r) => r.month && allMonths.includes(r.month));
}

// --------------------------------------------------
// SPARKLINE DRAW
// --------------------------------------------------
function drawSparkline(page, { values, x, y, width, height }) {
  if (!values || values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = width / (values.length - 1);

  const pts = values.map((v, i) => {
    const px = x + i * step;
    const py = y + height - ((v - min) / (max - min || 1)) * height;
    return { x: px, y: py };
  });

  for (let i = 0; i < pts.length - 1; i++) {
    page.drawLine({
      start: pts[i],
      end: pts[i + 1],
      thickness: 1.2,
      color: rgb(0.1, 0.3, 0.6),
    });
  }

  const last = pts[pts.length - 1];
  page.drawCircle({
    x: last.x,
    y: last.y,
    size: 2.8,
    color: rgb(0.1, 0.1, 0.1),
  });
}

// --------------------------------------------------
// PDF HANDLER
// --------------------------------------------------
async function handleReport(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodType = url.searchParams.get('periodType') ?? 'quick';
    const period = url.searchParams.get('period') ?? 'all';
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    const rows = await loadScope12(periodType, period, start, end);

    const allMonthsISO = rows.map((r) => r.month);
    const scope3 = await loadScope3(allMonthsISO);

    const monthMap = new Map<string, number>();
    rows.forEach((r) => monthMap.set(r.month, r.total_co2e));

    scope3.forEach((s) =>
      monthMap.set(s.month, (monthMap.get(s.month) ?? 0) + (s.co2e_kg ?? 0))
    );

    const merged = rows.map((r) => ({
      month: r.month,
      electricity: r.electricity_kw ?? 0,
      diesel: r.diesel_litres ?? 0,
      petrol: r.petrol_litres ?? 0,
      gas: r.gas_kwh ?? 0,
      refrigerant: r.refrigerant_kg ?? 0,
      total: monthMap.get(r.month) ?? 0,
    }));

    // ----- PDF -----
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 800;

    page.drawText('Carbon Footprint Assessment Report', {
      x: 40,
      y,
      size: 20,
      font: bold,
    });

    y -= 40;

    page.drawText(`Reporting period: ${period}`, {
      x: 40,
      y,
      size: 11,
      font,
    });

    y -= 20;

    const totalSum = merged.reduce((s, r) => s + r.total, 0);
    page.drawText(
      `Total emissions this period: ${(totalSum / 1000).toFixed(2)} tCO₂e`,
      { x: 40, y, size: 12, font: bold }
    );

    y -= 40;

    const vals = merged.map((m) => Number(m.total || 0));
    drawSparkline(page, {
      values: vals,
      x: 40,
      y: y - 30,
      width: 500,
      height: 40,
    });

    y -= 90;

    page.drawText('Emissions by month', { x: 40, y, size: 14, font: bold });
    y -= 20;

    page.drawText('Month', { x: 40, y, size: 10, font: bold });
    page.drawText('Elec', { x: 150, y, size: 10, font: bold });
    page.drawText('Diesel', { x: 210, y, size: 10, font: bold });
    page.drawText('Petrol', { x: 270, y, size: 10, font: bold });
    page.drawText('Gas', { x: 330, y, size: 10, font: bold });
    page.drawText('CO₂e', { x: 420, y, size: 10, font: bold });

    y -= 16;

    for (const r of merged) {
      page.drawText(r.month, { x: 40, y, size: 10, font });
      page.drawText(String(r.electricity), { x: 150, y, size: 10, font });
      page.drawText(String(r.diesel), { x: 210, y, size: 10, font });
      page.drawText(String(r.petrol), { x: 270, y, size: 10, font });
      page.drawText(String(r.gas), { x: 330, y, size: 10, font });
      page.drawText(r.total.toFixed(2), { x: 420, y, size: 10, font });
      y -= 16;
      if (y < 60) break;
    }

    return new NextResponse(await pdf.save(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=carbon-report.pdf',
      },
    });
  } catch (err: any) {
    console.error('PDF ERROR:', err);

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    page.drawText('Error generating PDF report.', {
      x: 40,
      y: 780,
      size: 14,
      font,
    });

    page.drawText(String(err?.message || err), {
      x: 40,
      y: 760,
      size: 10,
      font,
    });

    return new NextResponse(await pdf.save(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=carbon-report-error.pdf',
      },
    });
  }
}

export async function GET(req: NextRequest) {
  return handleReport(req);
}

export async function POST(req: NextRequest) {
  return handleReport(req);
}
