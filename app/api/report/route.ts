import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';
import { getCurrencyConfig } from '@/lib/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  }
);


// ---------- HELPERS ----------
function safe(v: any) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

import type { PDFPage, PDFFont, RGB } from 'pdf-lib';

function drawText(
  page: PDFPage,
  str: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB = rgb(0, 0, 0)
) {
  page.drawText(str, { x, y, size, font, color });
}

function paragraphText(
  page: PDFPage,
  font: PDFFont,
  TEXT: RGB,
  textStr: string,
  yRef: { value: number }
) {
  const maxWidth = 480;
  const fontSize = 11;

  const words = textStr.split(' ');
  let line = '';

  for (let w of words) {
    const test = line + w + ' ';
    const width = font.widthOfTextAtSize(test, fontSize);

    if (width > maxWidth) {
      page.drawText(line.trim(), {
        x: 50,
        y: yRef.value,
        size: fontSize,
        font,
        color: TEXT,
      });
      yRef.value -= 15;
      line = w + ' ';
    } else {
      line = test;
    }
  }

  if (line.trim() !== '') {
    page.drawText(line.trim(), {
      x: 50,
      y: yRef.value,
      size: fontSize,
      font,
      color: TEXT,
    });
    yRef.value -= 15;
  }

  yRef.value -= 12;
}


  export async function GET(req: NextRequest) {
  console.log('REPORT URL:', req.url);

  try {
    // ======================== LOAD USER ID (REQUIRED) ========================
const { searchParams } = new URL(req.url);

const userId = searchParams.get('userId');
const periodType = searchParams.get('periodType'); // 'quick' | 'custom'
const period = searchParams.get('period');         // '3M' | '6M' | '12M' | 'All'

let startMonth = searchParams.get('start');
let endMonth = searchParams.get('end');
// Handle quick periods (3M / 6M / 12M)
if (periodType === 'quick' && period && period !== 'All' && !startMonth && !endMonth) {
  const months = Number(period.replace('M', ''));

  if (!isNaN(months)) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(end);
    start.setMonth(start.getMonth() - (months - 1));

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    startMonth = fmt(start);
    endMonth = fmt(end);
  }
}




if (!userId) {
  return new NextResponse('Missing userId', { status: 400 });
}


// ======================== LOAD DATA (USER ONLY) ========================
let emissionsQuery = supabase
  .from('emissions')
  .select('*')
  .eq('user_id', userId)
  .order('month', { ascending: true });


const { data: rows, error: emissionsError } = await emissionsQuery;                

// ======================== PERIOD FILTERING (ORIGINAL LOGIC) ========================

let filteredRows = rows ?? [];


if ((periodType === 'custom' || periodType === 'quick') && startMonth && endMonth) {

  const startDate = new Date(startMonth);
  const endDate = new Date(endMonth);


  filteredRows = filteredRows.filter(r => {
    const rowDate = new Date(r.month);
    return rowDate >= startDate && rowDate <= endDate;
  });
}




if (emissionsError) {
  console.error('Emissions load error:', emissionsError);
  return new NextResponse('Failed to load emissions', { status: 500 });
}

let scope3Query = supabase
  .from('scope3_activities')
  .select('*')
  .eq('user_id', userId)
  .order('month', { ascending: true });

;

const { data: scope3Rows, error: scope3Error } = await scope3Query;


if (scope3Error) {
  console.error('Scope3 load error:', scope3Error);
  return new NextResponse('Failed to load scope 3', { status: 500 });
}

// Keep your sorting exactly the same, but use scope3Rows instead of scope3.data
const s3 = (scope3Rows || []).sort((a, b) => {
  const da = new Date(a.month + ' 1');
  const db = new Date(b.month + ' 1');
  return da.getTime() - db.getTime();
});

const list = (filteredRows || []).sort((a, b) => {
  const da = new Date(a.month + ' 1');
  const db = new Date(b.month + ' 1');
  return da.getTime() - db.getTime();
});

// ======================== REPORTING PERIOD ========================
const reportStartMonth =
  startMonth ?? (list.length ? list[0].month : 'Not available');

const reportEndMonth =
  endMonth ?? (list.length ? list[list.length - 1].month : 'Not available');


    // ======================== LOAD USER PROFILE ========================

// ⬇️ 1. Read userId from request URL


// ⬇️ 2. Load profile explicitly using service role
let profile: any = {};

if (userId) {
  const { data: p, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Profile load error:', error);
  }

  profile = p || {};
}

// Country-aware factors
const countryCode = list[0]?.country_code ?? profile?.country ?? 'GB';
const ef = getFactorsForCountry(countryCode);

const isGB = countryCode === 'GB';
const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy',
  ES: 'Spain', NL: 'Netherlands', PL: 'Poland', SE: 'Sweden',
  BE: 'Belgium', AT: 'Austria', IE: 'Ireland', DK: 'Denmark',
  PT: 'Portugal', IN: 'India',
};
const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;
const reportLabel = isGB ? 'SECR-ready emissions report' : 'Carbon Footprint Report';
// WinAnsi-safe currency label for pdf-lib (₹ and zł are outside Windows-1252)
const PDF_CURRENCY: Record<string, string> = { IN: 'INR', PL: 'PLN' };
const currencySymbol = PDF_CURRENCY[countryCode] ?? getCurrencyConfig(countryCode).symbol;

    // Extract profile fields (Organisation Card)
    const companyName = profile.company_name || 'Not provided';
    const industry = profile.industry || 'Not provided';
    const empCount = Number(profile.employee_count || 0);
    const revenue = Number(profile.annual_revenue || 0);
    const outputUnits = Number(profile.annual_output_units || 0);
    const methodologyConfirmed = !!profile.methodology_confirmed;

    const eeActions = profile.energy_efficiency_actions || '';

    // ======================== CALCULATIONS ========================
    // ======================== CALCULATIONS (MATCH DASHBOARD) ========================

