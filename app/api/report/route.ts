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

// ======================== AUTH CHECK ========================
if (!userId) return new NextResponse('Missing userId', { status: 400 });
const token = searchParams.get('token');
if (!token) return new NextResponse('Unauthorized', { status: 401 });
const { data: { user: sessionUser } } = await supabase.auth.getUser(token);
if (!sessionUser || sessionUser.id !== userId) {
  return new NextResponse('Unauthorized', { status: 401 });
}

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

// Load India-specific BRSR supplementary data (fetched for all accounts, used only in IN section)
const [brsrProfileRes, waterEntriesRes, wasteEntriesRes, airEmissionsRes] = await Promise.all([
  supabase.from('brsr_profile').select('renewable_elec_pct,has_ghg_reduction_plan').eq('account_id', userId).maybeSingle(),
  supabase.from('water_entries').select('volume_withdrawn_kl').eq('account_id', userId),
  supabase.from('waste_entries').select('total_kg').eq('account_id', userId),
  supabase.from('air_emissions').select('nox_tonnes,sox_tonnes,pm_tonnes,period_year').eq('account_id', userId).order('period_year', { ascending: false }),
]);
const brsrExtraProfile = brsrProfileRes.data;

// Period-aware aggregation: only include entries that fall within the report period
const toYM = (yyyyMM: string) => { const [y, m] = yyyyMM.split('-').map(Number); return y * 12 + m; };
const brsrStartYM = startMonth ? toYM(startMonth) : 0;
const brsrEndYM   = endMonth   ? toYM(endMonth)   : 999999;