// --------------------
// Totals (activity)
// --------------------
const totalElecKwh = list.reduce((s, r) => s + safe(r.electricity_kwh ?? r.electricity_kw), 0);
const totalDieselLitres = list.reduce((s, r) => s + safe(r.diesel_litres), 0);
const totalPetrolLitres = list.reduce((s, r) => s + safe(r.petrol_litres), 0);
const totalGasKwh = list.reduce((s, r) => s + safe(r.gas_kwh), 0);

// Refrigerant CO2e must be summed per-row (because code can differ per row)
const refrigerantCo2eKg = list.reduce(
  (s, r) =>
    s +
    calcRefrigerantCo2e(
      safe(r.refrigerant_kg),
      (r.refrigerant_code as string | null) ?? 'GENERIC_HFC'
    ),
  0
);

// --------------------
// Scope calculations (kg)
// --------------------
const scope2_kg = totalElecKwh * ef.electricity;

const scope1_fuel_kg =
  totalDieselLitres * ef.diesel +
  totalPetrolLitres * ef.petrol +
  totalGasKwh * ef.gas;

// Treat refrigerant as Scope 1 (fugitive)
const scope1_refrigerant_kg = refrigerantCo2eKg;

const scope1and2_kg = scope1_fuel_kg + scope1_refrigerant_kg + scope2_kg;

// Scope 3 comes from scope3_activities table
const scope3_kg = s3.reduce((s, r) => s + safe(r.co2e_kg), 0);
const totalCO2kg = scope1and2_kg + scope3_kg;

// --------------------
// Final totals
// --------------------



// Tonnes for printing
const scope1_t = (scope1_fuel_kg + scope1_refrigerant_kg) / 1000;
const scope2_t = scope2_kg / 1000;
const scope3_t = scope3_kg / 1000;



    
    // Scope 3 per month
const scope3ByMonth = new Map<string, number>();
for (const r of s3) {
  const m = r.month ?? 'Unknown month';
  scope3ByMonth.set(m, (scope3ByMonth.get(m) ?? 0) + safe(r.co2e_kg));
}

// Combined monthly totals for trend/table (Scope 1+2 from activities + Scope 3)
const months = list.map((r) => r.month);

const values = list.map((r) => {
  const elecKg = safe(r.electricity_kwh ?? r.electricity_kw) * ef.electricity;

  const fuelKg =
    safe(r.diesel_litres) * ef.diesel +
    safe(r.petrol_litres) * ef.petrol +
    safe(r.gas_kwh) * ef.gas;

  const refrigerantKg = calcRefrigerantCo2e(
    safe(r.refrigerant_kg),
    (r.refrigerant_code as string | null) ?? 'GENERIC_HFC'
  );

  const scope12Kg = elecKg + fuelKg + refrigerantKg;

  const scope3Kg =
    s3.find((x) => x.month === r.month)?.co2e_kg ?? 0;

  return scope12Kg + scope3Kg;
});

// Final totals (ALL scopes, kg)




    const peak = Math.max(...values, 0);
    const peakIdx = values.indexOf(peak);
    const peakMonth = months[peakIdx] || '-';

    const latest = values[values.length - 1] || 0;
    const latestMonth = months[months.length - 1] || '-';

    // ======================== PRE-COMPUTE SIGNALS (used across pages) ========================
    const total_t_pre = (scope1_fuel_kg + scope1_refrigerant_kg + scope2_kg + scope3_kg) / 1000;
    const s1_share_pre = total_t_pre ? (scope1_fuel_kg + scope1_refrigerant_kg) / 1000 / total_t_pre : 0;
    const s2_share_pre = total_t_pre ? scope2_kg / 1000 / total_t_pre : 0;
    const s3_share_pre = total_t_pre ? scope3_kg / 1000 / total_t_pre : 0;
    let dominant: 'fuel' | 'electricity' | 'scope3' = 'fuel';
    if (s2_share_pre > s1_share_pre && s2_share_pre > s3_share_pre) dominant = 'electricity';
    if (s3_share_pre > s1_share_pre && s3_share_pre > s2_share_pre) dominant = 'scope3';
    const hotspotLabel = dominant === 'electricity' ? 'Electricity (Scope 2)' : dominant === 'scope3' ? 'Supply chain (Scope 3)' : 'Fuels (Scope 1)';

    // Helper: format YYYY-MM as "Jan 2025"
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function fmtMonth(ym: string): string {
      if (!ym || ym === '-' || !ym.includes('-')) return ym || '-';
      const parts = ym.split('-');
      if (parts.length < 2) return ym;
      const [yr, mo] = parts;
      const idx = parseInt(mo, 10) - 1;
      return (MONTH_ABBR[idx] ?? mo) + ' ' + yr;
    }

    // ======================== PDF INIT ========================
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const BLUE = rgb(52 / 255, 168 / 255, 83 / 255); // chrome green

    const LIGHT_TILE = rgb(230 / 255, 238 / 255, 255 / 255);
    const TEXT = rgb(32 / 255, 32 / 255, 34 / 255);

    // paragraph wrapper
    // paragraph wrapper
    const paragraph = (
      page: PDFPage,
      str: string,
      startX: number,
      maxWidth: number,
      size: number,
      yRef: { value: number }
    ) => {
      const words = str.split(' ');
      let line = '';
      const fontSize = size;

      for (const w of words) {
        const test = line + w + ' ';
        const width = font.widthOfTextAtSize(test, fontSize);

        if (width > maxWidth) {
          page.drawText(line.trim(), {
            x: startX,
            y: yRef.value,
            size: fontSize,
            font,
            color: TEXT,
          });
          yRef.value -= 15;
          line = w + ' ';
        } else {
          line = test;
        }
      }

      if (line.trim() !== '') {
        page.drawText(line.trim(), {
          x: startX,
          y: yRef.value,
          size: fontSize,
          font,
          color: TEXT,
        });
        yRef.value -= 15;
      }

      yRef.value -= 12;
    };

    // ========================= PAGE 1 =========================
let page = pdf.addPage([595, 842]);
let y = 780;

// Local colours (PAGE 1 ONLY)
const GREEN = rgb(52 / 255, 168 / 255, 83 / 255);
const BLACK = rgb(20 / 255, 20 / 255, 20 / 255);
const DIVIDER = rgb(220 / 255, 223 / 255, 228 / 255);

// =========================
// TITLE
// =========================
page.drawText('Carbon Footprint Assessment Report', {
  x: 50,
  y,
  size: 22,
  font: bold,
  color: BLACK,
});

page.drawLine({
  start: { x: 50, y: y - 6 },
  end: { x: 545, y: y - 6 },
  thickness: 1,
  color: GREEN,
});

y -= 42;

// =========================
// METADATA
// =========================

const d = new Date();
const reportDate = `${String(d.getDate()).padStart(2, '0')}/${String(
  d.getMonth() + 1
).padStart(2, '0')}/${d.getFullYear()}`;

const periodStr = (reportStartMonth && reportStartMonth !== 'Not available' && reportEndMonth && reportEndMonth !== 'Not available')
  ? `${fmtMonth(reportStartMonth)} – ${fmtMonth(reportEndMonth)}`
  : 'All data';

// Two-column metadata
const col1X = 50, col2X = 310;
drawText(page, `Organisation:`, col1X, y, 10, font, rgb(0.45, 0.45, 0.47));
drawText(page, companyName, col1X + 80, y, 10, font, BLACK);
drawText(page, `Report date:`, col2X, y, 10, font, rgb(0.45, 0.45, 0.47));
drawText(page, reportDate, col2X + 72, y, 10, font, BLACK);
y -= 15;

drawText(page, `Period:`, col1X, y, 10, font, rgb(0.45, 0.45, 0.47));
drawText(page, periodStr, col1X + 80, y, 10, font, BLACK);
drawText(page, `Country:`, col2X, y, 10, font, rgb(0.45, 0.45, 0.47));
drawText(page, countryName, col2X + 72, y, 10, font, BLACK);
y -= 15;

drawText(page, `Industry:`, col1X, y, 10, font, rgb(0.45, 0.45, 0.47));
drawText(page, industry === 'Not provided' ? 'Not provided' : industry, col1X + 80, y, 10, font, BLACK);
y -= 20;

// ---- divider ABOVE hero ----
page.drawLine({
  start: { x: 50, y },
  end: { x: 545, y },
  thickness: 0.6,
  color: DIVIDER,
});

y -= 50;

// =========================
// HERO METRIC (CENTRED)
// =========================
const heroText = `${(totalCO2kg / 1000).toFixed(2)} tCO2e`;

const heroSize = 34;
const heroWidth = bold.widthOfTextAtSize(heroText, heroSize);
const heroX = 50 + (495 - heroWidth) / 2;

page.drawText(heroText, {
  x: heroX,
  y,
  size: heroSize,
  font: bold,
  color: GREEN,
});

y -= 28;

const subText = 'Total emissions this period';
const subWidth = font.widthOfTextAtSize(subText, 12);
const subX = 50 + (495 - subWidth) / 2;

page.drawText(subText, {
  x: subX,
  y,
  size: 12,
  font,
  color: BLACK,
});

y -= 28;

// ---- divider BELOW hero ----
page.drawLine({
  start: { x: 50, y },
  end: { x: 545, y },
  thickness: 0.6,
  color: DIVIDER,
});

y -= 32;

// =========================
// SCOPE BREAKDOWN — 3-column tiles
// =========================
page.drawText('Emissions by scope', {
  x: 50, y, size: 13, font: bold, color: TEXT,
});
y -= 18;

const tileW = 156, tileH = 52, tileGap = 11;
const tileColors = [
  rgb(0.87, 0.93, 0.88),   // S1 — light green
  rgb(0.86, 0.92, 0.98),   // S2 — light blue
  rgb(0.96, 0.92, 0.86),   // S3 — light amber
];
const tileLabels = ['Scope 1 — Fuels', 'Scope 2 — Electricity', 'Scope 3 — Supply chain'];
const tileValues = [scope1_t, scope2_t, scope3_t];