const brsrWaterTotal = (waterEntriesRes.data ?? []).reduce((s: number, r: any) => {
  const ym = (r.period_year ?? 0) * 12 + (r.period_month ?? 0);
  return (ym >= brsrStartYM && ym <= brsrEndYM) ? s + (r.volume_withdrawn_kl ?? 0) : s;
}, 0);
const brsrWasteTotal = (wasteEntriesRes.data ?? []).reduce((s: number, r: any) => {
  const ym = (r.period_year ?? 0) * 12 + (r.period_month ?? 0);
  return (ym >= brsrStartYM && ym <= brsrEndYM) ? s + (r.total_kg ?? 0) : s;
}, 0);
// Air emissions are annual (period_year only) — pick the entry whose FY overlaps the report period
const reportStartYear = startMonth ? Number(startMonth.split('-')[0]) : 0;
const reportEndYear   = endMonth   ? Number(endMonth.split('-')[0])   : 9999;
const brsrLatestAir = (airEmissionsRes.data ?? [])
  .find((r: any) => r.period_year >= reportStartYear && r.period_year <= reportEndYear) ?? null;

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

    // Identify the dominant Scope 1 sub-source from actual logged data — purely evidence-based.
    const s1DieselCo2e  = totalDieselLitres * ef.diesel;
    const s1PetrolCo2e  = totalPetrolLitres * ef.petrol;
    const s1GasCo2e     = totalGasKwh * ef.gas;
    const s1RefrigCo2e  = scope1_refrigerant_kg;
    type FuelSource = 'diesel' | 'petrol' | 'gas' | 'refrigerant';
    const s1Breakdown: Record<FuelSource, number> = {
      diesel: s1DieselCo2e, petrol: s1PetrolCo2e, gas: s1GasCo2e, refrigerant: s1RefrigCo2e,
    };
    // Whichever sub-source contributed the most CO2e is the dominant one
    const fuelSource = (Object.entries(s1Breakdown).sort((a, b) => b[1] - a[1])[0][0]) as FuelSource;

    // Helper: format YYYY-MM as "Jan 2025"
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtMonth = (ym: string): string => {
      if (!ym || ym === '-' || !ym.includes('-')) return ym || '-';
      const parts = ym.split('-');
      if (parts.length < 2) return ym;
      const [yr, mo] = parts;
      const idx = parseInt(mo, 10) - 1;
      return (MONTH_ABBR[idx] ?? mo) + ' ' + yr;
    };

    // ======================== PDF INIT ========================
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const BLUE = rgb(52 / 255, 168 / 255, 83 / 255); // chrome green
    const TEXT = rgb(32 / 255, 32 / 255, 34 / 255);

    // Global sequential page counter
    let pNum = 0;
    const addPage = (): ReturnType<typeof pdf.addPage> => { pNum++; return pdf.addPage([595, 842]); };
    const pgFtr = () => `Greenio · ${reportLabel} · Page ${pNum}`;

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
let page = addPage();
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
const tileLabels = ['Scope 1: Fuels', 'Scope 2: Electricity', 'Scope 3: Supply chain'];
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
page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });

    // ========================= PAGE 2 =========================
    page = addPage();
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

    // ---- KEY METRICS SUMMARY (table) ----
    {
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Emissions summary', { x: 55, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Value', { x: 400, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      const execRows: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Total emissions', value: `${(totalCO2kg / 1000).toFixed(2)} tCO2e`, highlight: true },
        { label: 'Scope 1 (direct emissions)', value: `${((scope1_fuel_kg + scope1_refrigerant_kg) / 1000).toFixed(3)} tCO2e` },
        { label: 'Scope 2 (electricity)', value: `${(scope2_kg / 1000).toFixed(3)} tCO2e` },
        { label: 'Scope 3 (selected categories)', value: `${scope3_t.toFixed(3)} tCO2e` },
      ];
      let exShade = false;
      for (const row of execRows) {
        const bg = row.highlight ? rgb(0.92, 0.96, 0.92) : exShade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: bg });
        page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
        page.drawText(row.label, { x: 55, y: y - 6, size: 10, font: row.highlight ? bold : font, color: TEXT });
        page.drawText(row.value, { x: 400, y: y - 6, size: 10, font: row.highlight ? bold : font, color: row.highlight ? BLUE : TEXT });
        exShade = !exShade;
        y -= 24;
      }
    }
    y -= 14;

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

    // Chart layout — leave 42px on the left for Y-axis labels
    const cLeft   = 92;
    const cRight  = 545;
    const cWidth  = cRight - cLeft;
    const cTop    = y - 8;   // top of data area (max value)
    const cBottom = y - 78;  // bottom of data area (0)
    const cHeight = cTop - cBottom;

    // Y-axis: always start at 0, nice round max in tCO2e
    const valuesT  = values.map(v => v / 1000);
    const rawMaxT  = Math.max(...valuesT, 0.1);
    const niceMaxT = rawMaxT <= 1   ? Math.ceil(rawMaxT * 4) / 4
                   : rawMaxT <= 5   ? Math.ceil(rawMaxT)
                   : rawMaxT <= 20  ? Math.ceil(rawMaxT / 2) * 2
                   : Math.ceil(rawMaxT / 5) * 5;
    const NUM_TICKS = 4;
    const tickStep  = niceMaxT / NUM_TICKS;

    // Coordinate helpers
    const sx = (i: number) => cLeft + (i / Math.max(values.length - 1, 1)) * cWidth;
    const syT = (vt: number) => cBottom + (vt / niceMaxT) * cHeight;

    // Gridlines + Y-axis labels
    const AXIS_COLOR = rgb(0.78, 0.78, 0.80);
    const GRID_COLOR = rgb(0.91, 0.91, 0.93);
    const LBL_COLOR  = rgb(0.50, 0.50, 0.52);
    for (let t = 0; t <= NUM_TICKS; t++) {
      const tv  = t * tickStep;
      const ty  = syT(tv);
      const lbl = tv === 0 ? '0' : tv < 1 ? tv.toFixed(2) : tv % 1 === 0 ? String(tv) : tv.toFixed(1);
      const lblW = font.widthOfTextAtSize(lbl, 7);
      page.drawText(lbl, { x: cLeft - lblW - 4, y: ty - 3, size: 7, font, color: LBL_COLOR });
      page.drawLine({ start: { x: cLeft, y: ty }, end: { x: cRight, y: ty }, thickness: t === 0 || t === NUM_TICKS ? 0.5 : 0.3, color: t === 0 || t === NUM_TICKS ? AXIS_COLOR : GRID_COLOR });
    }

    // Y-axis vertical line
    page.drawLine({ start: { x: cLeft, y: cBottom }, end: { x: cLeft, y: cTop }, thickness: 0.5, color: AXIS_COLOR });

    // Y-axis unit label (rotated text not supported in pdf-lib — draw sideways label above)
    page.drawText('tCO2e', { x: 50, y: cTop + 2, size: 7, font, color: LBL_COLOR });

    // Data line
    for (let i = 0; i < values.length - 1; i++) {
      page.drawLine({
        start: { x: sx(i),     y: syT(valuesT[i]) },
        end:   { x: sx(i + 1), y: syT(valuesT[i + 1]) },
        thickness: 1.6,
        color: BLUE,
      });
    }

    // Last dot
    if (values.length) {
      page.drawCircle({ x: sx(values.length - 1), y: syT(valuesT[values.length - 1]), size: 3, color: BLUE });
    }

    // X-axis labels — "Jan 26" format, smart skip for >6 months
    const fmtChartLbl = (ym: string) => {
      const parts = ym.split('-');
      if (parts.length !== 2) return ym;
      return `${MONTH_ABBR[parseInt(parts[1], 10) - 1] ?? ''} ${parts[0].slice(2)}`;
    };
    // For ≤6 months: show all. For 7-12: show every 3rd (quarterly). Always show first & last.
    const skipN = values.length <= 6 ? 1 : values.length <= 9 ? 2 : 3;
    for (let i = 0; i < months.length; i++) {
      if (i % skipN !== 0 && i !== months.length - 1) continue;
      const lbl  = fmtChartLbl(months[i]);
      const lblW = font.widthOfTextAtSize(lbl, 7);
      const lx   = Math.min(Math.max(sx(i) - lblW / 2, cLeft), cRight - lblW);
      page.drawText(lbl, { x: lx, y: cBottom - 13, size: 7, font, color: LBL_COLOR });
    }

    y -= 128;

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

    const hY = y - 9;  // vertically centred in 22pt header rect

    page.drawText('Month',              { x: 55,  y: hY, size: 10, font: bold, color: rgb(1,1,1) });
    page.drawText('Electricity (tCO2e)', { x: 148, y: hY, size: 10, font: bold, color: rgb(1,1,1) });
    page.drawText('Fuels (tCO2e)',      { x: 258, y: hY, size: 10, font: bold, color: rgb(1,1,1) });
    page.drawText('Scope 3 (tCO2e)',    { x: 365, y: hY, size: 10, font: bold, color: rgb(1,1,1) });
    page.drawText('Total (tCO2e)',      { x: 455, y: hY, size: 10, font: bold, color: rgb(1,1,1) });

    y -= 26;

    // ROWS
    let rowShade = false;
    for (const r of list) {
      // Page overflow guard
      if (y < 80) {
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage();
        y = 780;
        page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 22, color: rgb(0, 0, 0) });
        page.drawText('Month',               { x: 55,  y: y - 9, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Electricity (tCO2e)', { x: 148, y: y - 9, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Fuels (tCO2e)',       { x: 258, y: y - 9, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Scope 3 (tCO2e)',     { x: 365, y: y - 9, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Total (tCO2e)',       { x: 455, y: y - 9, size: 10, font: bold, color: rgb(1,1,1) });
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

      // Recalculate CO2e from components so it matches the report totals
      const rowElecKg   = safe(r.electricity_kwh ?? r.electricity_kw) * ef.electricity;
      const rowFuelKg   = safe(r.diesel_litres) * ef.diesel + safe(r.petrol_litres) * ef.petrol + safe(r.gas_kwh) * ef.gas;
      const rowRefrigKg = calcRefrigerantCo2e(safe(r.refrigerant_kg), (r.refrigerant_code as string | null) ?? 'GENERIC_HFC');
      const rowS3Kg     = scope3ByMonth.get(r.month) ?? 0;
      const rowTotal    = rowElecKg + rowFuelKg + rowRefrigKg + rowS3Kg;

      const rowFuelsTotal = rowFuelKg + rowRefrigKg;
      page.drawText(fmtMonth(r.month),                           { x: 55,  y: y - 5, size: 10, font, color: TEXT });
      page.drawText((rowElecKg / 1000).toFixed(3),               { x: 148, y: y - 5, size: 10, font, color: TEXT });
      page.drawText((rowFuelsTotal / 1000).toFixed(3),           { x: 255, y: y - 5, size: 10, font, color: TEXT });
      page.drawText(rowS3Kg > 0 ? (rowS3Kg / 1000).toFixed(3) : '0', { x: 365, y: y - 5, size: 10, font, color: TEXT });
      page.drawText((rowTotal / 1000).toFixed(3),                { x: 455, y: y - 5, size: 10, font, color: TEXT });

      y -= 24;
    }

    // Table footnote
    y -= 4;
    page.drawText('All values in metric tonnes CO2e (tCO2e). Fuels includes diesel, petrol, natural gas and refrigerant. Total = Elec + Fuels + Scope 3.', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.52) });
    y -= 14;

    // ---- FOOTER PAGE 2 ----
    page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });

    // ========================= PAGE 3 (Scopes + SECR) =========================
    page = addPage();
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

    // ---- Scope boxes (S1 / S2 / S3) ----
    {
      const scopeBoxDefs = [
        {
          label: 'Scope 1: Direct fuel emissions',
          value: `${scope1_t.toFixed(2)} tCO2e`,
          desc: 'Includes emissions from combustion of diesel, petrol and gas in company-operated vehicles or equipment.',
          leftBg: rgb(0.84, 0.93, 0.86),
          rightBg: rgb(0.93, 0.97, 0.94),
        },
        {
          label: 'Scope 2: Purchased electricity',
          value: `${scope2_t.toFixed(2)} tCO2e`,
          desc: `Calculated using national grid emission factors for ${countryName} (${ef.electricity} kg CO2e per kWh).`,
          leftBg: rgb(0.84, 0.91, 0.98),
          rightBg: rgb(0.93, 0.95, 0.99),
        },
        {
          label: 'Scope 3: Selected categories',
          value: `${scope3_t.toFixed(2)} tCO2e`,
          desc: 'Scope 3 values represent only categories recorded in Greenio. This is not a complete Scope 3 inventory.',
          leftBg: rgb(0.97, 0.93, 0.84),
          rightBg: rgb(0.99, 0.97, 0.93),
        },
      ];
      const sBoxH = 54;
      const sLeftW = 148;
      const sDescX = 45 + sLeftW + 10;
      const sDescMaxW = 510 - sLeftW - 18;
      for (const sb of scopeBoxDefs) {
        page.drawRectangle({ x: 45 + sLeftW, y: y - sBoxH, width: 510 - sLeftW, height: sBoxH, color: sb.rightBg });
        page.drawRectangle({ x: 45, y: y - sBoxH, width: sLeftW, height: sBoxH, color: sb.leftBg });
        page.drawText(sb.label, { x: 52, y: y - 14, size: 8.5, font: bold, color: TEXT });
        page.drawText(sb.value, { x: 52, y: y - 32, size: 13, font: bold, color: BLUE });
        const descWords = sb.desc.split(' ');
        let descLine = '';
        let descLineY = y - 14;
        for (const dw of descWords) {
          const test = descLine ? descLine + ' ' + dw : dw;
          if (font.widthOfTextAtSize(test, 9.5) > sDescMaxW) {
            page.drawText(descLine, { x: sDescX, y: descLineY, size: 9.5, font, color: TEXT });
            descLineY -= 14;
            descLine = dw;
          } else {
            descLine = test;
          }
        }
        if (descLine) page.drawText(descLine, { x: sDescX, y: descLineY, size: 9.5, font, color: TEXT });
        y -= sBoxH + 6;
      }
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
      y: y - 10,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Emissions (tCO2e)', {
      x: 210,
      y: y - 10,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Share (%)', {
      x: 380,
      y: y - 10,
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
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage();
        y = 780;
        // Repeat table header on the new page
        page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
        page.drawText('Category',           { x: 55,  y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
        page.drawText('Emissions (tCO2e)',  { x: 210, y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
        page.drawText('Share (%)',          { x: 380, y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
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

      const catLabel = (r.category ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      page.drawText(catLabel, {
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
      page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
      page = addPage();
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
        : fuelSource === 'petrol'
          ? 'Fuel combustion (Scope 1) is the dominant emissions source. Petrol consumption indicates company vehicle use as the primary reduction lever.'
          : fuelSource === 'gas'
          ? 'Fuel combustion (Scope 1) is the dominant emissions source. Natural gas consumption for heating or process energy is the primary area for intervention.'
          : fuelSource === 'refrigerant'
          ? 'Refrigerant leakage (Scope 1 fugitive emissions) is the dominant emissions source. Equipment leaks or aging cooling systems are the primary area for intervention.'
          : 'Fuel combustion (Scope 1) is the dominant emissions source. Diesel consumption indicates generator operation, diesel vehicles or on-site equipment as the primary reduction lever.';
      const yRef = { value: y };
      paragraph(page, hotspotText, 50, 480, 11, yRef);
      y = yRef.value;
    }

    y -= 40;

    // ---- Page break guard before SECR (needs ~200px) ----
    if (y < 220) {
      page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
      page = addPage();
      y = 780;
    }

    // ---- Energy and emissions summary (table) ----
    page.drawText(isGB ? 'SECR summary' : 'Energy and emissions summary', {
      x: 50, y, size: 12, font: bold, color: TEXT,
    });
    y -= 22;

    {
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Source', { x: 55, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Value', { x: 360, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      const fuelKwhE = totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh;
      const totalEnergyE = totalElecKwh + fuelKwhE;
      const totalCO2E = scope1_t + scope2_t + scope3_t;
      const energyTableRows: Array<{ label: string; value: string; isBold?: boolean; isHighlight?: boolean }> = [
        { label: 'Electricity', value: `${Math.round(totalElecKwh).toLocaleString()} kWh` },
        { label: 'Road fuels', value: `${Math.round(fuelKwhE).toLocaleString()} kWh` },
        { label: 'Total energy', value: `${Math.round(totalEnergyE).toLocaleString()} kWh`, isBold: true },
        { label: 'Scope 1', value: `${scope1_t.toFixed(2)} tCO2e` },
        { label: 'Scope 2', value: `${scope2_t.toFixed(2)} tCO2e` },
        { label: 'Scope 3', value: `${scope3_t.toFixed(2)} tCO2e` },
        { label: 'Total GHG', value: `${totalCO2E.toFixed(2)} tCO2e`, isBold: true, isHighlight: true },
      ];
      let eShade = false;
      for (const row of energyTableRows) {
        const bg = row.isHighlight ? rgb(0.92, 0.96, 0.92) : eShade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: bg });
        page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
        page.drawText(row.label, { x: 55, y: y - 6, size: 10, font: row.isBold ? bold : font, color: TEXT });
        page.drawText(row.value, { x: 360, y: y - 6, size: 10, font: row.isBold ? bold : font, color: row.isHighlight ? BLUE : TEXT });
        eShade = !eShade;
        y -= 24;
      }
    }

    // ---- Page break guard before Intensity metrics (~155px needed) ----
    if (y < 185) {
      page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
      page = addPage();
      y = 780;
    }

    // ---- INTENSITY METRICS (table) ----
    y -= 16;

    page.drawText('Intensity metrics', {
      x: 50, y, size: 12, font: bold, color: TEXT,
    });
    y -= 22;

    {
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Metric', { x: 55, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Value', { x: 360, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      const intensityDefs: Array<{ label: string; value: string; available: boolean }> = [];
      if (empCount) {
        intensityDefs.push({ label: 'tCO2e per employee', value: `${(totalCO2kg / 1000 / empCount).toFixed(3)} tCO2e`, available: true });
      } else {
        intensityDefs.push({ label: 'tCO2e per employee', value: 'Not provided (add employee count)', available: false });
      }
      if (revenue > 0) {
        const perRevenue = totalCO2kg / 1000 / revenue;
        const perRevenueStr = perRevenue < 0.001 ? perRevenue.toExponential(3) : perRevenue.toFixed(6);
        intensityDefs.push({ label: `tCO2e per ${currencySymbol} revenue`, value: `${perRevenueStr} tCO2e / ${currencySymbol}`, available: true });
      } else {
        intensityDefs.push({ label: `tCO2e per ${currencySymbol} revenue`, value: 'Not provided (add annual revenue)', available: false });
      }
      if (outputUnits > 0) {
        const perUnit = totalCO2kg / 1000 / outputUnits;
        const perUnitStr = perUnit < 0.001 ? perUnit.toExponential(3) : perUnit.toFixed(4);
        intensityDefs.push({ label: 'tCO2e per output unit', value: `${perUnitStr} tCO2e`, available: true });
      } else {
        intensityDefs.push({ label: 'tCO2e per output unit', value: 'Not provided', available: false });
      }
      let iShade = false;
      for (const row of intensityDefs) {
        const bg = iShade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: bg });
        page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
        page.drawText(row.label, { x: 55, y: y - 6, size: 10, font, color: TEXT });
        page.drawText(row.value, { x: 360, y: y - 6, size: 9.5, font, color: row.available ? TEXT : rgb(0.5, 0.5, 0.52) });
        iShade = !iShade;
        y -= 24;
      }
    }
    // ---- FOOTER ----
    page.drawText(pgFtr(), {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
    });
    y -= 35; // spacing before Page 4

    // ========================= PAGE 4 =========================
    page = addPage();
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

    // Build per-source content library and prioritised source list for all fuel insights/actions
    const s1TotalForPct = s1DieselCo2e + s1PetrolCo2e + s1GasCo2e + s1RefrigCo2e || 1;
    const pctOf = (v: number) => Math.round(v / s1TotalForPct * 100);
    const sigSources = ([
      { key: 'refrigerant' as FuelSource, co2e: s1RefrigCo2e },
      { key: 'diesel'      as FuelSource, co2e: s1DieselCo2e },
      { key: 'petrol'      as FuelSource, co2e: s1PetrolCo2e },
      { key: 'gas'         as FuelSource, co2e: s1GasCo2e    },
    ]).filter(s => s.co2e / s1TotalForPct >= 0.05).sort((a, b) => b.co2e - a.co2e);

    const srcLib: Record<FuelSource, { name: string; operational: string; longTerm: string; action: string; immediate: string; medTerm: string }> = {
      refrigerant: {
        name: 'refrigerant leakage',
        operational: 'refrigerant leakage is typically caused by equipment age, inadequate maintenance or under-inspected HVAC systems. It is often invisible without active monitoring',
        longTerm: 'phase out high-GWP refrigerants, transition to natural or lower-impact alternatives and implement a refrigerant lifecycle management programme',
        action: 'Commission a refrigerant leak audit across all cooling and HVAC equipment and implement a log tracking all purchases, top-ups and disposals.',
        immediate: 'Schedule a certified refrigerant leak detection survey and record top-up volumes per unit to identify the worst offenders.',
        medTerm: 'Develop an equipment replacement roadmap prioritising units with the highest leak rates or oldest high-GWP refrigerant profiles.',
      },
      diesel: {
        name: 'diesel combustion',
        operational: 'diesel combustion from vehicles, generators or on-site equipment, where usage patterns, run-hours and maintenance practices drive most of this impact',
        longTerm: 'reduce diesel dependency through usage tracking, cleaner backup power alternatives and a phased vehicle electrification plan',
        action: 'Audit diesel consumption to identify whether usage originates from vehicles, generators or equipment, then set reduction targets for each category.',
        immediate: 'Begin logging diesel consumption and generator run-hours monthly to establish a reliable baseline.',
        medTerm: 'Evaluate battery UPS or solar-plus-storage as cleaner backup power alternatives and assess EV options for any diesel vehicles.',
      },
      petrol: {
        name: 'petrol combustion',
        operational: 'petrol combustion from company vehicles, where journey frequency, routing efficiency and driver behaviour are the primary variables',
        longTerm: 'electrify the company vehicle fleet through a managed, phased transition plan',
        action: 'Introduce a journey approval and mileage tracking policy to eliminate unnecessary vehicle trips and reduce petrol consumption.',
        immediate: 'Set monthly fuel consumption targets per vehicle and review actual usage patterns against them.',
        medTerm: 'Design an EV transition roadmap for company vehicles, prioritising highest-mileage units first.',
      },
      gas: {
        name: 'natural gas combustion',
        operational: 'natural gas combustion for heating or process energy, where building thermal efficiency and equipment performance are the key variables',
        longTerm: 'phase out gas-based heating through heat pump adoption, improved building fabric and, where viable, renewable gas alternatives',
        action: 'Commission a boiler and heating system audit to assess efficiency ratings and replacement viability.',
        immediate: 'Review gas consumption by month to identify seasonal peaks and optimise boiler controls for current occupancy levels.',
        medTerm: 'Evaluate heat pump suitability for your building type and commission insulation upgrades where the return justifies investment.',
      },
    };

    // Insight 1 — comprehensive breakdown of ALL significant Scope 1 sources
    {
      let i1Text: string;
      if (dominant === 'fuel') {
        const parts = sigSources.map(s => `${srcLib[s.key].name} (${pctOf(s.co2e)}%)`);
        const breakdown = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] ?? 'fuel combustion';
        i1Text = `Scope 1 (direct) emissions are driven by ${breakdown}. ${sigSources.length > 1 ? 'Each source represents a distinct reduction opportunity and should be addressed in priority order.' : 'This is the primary area for intervention.'}`;
      } else if (dominant === 'electricity') {
        i1Text = 'Electricity consumption accounts for the largest emissions share, indicating that facilities, equipment and operational hours drive most carbon intensity.';
      } else {
        i1Text = 'Scope 3 activities represent the dominant emissions contributors, indicating upstream supply chain processes and purchased goods have the strongest influence on organisational carbon impact.';
      }
      const yRef = { value: y };
      paragraphText(page, font, TEXT, i1Text, yRef);
      y = yRef.value;
    }

    // Insight 2 — operational implications of the top two sources
    {
      let i2Text: string;
      if (dominant === 'fuel') {
        const top2 = sigSources.slice(0, 2).map(s => srcLib[s.key].operational);
        i2Text = top2.length === 1
          ? `The emissions reflect ${top2[0]}.`
          : `The emissions profile reflects ${top2[0]}, alongside ${top2[1]}.`;
      } else if (dominant === 'electricity') {
        i2Text = 'Electricity-driven emissions suggest opportunities in equipment efficiency, load control, heating and cooling optimisation and facility utilisation.';
      } else {
        i2Text = 'A Scope 3-heavy profile highlights the need for deeper supplier engagement, data collection and value-chain transparency to build a complete emissions baseline.';
      }
      const yRef = { value: y };
      paragraphText(page, font, TEXT, i2Text, yRef);
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

    // Insight 4 — long-term decarbonisation covering all significant sources
    {
      let i4Text: string;
      if (dominant === 'fuel') {
        const top2lt = sigSources.slice(0, 2).map(s => srcLib[s.key].longTerm);
        i4Text = `Long-term decarbonisation will require a multi-strand approach: ${top2lt.join('; and ')}.`;
      } else if (dominant === 'electricity') {
        i4Text = 'Strategic reductions will require integrated energy-efficiency planning, equipment upgrades and a shift towards renewable or lower-carbon electricity procurement.';
      } else {
        i4Text = 'Meaningful reductions require supply-chain collaboration, sustainability requirements in procurement, data transparency and prioritisation of high-impact suppliers.';
      }
      const yRef = { value: y };
      paragraphText(page, font, TEXT, i4Text, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---------------- TOP 3 RECOMMENDED ACTIONS (table) ----------------
    page.drawText('Top 3 recommended actions', {
      x: 50, y, size: 12, font: bold, color: TEXT,
    });
    y -= 22;

    // Top 3 actions — one per significant source, ranked by CO2e contribution
    let actions: string[];
    if (dominant === 'fuel') {
      actions = sigSources.slice(0, 3).map(s => srcLib[s.key].action);
      while (actions.length < 3) actions.push('Strengthen monthly emissions data logging to build a complete baseline for year-on-year tracking and future target-setting.');
    } else if (dominant === 'electricity') {
      actions = [
        'Conduct a full energy-efficiency assessment of facility equipment, lighting and HVAC performance.',
        'Introduce automated controls or smart-metering analytics to reduce off-peak and baseload consumption.',
        'Explore equipment upgrades and renewable-electricity procurement for sustained long-term reductions.',
      ];
    } else {
      actions = [
        'Expand Scope 3 data capture across upstream procurement, waste, logistics and downstream activities.',
        'Engage strategic suppliers to build shared data-transparency processes and reduction initiatives.',
        'Embed sustainability requirements into procurement frameworks to influence supply-chain emissions.',
      ];
    }

    {
      const AMBER_ACT = rgb(218 / 255, 128 / 255, 0 / 255);
      const actImpacts = ['High', 'Medium', 'Medium'];
      const actColNum = 55, actColAct = 88, actColImp = 460, actMaxW = 360;

      // Table header — BLACK, matching all other tables
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      page.drawText('#', { x: actColNum, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Action', { x: actColAct, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Impact', { x: actColImp, y: y - 10, size: 10, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      let aShade = false;
      for (let ai = 0; ai < actions.length; ai++) {
        // Wrap action text within action column
        const words = actions[ai].split(' ');
        const aLines: string[] = [];
        let aLine = '';
        for (const w of words) {
          const test = aLine ? aLine + ' ' + w : w;
          if (font.widthOfTextAtSize(test, 10) > actMaxW) { if (aLine) aLines.push(aLine); aLine = w; } else { aLine = test; }
        }
        if (aLine) aLines.push(aLine);

        const rowH = Math.max(22, aLines.length * 14 + 8);
        const bg = aShade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: 45, y: y - rowH, width: 510, height: rowH, color: bg });
        page.drawLine({ start: { x: 45, y: y - rowH }, end: { x: 555, y: y - rowH }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });

        const midY = y - Math.round(rowH / 2) + 3;
        page.drawText(String(ai + 1), { x: actColNum, y: midY, size: 10, font, color: TEXT });

        const textStartY = y - Math.round((rowH - aLines.length * 14) / 2) - 10;
        for (let li = 0; li < aLines.length; li++) {
          page.drawText(aLines[li], { x: actColAct, y: textStartY - li * 14, size: 10, font, color: TEXT });
        }

        const impColor = actImpacts[ai] === 'High' ? BLUE : AMBER_ACT;
        page.drawText(actImpacts[ai], { x: actColImp, y: midY, size: 10, font: bold, color: impColor });

        aShade = !aShade;
        y -= rowH;
      }
    }

    y -= 24;

    // ---------------- IMMEDIATE ACTIONS ----------------
    page.drawText('Immediate actions (0–6 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    // Immediate actions — top 2 significant sources
    let imm: string[];
    if (dominant === 'fuel') {
      imm = sigSources.slice(0, 2).map(s => srcLib[s.key].immediate);
      if (imm.length < 2) imm.push('Ensure all fuel and refrigerant consumption is logged monthly to maintain data quality.');
    } else if (dominant === 'electricity') {
      imm = ['Analyse peak-load consumption to identify avoidable energy spikes.', 'Introduce equipment-shutdown and low-activity control routines.'];
    } else {
      imm = ['Expand Scope 3 activity-data collection to improve baseline accuracy.', 'Engage top suppliers to establish emissions-data submission processes.'];
    }

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

    // Medium-term — top 2 significant sources
    let med: string[];
    if (dominant === 'fuel') {
      med = sigSources.slice(0, 2).map(s => srcLib[s.key].medTerm);
      if (med.length < 2) med.push('Explore renewable energy procurement or Power Purchase Agreements (PPAs) to reduce site-level fossil fuel dependency.');
    } else if (dominant === 'electricity') {
      med = [
        'Upgrade to high-efficiency equipment and explore advanced building-management systems.',
        'Evaluate on-site renewable generation or longer-term renewable-electricity contracts.',
      ];
    } else {
      med = [
        'Develop a supplier-focused decarbonisation roadmap prioritising high-impact categories.',
        'Integrate emissions-scoring into procurement decisions to incentivise lower-carbon options.',
      ];
    }

    for (const a of med) {
      const yRef = { value: y };
      paragraphText(page, font, TEXT, a, yRef);
      y = yRef.value;
    }

    // ---- FOOTER ----
    page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });

    // ========================= PAGE 5 =========================
page = addPage();

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
  'The primary intensity ratio is tCO2e per employee, as it reflects organisational activity. These include tCO2e per revenue unit and tCO2e per output unit.',
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
page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
// ========================= PAGE 6 (Emission Factors Appendix) =========================
page = addPage();
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
page.drawText('Scope 1: Direct emissions factors (fuel combustion)', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

page.drawText(`Diesel: ${ef.diesel} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`Petrol: ${ef.petrol} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`LPG: ${ef.lpg.toFixed(3)} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 15;
page.drawText(`Natural gas: ${ef.gas.toFixed(4)} kg CO2e per kWh`, { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// --------------------------- SCOPE 2 ---------------------------
page.drawText('Scope 2: Purchased electricity (location-based)', {
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
page.drawText('Scope 3: Selected categories', {
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
page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });


    // ========================= PAGE 7 — BRSR Disclosure Summary (India only) =========================
    if (countryCode === 'IN') {
      page = addPage();
      y = 780;

      const AMBER_BADGE = rgb(218 / 255, 128 / 255, 0 / 255);
      const BTL = 45;
      const BTW = 510;
      const BC1 = 55;
      const BC2 = 325;  // value col start
      const BC3 = 455;  // badge col start
      const BADGE_W = 90;

      // Pre-computed BRSR values
      const bFuelKwh = totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh;
      const bTotalEnergyKwh = totalElecKwh + bFuelKwh;
      const bTotalEnergyGJ = bTotalEnergyKwh * 0.0036;
      const bTotalCO2t = scope1_t + scope2_t + scope3_t;
      const bGhgPerRev = revenue > 0 ? bTotalCO2t / revenue : null;
      const bEnergyPerRev = revenue > 0 ? bTotalEnergyGJ / revenue : null;
      const bGhgPerEmp = empCount > 0 ? bTotalCO2t / empCount : null;
      const bEnergyPerEmp = empCount > 0 ? bTotalEnergyGJ / empCount : null;
      const bFmtI = (v: number) => v < 0.0001 ? v.toExponential(3) : v.toFixed(8);

      // Word-wrap helper (shared for indicator and value columns)
      const bWrap = (text: string, maxW: number, sz: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (font.widthOfTextAtSize(test, sz) > maxW) {
            if (cur) lines.push(cur);
            cur = w;
          } else { cur = test; }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      // Page-break guard
      const bEnsure = (needed: number) => {
        if (y < 50 + needed) {
          page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
          page = addPage();
          y = 780;
        }
      };

      // Group header — uses BLUE (Greenio green) to match report accent, same feel as scope boxes
      const bGroupHdr = (text: string) => {
        bEnsure(50);
        page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: BLUE });
        page.drawText(text, { x: BC1, y: y - 6, size: 8.5, font: bold, color: rgb(1, 1, 1) });
        y -= 26;
      };

      // Data row — notes rendered INSIDE the row background rect (no floating text)
      const bRow = (indicator: string, value: string, auto: boolean, note?: string) => {
        const SZ = 8.5;
        const NOTE_SZ = 7.5;
        const NOTE_LH = 11;
        const indLines = bWrap(indicator, BC2 - BC1 - 8, SZ);
        const valLines = bWrap(value, BC3 - BC2 - 8, SZ);
        const mainH = Math.max(22, Math.max(indLines.length, valLines.length) * 13 + 8);
        const noteLines = note ? bWrap(note, 230, NOTE_SZ) : [];  // 230pt forces 2-line wrap for long notes
        const rowH = mainH + (noteLines.length > 0 ? noteLines.length * NOTE_LH + 6 : 0);
        bEnsure(rowH + 4);

        // Full row rect (includes note area)
        const rowBg = auto ? rgb(0.97, 0.99, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: BTL, y: y - rowH, width: BTW, height: rowH, color: rowBg });
        page.drawLine({ start: { x: BTL, y: y - rowH }, end: { x: BTL + BTW, y: y - rowH }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });

        // Indicator lines — vertically centred within mainH
        const indStartY = y - Math.round((mainH - indLines.length * 13) / 2) - 10;
        for (let li = 0; li < indLines.length; li++) {
          page.drawText(indLines[li], { x: BC1, y: indStartY - li * 13, size: SZ, font, color: TEXT });
        }

        // Value lines — vertically centred within mainH
        const valColor = auto ? BLUE : rgb(0.5, 0.5, 0.52);
        const valStartY = y - Math.round((mainH - valLines.length * 13) / 2) - 10;
        for (let vi = 0; vi < valLines.length; vi++) {
          page.drawText(valLines[vi], { x: BC2, y: valStartY - vi * 13, size: SZ, font: auto ? bold : font, color: valColor });
        }

        // Badge — vertically centred within mainH
        const badgeY = y - Math.round(mainH / 2) - 7;
        page.drawRectangle({ x: BC3, y: badgeY, width: BADGE_W, height: 14, color: auto ? BLUE : AMBER_BADGE });
        const badgeStr = auto ? 'Auto-filled' : 'Needs input';
        const badgeStrW = bold.widthOfTextAtSize(badgeStr, 7.5);
        page.drawText(badgeStr, { x: BC3 + Math.round((BADGE_W - badgeStrW) / 2), y: badgeY + 3, size: 7.5, font: bold, color: rgb(1, 1, 1) });

        // Note lines — drawn INSIDE the row rect, below the main content area
        if (noteLines.length > 0) {
          let noteY = y - mainH - 9;
          for (const nl of noteLines) {
            page.drawText(nl, { x: BC1 + 4, y: noteY, size: NOTE_SZ, font, color: rgb(0.5, 0.5, 0.52) });
            noteY -= NOTE_LH;
          }
        }

        y -= rowH + 2;
      };

      // ---- PAGE HEADER — matches all other section pages ----
      page.drawText('7. BRSR Disclosure Summary', { x: 50, y, size: 18, font: bold, color: TEXT });
      page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: BLUE });
      y -= 28;
      page.drawText('SEBI BRSR | Essential Indicators (auto-populated from Greenio data)', { x: 50, y, size: 10, font, color: rgb(0.45, 0.45, 0.47) });
      y -= 22;

      // Intro text — inline draw to avoid closure color ambiguity
      {
        const bDark = rgb(0.15, 0.15, 0.17);
        const introStr = 'The following disclosures are formatted in accordance with SEBI\'s Business Responsibility and Sustainability Report (BRSR) framework. Values are auto-populated directly from Greenio data. Fields marked "Needs input" require additional input from your organisation.';
        const introWords2 = introStr.split(' ');
        let introLine2 = '';
        for (const iw of introWords2) {
          const test = introLine2 ? introLine2 + ' ' + iw : iw;
          if (font.widthOfTextAtSize(test, 10) > 495) {
            page.drawText(introLine2.trim(), { x: 50, y, size: 10, font, color: bDark });
            y -= 15;
            introLine2 = iw;
          } else { introLine2 = test; }
        }
        if (introLine2.trim()) { page.drawText(introLine2.trim(), { x: 50, y, size: 10, font, color: bDark }); y -= 15; }
        y -= 10;
      }

      // Column headers — BLACK, matching all other tables in the report
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0, 0, 0) });
      page.drawText('BRSR Essential Indicator', { x: BC1, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Disclosed Value', { x: BC2, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Status', { x: BC3 + 15, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      // ===== GHG EMISSIONS =====
      bGroupHdr('Principle 6 | Environment: GHG Emissions (Essential Indicators)');
      bRow('Total Scope 1 emissions (metric tonnes CO2e)', `${scope1_t.toFixed(2)} tCO2e`, true);
      bRow('Total Scope 2 emissions (metric tonnes CO2e)', `${scope2_t.toFixed(2)} tCO2e`, true);
      bRow('Total Scope 3 emissions: selected categories (metric tonnes CO2e)', `${scope3_t.toFixed(2)} tCO2e`, true, 'Scope 3 is partial. Full value-chain inventory recommended for BRSR Core.');
      bRow('Total GHG emissions, Scope 1+2+3 (metric tonnes CO2e)', `${bTotalCO2t.toFixed(2)} tCO2e`, true);
      if (bGhgPerRev !== null) {
        bRow('GHG emission intensity per rupee of turnover (tCO2e / INR)', `${bFmtI(bGhgPerRev)} tCO2e / INR`, true, 'Update revenue to INR in your profile for highest accuracy.');
      } else {
        bRow('GHG emission intensity per rupee of turnover (tCO2e / INR)', 'Not calculable', false, 'Add annual revenue in your Greenio profile to auto-calculate.');
      }
      if (bGhgPerEmp !== null) {
        bRow('GHG emission intensity per employee (tCO2e / employee)', `${bGhgPerEmp.toFixed(3)} tCO2e / emp`, true);
      } else {
        bRow('GHG emission intensity per employee (tCO2e / employee)', 'Not calculable', false, 'Add employee headcount in your Greenio profile to auto-calculate.');
      }
      y -= 4;

      // ===== ENERGY CONSUMPTION =====
      bGroupHdr('Principle 6 | Environment: Energy Consumption (Essential Indicators)');
      bRow('Total electricity consumption (kWh)', `${Math.round(totalElecKwh).toLocaleString()} kWh`, true);
      bRow('Total fuel consumption (kWh equivalent)', `${Math.round(bFuelKwh).toLocaleString()} kWh`, true);
      bRow('Total energy consumption (kWh)', `${Math.round(bTotalEnergyKwh).toLocaleString()} kWh`, true);
      bRow('Total energy consumption (GJ)', `${bTotalEnergyGJ.toFixed(2)} GJ`, true, `Converted: ${Math.round(bTotalEnergyKwh).toLocaleString()} kWh x 0.0036 = ${bTotalEnergyGJ.toFixed(2)} GJ`);
      if (bEnergyPerRev !== null) {
        bRow('Energy intensity per rupee of turnover (GJ / INR)', `${bFmtI(bEnergyPerRev)} GJ / INR`, true);
      } else {
        bRow('Energy intensity per rupee of turnover (GJ / INR)', 'Not calculable', false, 'Add annual revenue in your Greenio profile.');
      }
      if (bEnergyPerEmp !== null) {
        bRow('Energy intensity per employee (GJ / employee)', `${bEnergyPerEmp.toFixed(3)} GJ / emp`, true);
      } else {
        bRow('Energy intensity per employee (GJ / employee)', 'Not calculable', false, 'Add employee headcount in your Greenio profile.');
      }
      y -= 8;

      // ===== WATER, WASTE AND AIR =====
      const bHasWater = brsrWaterTotal > 0;
      const bHasWaste = brsrWasteTotal > 0;
      const bHasAir = !!brsrLatestAir;
      const bHasGhgPlan = !!brsrExtraProfile?.has_ghg_reduction_plan;
      const bRenewElec = brsrExtraProfile?.renewable_elec_pct ?? null;
      const bHasRenew = bRenewElec != null && Number(bRenewElec) > 0;

      bEnsure(160);
      bGroupHdr('Principle 6 | Environment: Water, Waste and Air Emissions');
      bRow('Total water withdrawal (kL)', bHasWater ? `${brsrWaterTotal.toLocaleString()} kL` : 'Not provided', bHasWater, bHasWater ? undefined : 'Enter water consumption data in the Add Emissions form to auto-populate.');
      bRow('Total waste generated (kg)', bHasWaste ? `${brsrWasteTotal.toLocaleString()} kg` : 'Not provided', bHasWaste, bHasWaste ? undefined : 'Enter waste disposal data in the Add Emissions form to auto-populate.');
      bRow('Air emissions: NOx, SOx, PM (tonnes)', bHasAir ? `NOx ${brsrLatestAir!.nox_tonnes ?? 0} t, SOx ${brsrLatestAir!.sox_tonnes ?? 0} t, PM ${brsrLatestAir!.pm_tonnes ?? 0} t` : 'Not provided', bHasAir, bHasAir ? undefined : 'Enter annual air emissions data in the Add Emissions form to auto-populate.');
      y -= 8;

      // ===== ADDITIONAL DISCLOSURES =====
      bEnsure(200);
      bGroupHdr('Principle 6 | Environment: Additional Disclosures');
      bRow('GHG emission reduction projects (Y/N)', bHasGhgPlan ? 'Yes' : 'Not provided', bHasGhgPlan, bHasGhgPlan ? undefined : 'Declare any emission-reduction projects, fleet transitions, or renewable energy initiatives.');
      bRow('Percentage of renewable energy in total energy mix (%)', bHasRenew ? `${bRenewElec}%` : 'Not provided', bHasRenew, bHasRenew ? undefined : 'Add renewable electricity data to your Greenio account.');
      bRow('Scope of reporting (operational boundary)', 'India (operational control)', true);
      const bMethStr = methodologyConfirmed ? 'Confirmed (DEFRA 2025 / CEA 2026 / IPCC AR6)' : 'Not confirmed';
      bRow('Emission calculation methodology confirmed by organisation', bMethStr, methodologyConfirmed, methodologyConfirmed ? undefined : 'Confirm your calculation methodology in your Greenio profile.');
      y -= 12;

      // ===== BRSR COMPLETENESS SCORECARD =====
      bEnsure(220);
      page.drawText('BRSR Completeness Scorecard', { x: 50, y, size: 12, font: bold, color: TEXT });
      y -= 22;

      const bGhgAuto = 4 + (bGhgPerRev !== null ? 1 : 0) + (bGhgPerEmp !== null ? 1 : 0);
      const bEnergyAuto = 4 + (bEnergyPerRev !== null ? 1 : 0) + (bEnergyPerEmp !== null ? 1 : 0);
      const bWwaAuto = (bHasWater ? 1 : 0) + (bHasWaste ? 1 : 0) + (bHasAir ? 1 : 0);
      const bAddlAuto = 1 + (methodologyConfirmed ? 1 : 0) + (bHasGhgPlan ? 1 : 0) + (bHasRenew ? 1 : 0);
      const bOverallAuto = bGhgAuto + bEnergyAuto + bAddlAuto + bWwaAuto;
      const bOverallTotal = 19; // +3 for Water, Waste, Air

      // Scorecard table header — BLACK, matching all other tables
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Indicator group', { x: BC1, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Auto-filled', { x: 310, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Needs input', { x: 388, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Completeness', { x: 462, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      let bScoreShade = false;
      const bScoreRow = (group: string, auto: number, total: number) => {
        const pct = Math.round(auto / total * 100);
        const bg = bScoreShade ? rgb(0.96, 0.96, 0.97) : rgb(0.99, 0.99, 1);
        bScoreShade = !bScoreShade;
        page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: bg });
        page.drawLine({ start: { x: BTL, y: y - 18 }, end: { x: BTL + BTW, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
        page.drawText(group, { x: BC1, y: y - 7, size: 9, font, color: TEXT });
        page.drawText(`${auto} / ${total}`, { x: 320, y: y - 7, size: 9, font, color: TEXT });
        page.drawText(`${total - auto} / ${total}`, { x: 398, y: y - 7, size: 9, font, color: TEXT });
        const pctColor = pct >= 80 ? BLUE : pct >= 50 ? AMBER_BADGE : rgb(0.72, 0.15, 0.05);
        page.drawText(`${pct}%`, { x: 487, y: y - 7, size: 9, font: bold, color: pctColor });
        y -= 24;
      };
      bScoreRow('GHG Emissions (Scope 1, 2, 3)', bGhgAuto, 6);
      bScoreRow('Energy Consumption', bEnergyAuto, 6);
      bScoreRow('Water, Waste and Air', bWwaAuto, 3);
      bScoreRow('Additional disclosures', bAddlAuto, 4);

      // Overall row — light green highlight (matches "Total GHG" row in energy table)
      const bOverallPct = Math.round(bOverallAuto / bOverallTotal * 100);
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0.92, 0.96, 0.92) });
      page.drawLine({ start: { x: BTL, y: y - 18 }, end: { x: BTL + BTW, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
      page.drawText('Overall BRSR Essential Indicators', { x: BC1, y: y - 7, size: 9, font: bold, color: TEXT });
      page.drawText(`${bOverallAuto} / ${bOverallTotal}`, { x: 320, y: y - 7, size: 9, font: bold, color: TEXT });
      page.drawText(`${bOverallTotal - bOverallAuto} / ${bOverallTotal}`, { x: 398, y: y - 7, size: 9, font: bold, color: TEXT });
      const bOvColor = bOverallPct >= 80 ? BLUE : bOverallPct >= 50 ? AMBER_BADGE : rgb(0.72, 0.15, 0.05);
      page.drawText(`${bOverallPct}%`, { x: 487, y: y - 7, size: 10, font: bold, color: bOvColor });
      y -= 30;

      // Tip box — amber when items missing, green when 100% complete
      bEnsure(70);
      const bMissing: string[] = [];
      if (!empCount) bMissing.push('employee headcount');
      if (revenue <= 0) bMissing.push('annual revenue (INR)');
      if (!bHasWater) bMissing.push('water consumption data');
      if (!bHasWaste) bMissing.push('waste disposal data');
      if (!bHasAir) bMissing.push('air emissions (NOx/SOx/PM)');
      if (!bHasRenew) bMissing.push('renewable energy %');
      if (!bHasGhgPlan) bMissing.push('GHG reduction project declaration');
      if (!methodologyConfirmed) bMissing.push('methodology confirmation');
      const tipText = bMissing.length > 0
        ? `To reach 100% BRSR completeness: Add (${bMissing.map((m, i) => `${i + 1}) ${m}`).join(', ')}) to your Greenio profile. All remaining indicators will auto-populate in your next report.`
        : 'All BRSR Essential Indicators are complete. This report is ready for SEBI submission or disclosure.';
      const tipBgColor = bMissing.length > 0 ? rgb(0.98, 0.97, 0.88) : rgb(0.94, 0.99, 0.94);
      const tipAccentColor = bMissing.length > 0 ? AMBER_BADGE : BLUE;
      const tipTextColor = bMissing.length > 0 ? rgb(0.45, 0.35, 0) : rgb(0.1, 0.4, 0.1);
      const tipLines = bWrap(tipText, 484, 8.5);
      const tipH = tipLines.length * 13 + 16;
      page.drawRectangle({ x: BTL, y: y - tipH, width: BTW, height: tipH, color: tipBgColor });
      page.drawRectangle({ x: BTL, y: y - tipH, width: 4, height: tipH, color: tipAccentColor });
      for (let ti = 0; ti < tipLines.length; ti++) {
        page.drawText(tipLines[ti], { x: BC1 + 4, y: y - 12 - ti * 13, size: 8.5, font: ti === 0 ? bold : font, color: tipTextColor });
      }
      y -= tipH + 12;

      // Disclaimer — inline draw
      {
        const bDark = rgb(0.15, 0.15, 0.17);
        const discStr = 'This BRSR summary is based solely on data entered into Greenio and does not constitute third-party assurance. For BRSR Core (top 250 listed companies), independent assurance is required from a SEBI-registered provider.';
        const discWords = discStr.split(' ');
        let discLine = '';
        for (const dw of discWords) {
          const test = discLine ? discLine + ' ' + dw : dw;
          if (font.widthOfTextAtSize(test, 8.5) > 495) {
            page.drawText(discLine.trim(), { x: 50, y, size: 8.5, font, color: bDark });
            y -= 13;
            discLine = dw;
          } else { discLine = test; }
        }
        if (discLine.trim()) { page.drawText(discLine.trim(), { x: 50, y, size: 8.5, font, color: bDark }); y -= 13; }
      }

      // Footer
      page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
    }

    // ========================= RETURN PDF =========================
    const pdfBytes = await pdf.save();

    const safeCompany = companyName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const today = new Date();
    const fileDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const pdfFilename = `${safeCompany}-${fileDate}.pdf`;

    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
      },
    });
  } catch (err) {
    console.error('REPORT ERROR:', err);
    return new NextResponse('Failed to generate report', { status: 500 });
  }
}