for (let i = 0; i < 3; i++) {
  const tx = 50 + i * (tileW + tileGap);
  page.drawRectangle({ x: tx, y: y - tileH, width: tileW, height: tileH, color: tileColors[i] });
  page.drawText(`${tileValues[i].toFixed(2)} tCO2e`, { x: tx + 10, y: y - 22, size: 14, font: bold, color: BLACK });
  page.drawText(tileLabels[i], { x: tx + 10, y: y - 37, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
}

y -= tileH + 22;

// =========================
// KEY STATS ROW
// =========================
const energy_kwh =
  totalElecKwh +
  totalDieselLitres * 10.9 +
  totalPetrolLitres * 9.4 +
  totalGasKwh;

const statsLine = [
  `Energy use: ${Math.round(energy_kwh).toLocaleString()} kWh`,
  `Main hotspot: ${hotspotLabel}`,
  empCount ? `Employees: ${empCount}` : null,
].filter(Boolean) as string[];

for (let i = 0; i < statsLine.length; i++) {
  drawText(page, statsLine[i], 50, y - i * 15, 10, font, rgb(0.3, 0.3, 0.3));
}
y -= statsLine.length * 15 + 20;

// =========================
// ORGANISATION PROFILE
// =========================
page.drawText('Organisation details', {
  x: 50, y, size: 13, font: bold, color: TEXT,
});
y -= 18;

if (empCount) { drawText(page, `Employees: ${empCount}`, 50, y, 10, font, BLACK); y -= 14; }
if (revenue > 0) { drawText(page, `Annual revenue: ${currencySymbol}${revenue.toLocaleString()}`, 50, y, 10, font, BLACK); y -= 14; }
if (outputUnits > 0) { drawText(page, `Annual output units: ${outputUnits.toLocaleString()}`, 50, y, 10, font, BLACK); y -= 14; }

// =========================
// FOOTER
// =========================
page.drawText(`Greenio · ${reportLabel} · Page 1`, {
  x: 180,
  y: 20,
  size: 9,
  font,
  color: BLACK,
});

    // ========================= PAGE 2 =========================
    page = pdf.addPage([595, 842]);
    y = 780;

    // ---- PAGE HEADER ----
    page.drawText('1. Executive summary', {
      x: 50,
      y,
      size: 18,
      font: bold,
      color: TEXT,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 34;

    // ---- KEY METRICS SUMMARY ----
    page.drawText(
  `Total emissions: ${(totalCO2kg / 1000).toFixed(2)} tCO2e`,
  { x: 50, y, size: 12, font, color: TEXT }
);


    y -= 20;
    page.drawText(
      `Electricity (Scope 2): ${scope2_kg.toFixed(0)} kg CO2e`,
      {
        x: 50,
        y,
        size: 12,
        font,
        color: TEXT,
      }
    );

    y -= 20;
    page.drawText(
      `Fuels (Scope 1): ${scope1_fuel_kg.toFixed(0)} kg CO2e`,
      {
        x: 50,
        y,
        size: 12,
        font,
        color: TEXT,
      }
    );

    y -= 30;
    page.drawText(
      `Scope 3 (selected categories): ${(scope3_t * 1000).toFixed(0)} kg CO2e`,
      {
        x: 50,
        y,
        size: 12,
        font,
        color: TEXT,
      }
    );

    y -= 30;

    // ---- PERIOD HIGHLIGHTS ----
    page.drawText('Period highlights', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 22;

    page.drawText(`Highest month: ${fmtMonth(peakMonth)} (${(peak / 1000).toFixed(2)} tCO2e)`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });

    y -= 18;
    page.drawText(
      `Latest month: ${fmtMonth(latestMonth)} (${(latest / 1000).toFixed(2)} tCO2e)`,
      {
        x: 50,
        y,
        size: 11,
        font,
        color: TEXT,
      }
    );

    y -= 30;

    // ---- TREND CHART ----
    page.drawText('Trend over recent months (Scope 1 and 2)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });

    y -= 30;

    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 0.4,
      color: rgb(0.75, 0.75, 0.78),
    });

    // Faint grid
    for (let g = 1; g <= 3; g++) {
      page.drawLine({
        start: { x: 50, y: y - g * 20 },
        end: { x: 545, y: y - g * 20 },
        thickness: 0.35,
        color: rgb(0.9, 0.9, 0.92),
      });
    }

    const chartBaseY = y;

    const sx = (i: number) => {
      return 50 + (i / Math.max(values.length - 1, 1)) * 495;
    };
    const sy = (v: number) => {
      const max = Math.max(...values, 1);
      const min = Math.min(...values, 0);
      return chartBaseY - 70 + 60 - ((v - min) / (max - min || 1)) * 60;
    };

    for (let i = 0; i < values.length - 1; i++) {
      page.drawLine({
        start: { x: sx(i), y: sy(values[i]) },
        end: { x: sx(i + 1), y: sy(values[i + 1]) },
        thickness: 1.6,
        color: BLUE,
      });
    }

    if (values.length) {
      page.drawCircle({
        x: sx(values.length - 1),
        y: sy(values[values.length - 1]),
        size: 3,
        color: BLUE,
      });
    }

    y -= 130;

    // ---- MONTHLY TABLE ----
    page.drawText('2. Emissions history by month', {
      x: 50,
      y,
      size: 18,
      font: bold,
      color: TEXT,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 28;

    // HEADER TILE
    page.drawRectangle({
      x: 45,
      y: y - 16,
      width: 510,
      height: 22,
      color: rgb(0, 0, 0),
    });

    const hY = y - 6;

    page.drawText('Month', {
      x: 55,
      y: hY,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Electricity (kWh)', {
      x: 170,
      y: hY,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Diesel (L)', {
      x: 310,
      y: hY,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Total CO2e (kg)', {
      x: 430,
      y: hY,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });

    y -= 26;

    // ROWS
    let rowShade = false;
    for (const r of list) {
      // Page overflow guard
      if (y < 80) {
        page.drawText(`Greenio · ${reportLabel} · Page 2 (cont.)`, { x: 180, y: 20, size: 9, font, color: TEXT });
        page = pdf.addPage([595, 842]);
        y = 780;
        page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 22, color: rgb(0, 0, 0) });
        page.drawText('Month', { x: 55, y: y - 6, size: 11, font: bold, color: rgb(1,1,1) });
        page.drawText('Electricity (kWh)', { x: 170, y: y - 6, size: 11, font: bold, color: rgb(1,1,1) });
        page.drawText('Diesel (L)', { x: 310, y: y - 6, size: 11, font: bold, color: rgb(1,1,1) });
        page.drawText('Total CO2e (kg)', { x: 430, y: y - 6, size: 11, font: bold, color: rgb(1,1,1) });
        y -= 26;
      }

      page.drawRectangle({
        x: 45,
        y: y - 16,
        width: 510,
        height: 22,
        color: rowShade ? rgb(0.95, 0.95, 0.97) : rgb(0.98, 0.98, 1),
      });

      rowShade = !rowShade;

      page.drawText(fmtMonth(r.month), { x: 55, y: y - 5, size: 11, font, color: TEXT });
      page.drawText(String(safe(r.electricity_kwh ?? r.electricity_kw)), {
        x: 170,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });
      page.drawText(String(safe(r.diesel_litres)), {
        x: 310,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });
      page.drawText(safe(r.total_co2e).toFixed(2), {
        x: 430,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });

      y -= 24;
    }

    // ---- FOOTER PAGE 2 ----
    page.drawText(`Greenio · ${reportLabel} · Page 2`, {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
    });

    // ========================= PAGE 3 (Scopes + SECR) =========================
    page = pdf.addPage([595, 842]);
    y = 780;

    // Page header
    page.drawText(`3. Scope breakdown and ${isGB ? 'SECR' : 'emissions'} summary`, {
      x: 50,
      y,
      size: 18,
      font: bold,
      color: TEXT,
    });
    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 30;

    // ---- Scope 1 ----
    page.drawText(
      `Scope 1 (direct fuel emissions): ${scope1_t.toFixed(2)} tCO2e`,
      { x: 50, y, size: 12, font, color: TEXT }
    );
    y -= 16;

    {
      const yRef = { value: y };
      paragraph(page, 'Includes emissions from combustion of diesel, petrol and gas in company-operated vehicles or equipment.', 50, 480, 11, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---- Scope 2 ----
    page.drawText(
      `Scope 2 (purchased electricity): ${scope2_t.toFixed(2)} tCO2e`,
      { x: 50, y, size: 12, font, color: TEXT }
    );
    y -= 16;

    {
      const yRef = { value: y };
      paragraph(page, `Calculated using national grid emission factors for ${countryName} (${ef.electricity} kg CO2e per kWh).`, 50, 480, 11, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---- Scope 3 ----
    page.drawText(
      `Scope 3 (selected categories): ${scope3_t.toFixed(2)} tCO2e`,
      { x: 50, y, size: 12, font, color: TEXT }
    );
    y -= 16;

    {
      const yRef = { value: y };
      paragraph(page, 'Scope 3 values represent only categories recorded in Greenio. This is not a complete Scope 3 inventory.', 50, 480, 11, yRef);
      y = yRef.value;
    }

    // Add spacing before table
    y -= 40;

    // ---- Scope 3 SUMMARY TABLE ----
    page.drawText('Scope 3 (selected categories – summary)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 20;

    // Table header
    page.drawRectangle({
      x: 45,
      y: y - 18,
      width: 510,
      height: 22,
      color: rgb(0, 0, 0),
    });

    page.drawText('Category', {
      x: 55,
      y: y - 6,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Emissions (tCO2e)', {
      x: 210,
      y: y - 6,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Share (%)', {
      x: 380,
      y: y - 6,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });

    y -= 26;

    let s3AltShade = false;
    const s3_total_t = s3.reduce((s, r) => s + safe(r.co2e_kg), 0) / 1000;

    for (const r of s3) {
      // Page overflow — start a continuation page before this row falls off
      if (y < 80) {
        page.drawText(`Greenio · ${reportLabel} · Page 3 (cont.)`, {
          x: 180, y: 20, size: 9, font, color: TEXT,
        });
        page = pdf.addPage([595, 842]);
        y = 780;
        // Repeat table header on the new page
        page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
        page.drawText('Category',           { x: 55,  y: y - 6, size: 11, font: bold, color: rgb(1, 1, 1) });
        page.drawText('Emissions (tCO2e)',  { x: 210, y: y - 6, size: 11, font: bold, color: rgb(1, 1, 1) });
        page.drawText('Share (%)',          { x: 380, y: y - 6, size: 11, font: bold, color: rgb(1, 1, 1) });
        y -= 26;
      }

      const t = safe(r.co2e_kg) / 1000;
      const pct = s3_total_t ? ((t / s3_total_t) * 100).toFixed(1) : '0';

      page.drawRectangle({
        x: 45,
        y: y - 16,
        width: 510,
        height: 22,
        color: s3AltShade ? rgb(0.95, 0.95, 0.97) : rgb(0.98, 0.98, 1),
      });
      s3AltShade = !s3AltShade;

      page.drawText(r.category, {
        x: 55,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });
      page.drawText(t.toFixed(3), {
        x: 210,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });
      page.drawText(String(pct), {
        x: 380,
        y: y - 5,
        size: 11,
        font,
        color: TEXT,
      });

      y -= 24;
    }

    // Add spacing before next header
    y -= 20;

    // ---- Page break guard before Hotspot ----
    if (y < 160) {
      page.drawText(`Greenio · ${reportLabel} · Page 3 (cont.)`, { x: 180, y: 20, size: 9, font, color: TEXT });
      page = pdf.addPage([595, 842]);
      y = 780;
    }

    // ---- HOTSPOT ----
    page.drawText('Hotspot analysis', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 20;

    {
      const hotspotText = dominant === 'electricity'
        ? 'Electricity consumption is the dominant emissions source. Facilities, equipment and operational hours drive most carbon intensity.'
        : dominant === 'scope3'
        ? 'Supply chain activities (Scope 3) are the dominant emissions source. Upstream procurement and logistics represent the main reduction levers.'
        : 'Fuel combustion (Scope 1) is the dominant emissions source. Operational routing, driving behaviour and maintenance practices represent the main reduction levers.';
      const yRef = { value: y };
      paragraph(page, hotspotText, 50, 480, 11, yRef);
      y = yRef.value;
    }

    y -= 40;

    // ---- Page break guard before SECR (needs ~200px) ----
    if (y < 220) {
      page.drawText(`Greenio · ${reportLabel} · Page 3 (cont.)`, { x: 180, y: 20, size: 9, font, color: TEXT });
      page = pdf.addPage([595, 842]);
      y = 780;
    }

    // ---- SECR ----
    page.drawText(isGB ? 'SECR summary' : 'Energy and emissions summary', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 22;

    page.drawText(`Electricity: ${totalElecKwh.toFixed(0)} kWh`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });
    y -= 16;

    page.drawText(
      `Road fuels: ${(totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh).toFixed(0)} kWh`,
      {
        x: 50,
        y,
        size: 11,
        font,
        color: TEXT,
      }
    );
    y -= 16;

    page.drawText(
      `Total energy: ${(totalElecKwh + totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh).toFixed(0)} kWh`,
      {
        x: 50,
        y,
        size: 11,
        font,
        color: TEXT,
      }
    );

    y -= 26;

    page.drawText('GHG emissions:', {
      x: 50,
      y,
      size: 11,
      font: bold,
      color: TEXT,
    });

    y -= 16;
    page.drawText(`Scope 1: ${scope1_t.toFixed(2)} tCO2e`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });
    y -= 16;

    page.drawText(`Scope 2: ${scope2_t.toFixed(2)} tCO2e`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });
    y -= 16;

    page.drawText(`Scope 3: ${scope3_t.toFixed(2)} tCO2e`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });
    y -= 16;

    page.drawText(
      `Total: ${(scope1_t + scope2_t + scope3_t).toFixed(2)} tCO2e`,
      {
        x: 50,
        y,
        size: 11,
        font,
        color: TEXT,
      }
    );

    // ---- INTENSITY METRICS ----
    y -= 28;

    page.drawText('Intensity metrics', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 20;

    if (empCount) {
      page.drawText(`tCO2e per employee: ${(totalCO2kg / 1000 / empCount).toFixed(3)}`, { x: 50, y, size: 11, font, color: TEXT });
      y -= 16;
    }

    if (revenue > 0) {
      const perRevenue = totalCO2kg / 1000 / revenue;
      const perRevenueStr = perRevenue < 0.001 ? perRevenue.toExponential(3) : perRevenue.toFixed(4);
      page.drawText(`tCO2e per ${currencySymbol} revenue: ${perRevenueStr}`, { x: 50, y, size: 11, font, color: TEXT });
      y -= 16;
    }

    if (outputUnits > 0) {
      const perUnit = totalCO2kg / 1000 / outputUnits;
      const perUnitStr = perUnit < 0.001 ? perUnit.toExponential(3) : perUnit.toFixed(4);
      page.drawText(`tCO2e per output unit: ${perUnitStr}`, { x: 50, y, size: 11, font, color: TEXT });
      y -= 16;
    }

    if (!empCount && revenue <= 0 && outputUnits <= 0) {
      page.drawText('No intensity data available. Add employee count and revenue in your profile.', { x: 50, y, size: 10, font, color: rgb(0.5, 0.5, 0.52) });
      y -= 14;
    }
    // ---- FOOTER ----
    page.drawText(`Greenio · ${reportLabel} · Page 3`, {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
    });
    y -= 35; // spacing before Page 4

    // ========================= PAGE 4 =========================
    page = pdf.addPage([595, 842]);
    y = 780;

    // ---- HEADER ----
    page.drawText('4. Key insights, actions and opportunities', {
      x: 50,
      y,
      size: 18,
      font: bold,
      color: TEXT,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 40;

    // ---------------- DYNAMIC SIGNALS ----------------
    // dominant is pre-computed above (s1_share_pre etc.)

    let trend = 'stable';
    if (values.length > 3) {
      const first = values[0];
      const last = values[values.length - 1];
      if (last > first * 1.15) trend = 'rising';
      else if (last < first * 0.85) trend = 'falling';
      else trend = 'inconsistent';
    }

    const missingData = list.length === 0 || values.includes(0);

    // ---------------- KEY INSIGHTS ----------------
    page.drawText('Key insights', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    // INSIGHT 1 — Emissions profile
    {
      const yRef = { value: y };
      paragraphText(
        page,
        font,
        TEXT,
        dominant === 'fuel'
          ? 'Fuel combustion is the primary source of emissions, highlighting a fleet-intensive operational model. Mileage patterns, idling behaviour and route variability strongly influence emissions outcomes.'
          : dominant === 'electricity'
          ? 'Electricity consumption accounts for the largest emissions share, indicating that facilities, equipment and operational hours drive most carbon intensity.'
          : 'Scope 3 activities represent the dominant emissions contributors, indicating upstream supply chain processes and purchased goods have the strongest influence on organisational carbon impact.',
        yRef
      );
      y = yRef.value;
    }

    // INSIGHT 2
    {
      const yRef = { value: y };
      paragraphText(
        page,
        font,
        TEXT,
        dominant === 'fuel'
          ? 'Operational fuel use suggests inefficiencies such as non-optimised routing, inconsistent driver behaviour or under-maintained vehicles. These are common high-impact areas in transport-oriented operations.'
          : dominant === 'electricity'
          ? 'Electricity-driven emissions suggest opportunities in equipment efficiency, load control, heating and cooling optimisation and facility utilisation.'
          : 'A Scope 3-heavy profile highlights the need for deeper supplier engagement, data collection and value-chain transparency to build a complete emissions baseline.',
        yRef
      );
      y = yRef.value;
    }

    // INSIGHT 3
    {
      let trendParagraph =
        trend === 'rising'
          ? 'Recent emissions indicate an upward trajectory, signalling increased operational load or reduced efficiency. This trend warrants immediate diagnostic analysis.'
          : trend === 'falling'
          ? 'Emissions have declined over recent months, reflecting early improvements or reduced operational intensity. Continued monitoring can help maintain momentum.'
          : 'Month-to-month fluctuations show no consistent trend, suggesting varying operational patterns or inconsistent data logging.';
      if (missingData)
        trendParagraph +=
          ' Some entries appear incomplete or zero, reducing analytical confidence.';

      const yRef = { value: y };
      paragraphText(page, font, TEXT, trendParagraph, yRef);
      y = yRef.value;
    }

    // INSIGHT 4
    {
      const yRef = { value: y };
      paragraphText(
        page,
        font,
        TEXT,
        dominant === 'fuel'
          ? 'Long-term decarbonisation will require structured fleet optimisation, including driver training, telematics, preventative maintenance and a phased transition to hybrid or electric vehicles.'
          : dominant === 'electricity'
          ? 'Strategic reductions will require integrated energy-efficiency planning, equipment upgrades and a shift towards renewable or lower-carbon electricity procurement.'
          : 'Meaningful reductions require supply-chain collaboration, sustainability requirements in procurement, data transparency and prioritisation of high-impact suppliers.',
        yRef
      );
      y = yRef.value;
    }

    y -= 10;

    // ---------------- TOP 3 RECOMMENDED ACTIONS ----------------
    page.drawText('Top 3 recommended actions', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    const actions =
      dominant === 'fuel'
        ? [
            'Improve route planning and integrate idle-reduction policies to reduce unnecessary fuel consumption.',
            'Implement efficiency-focused driver training covering acceleration, braking and speed discipline.',
            'Strengthen scheduled maintenance to optimise fuel efficiency and reduce operational wear.',
          ]
        : dominant === 'electricity'
        ? [
            'Conduct a full energy-efficiency assessment of facility equipment, lighting and HVAC performance.',
            'Introduce automated controls or smart-metering analytics to reduce off-peak and baseload consumption.',
            'Explore equipment upgrades and renewable-electricity procurement for sustained long-term reductions.',
          ]
        : [
            'Expand Scope 3 data capture across upstream procurement, waste, logistics and downstream activities.',
            'Engage strategic suppliers to build shared data-transparency processes and reduction initiatives.',
            'Embed sustainability requirements into procurement frameworks to influence supply-chain emissions.',
          ];

    for (const a of actions) {
      const yRef = { value: y };
      paragraphText(page, font, TEXT, a, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---------------- IMMEDIATE ACTIONS ----------------
    page.drawText('Immediate actions (0–6 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    const imm =
      dominant === 'fuel'
        ? [
            'Strengthen fuel and mileage tracking to detect inefficient routes or high-waste behaviours.',
            'Review highest-mileage routes and identify quick-win optimisation opportunities.',
          ]
        : dominant === 'electricity'
        ? [
            'Analyse peak-load consumption to identify avoidable energy spikes.',
            'Introduce equipment-shutdown and low-activity control routines.',
          ]
        : [
            'Expand Scope 3 activity-data collection to improve baseline accuracy.',
            'Engage top suppliers to establish emissions-data submission processes.',
          ];

    for (const a of imm) {
      const yRef = { value: y };
      paragraphText(page, font, TEXT, a, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---------------- MEDIUM-TERM ----------------
    page.drawText('Medium term opportunities (6–36 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    const med =
      dominant === 'fuel'
        ? [
            'Design a staged fleet-transition roadmap evaluating hybrid or electric vehicle suitability.',
            'Explore logistics consolidation, depot optimisation or integrated planning frameworks to lower mileage.',
          ]
        : dominant === 'electricity'
        ? [
            'Upgrade to high-efficiency equipment and explore advanced building-management systems.',
            'Evaluate on-site renewable generation or longer-term renewable-electricity contracts.',
          ]
        : [
            'Develop a supplier-focused decarbonisation roadmap prioritising high-impact categories.',
            'Integrate emissions-scoring into procurement decisions to incentivise lower-carbon options.',
          ];

    for (const a of med) {
      const yRef = { value: y };
      paragraphText(page, font, TEXT, a, yRef);
      y = yRef.value;
    }

    // ---- FOOTER ----
    page.drawText(`Greenio · ${reportLabel} · Page 4`, {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
    });

    // ========================= PAGE 5 =========================
page = pdf.addPage([595, 842]);

y = 780;

page.drawText('5. Methodology and governance', {
  x: 50,
  y,
  size: 18,
  font: bold,
  color: TEXT,
});

page.drawLine({
  start: { x: 50, y: y - 6 },
  end: { x: 545, y: y - 6 },
  thickness: 1,
  color: BLUE,
});

y -= 40;

// ---------------- METHODOLOGY ----------------
page.drawText('Methodology', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

let yRef = { value: y };

// Paragraph 1 (updated)
paragraphText(
  page,
  font,
  TEXT,
  `Emission calculations use national GHG conversion factors applicable to ${countryName} (${ef.version}). Electricity emissions use location-based grid factors and do not include market-based supplier factors. Fuel emissions use standard CO2e per-litre values, and Scope 3 emissions use category-specific activity factors.`,
  yRef
);

// Paragraph 2 (updated)
paragraphText(
  page,
  font,
  TEXT,
  'Scope 1 reflects direct combustion of fuels. Scope 2 reflects purchased electricity. Scope 3 reflects only the categories reported during this period and does not constitute a complete value-chain inventory. Data gaps may exist where Scope 3 information has not been collected.',
  yRef
);

// Paragraph 3 (updated)
paragraphText(
  page,
  font,
  TEXT,
  `Boundary: This report applies an operational-control boundary and covers operations in ${countryName}. Activities outside this boundary are excluded. Where no prior-year data exists, no year-on-year comparison is presented.`,
  yRef
);

// Paragraph 4 (updated)
paragraphText(
  page,
  font,
  TEXT,
  'The primary intensity ratio is tCO2e per employee, as it reflects organisational activity. Supplementary ratios—tCO2e per revenue unit and tCO2e per output unit—are included for transparency.',
  yRef
);

y = yRef.value;

// ---------------- SECR METHODOLOGY CONFIRMATION ----------------
page.drawText(isGB ? 'SECR methodology confirmation' : 'Methodology confirmation', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

yRef = { value: y };

if (methodologyConfirmed) {
  paragraphText(
    page,
    font,
    TEXT,
    `The organisation has confirmed the calculation methodology used in this report${isGB ? ' for SECR compliance' : ''}.`,
    yRef
  );
} else {
  paragraphText(
    page,
    font,
    TEXT,
    `The organisation has not yet confirmed the calculation methodology used in this report. ${isGB ? 'A fully compliant SECR disclosure cannot be issued until confirmation is provided.' : 'Please confirm the methodology before using this report for regulatory purposes.'}`,
    yRef
  );
}

y = yRef.value;

// ---------------- ORGANISATIONAL BOUNDARY ----------------
page.drawText('Organisational boundary', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

yRef = { value: y };

paragraphText(
  page,
  font,
  TEXT,
  `This report covers operations in ${countryName} under operational control. Additional sites, subsidiaries or cross-border activities may be incorporated in future reporting cycles.`,
  yRef
);

y = yRef.value;

// ---------------- RESPONSIBILITY STATEMENT ----------------
page.drawText('Responsibility statement', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

yRef = { value: y };

paragraphText(
  page,
  font,
  TEXT,
  'Directors or authorised representatives are responsible for the completeness and accuracy of all data submitted. Greenio applies calculations directly to the data provided and does not perform independent verification unless separately commissioned.',
  yRef
);

y = yRef.value;

// ---------------- ENERGY EFFICIENCY ACTIONS ----------------
page.drawText('Energy efficiency actions this year', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

yRef = { value: y };

if (eeActions && eeActions.trim().length > 0) {
  paragraphText(page, font, TEXT, eeActions.trim(), yRef);
} else {
  paragraphText(
    page,
    font,
    TEXT,
    'No energy-efficiency actions were reported for this year.',
    yRef
  );
}

y = yRef.value;

// ---------------- DATA QUALITY ----------------
page.drawText('Data quality and limitations', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

yRef = { value: y };

paragraphText(
  page,
  font,
  TEXT,
  'This report is based only on data entered into Greenio. Missing months, zero-value entries or incomplete Scope 3 coverage may reduce analytical completeness.',
  yRef
);

y = yRef.value;

// ---- FOOTER ----
page.drawText(`Greenio · ${reportLabel} · Page 5`, {
  x: 180,
  y: 20,
  size: 9,
  font,
  color: TEXT,
});
// ========================= PAGE 6 (Emission Factors Appendix) =========================
page = pdf.addPage([595, 842]);
y = 780;

// Header
page.drawText('6. Emission factors appendix', {
  x: 50,
  y,
  size: 18,
  font: bold,
  color: TEXT,
});

page.drawLine({
  start: { x: 50, y: y - 6 },
  end: { x: 545, y: y - 6 },
  thickness: 1,
  color: BLUE,
});

y -= 40;

// Intro paragraph
{
  const yRef = { value: y };
  paragraphText(
    page,
    font,
    TEXT,
    `All calculations use the national GHG conversion factors for ${countryName}. Source: ${ef.version}. These factors cover Scope 1, Scope 2 and Scope 3 (selected categories).`,
    yRef
  );
  y = yRef.value;
}

y -= 10;

// --------------------------- SCOPE 1 ---------------------------
page.drawText('Scope 1 — Direct emissions factors (fuel combustion)', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

page.drawText(`Diesel: ${ef.diesel} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`Petrol: ${ef.petrol} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`LPG: ${ef.gas > 0 ? (ef.gas * 29).toFixed(3) : '1.500'} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`Natural gas: ${ef.gas.toFixed(4)} kg CO2e per kWh`, { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// --------------------------- SCOPE 2 ---------------------------
page.drawText('Scope 2 — Purchased electricity (location-based)', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

page.drawText(`${countryName} grid electricity: ${ef.electricity} kg CO2e per kWh`, {
  x: 60,
  y,
  size: 11,
  font,
  color: TEXT,
});
y -= 15;

page.drawText(isGB ? 'Market-based factors are not used for SECR.' : 'Market-based factors are not used.', {
  x: 60,
  y,
  size: 11,
  font,
  color: TEXT,
});
y -= 25;

// --------------------------- SCOPE 3 ---------------------------
page.drawText('Scope 3 — Selected categories', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

// Business Travel
page.drawText('Business travel factors:', { x: 50, y, size: 11, font: bold, color: TEXT }); 
y -= 18;

page.drawText('Car (diesel): 0.171 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Car (petrol): 0.140 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Taxi: 0.153 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Rail: 0.036 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Domestic flight: 0.254 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// Employee commuting
page.drawText('Employee commuting:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 18;

page.drawText('Average commuter: 0.109 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Car (unspecified): 0.163 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// Waste
page.drawText('Waste factors:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 18;

page.drawText('General waste to landfill: 0.466 kg CO2e per kg', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Mixed recycling: 0.021 kg CO2e per kg', { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// Water
page.drawText('Water supply & treatment:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 18;

page.drawText('Water supply: 0.344 kg CO2e per m3', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Water treatment: 0.708 kg CO2e per m3', { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// --------------------------- ENERGY CONVERSION ---------------------------
page.drawText(`Energy conversion factors${isGB ? ' (SECR requirement)' : ''}`, {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

page.drawText('Diesel: 10.9 kWh per litre', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('Petrol: 9.4 kWh per litre', { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText('LPG: 7.1 kWh per litre', { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// Review paragraph
{
  const yRef = { value: y };
  paragraphText(
    page,
    font,
    TEXT,
    `Emission factors are updated annually following publication of new national GHG conversion factors. Greenio automatically applies the latest factors for ${countryName} for each reporting period.`,
    yRef
  );
  y = yRef.value;  
}

// Footer
page.drawText(`Greenio · ${reportLabel} · Page 6`, {
  x: 180,
  y: 20,
  size: 9,
  font,
  color: TEXT,
});


    // ========================= RETURN PDF =========================
    const pdfBytes = await pdf.save();

    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=carbon-report.pdf',
      },
    });
  } catch (err) {
    console.error('REPORT ERROR:', err);
    return new NextResponse('Failed to generate report', { status: 500 });
  }
}