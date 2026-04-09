import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';
import { getCurrencyConfig } from '@/lib/currency';
import { checkOrgRoleForUser } from '@/lib/orgAuth';

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

function paragraphTextWithBoldPrefix(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  TEXT: RGB,
  prefix: string,
  body: string,
  yRef: { value: number }
) {
  const maxWidth = 480;
  const fontSize = 11;
  const x0 = 50;
  const prefixW = boldFont.widthOfTextAtSize(prefix + ' ', fontSize);

  const words = body.split(' ').filter(w => w.length > 0);
  let firstLine = '';
  let i = 0;

  for (; i < words.length; i++) {
    const test = firstLine + words[i] + ' ';
    if (prefixW + font.widthOfTextAtSize(test, fontSize) > maxWidth) break;
    firstLine = test;
  }

  page.drawText(prefix, { x: x0, y: yRef.value, size: fontSize, font: boldFont, color: TEXT });
  if (firstLine.trim()) {
    page.drawText(firstLine.trim(), { x: x0 + prefixW, y: yRef.value, size: fontSize, font, color: TEXT });
  }
  yRef.value -= 15;

  let currentLine = '';
  for (; i < words.length; i++) {
    const test = currentLine + words[i] + ' ';
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
      page.drawText(currentLine.trim(), { x: x0, y: yRef.value, size: fontSize, font, color: TEXT });
      yRef.value -= 15;
      currentLine = words[i] + ' ';
    } else {
      currentLine = test;
    }
  }
  if (currentLine.trim()) {
    page.drawText(currentLine.trim(), { x: x0, y: yRef.value, size: fontSize, font, color: TEXT });
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

// Enterprise org role check (viewer minimum for GET)
const orgId = searchParams.get('org_id');
if (orgId) {
  const authResult = await checkOrgRoleForUser(userId, orgId, 'viewer');
  if (!authResult.ok) return new NextResponse(authResult.error, { status: authResult.status });
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


// ======================== VIEW FILTER PARAMS ========================
const viewOrgId = orgId; // already read above for auth check
const entitySiteIds = searchParams.get('entity_siteids'); // comma-separated site IDs for entity view
const viewSiteId = searchParams.get('site_id');
const entityName = searchParams.get('entity_name') ?? '';
const siteName = searchParams.get('site_name') ?? '';

// ======================== LOAD DATA ========================
let emissionsQuery = supabase
  .from('emissions')
  .select('*')
  .order('month', { ascending: true });

if (viewOrgId && entitySiteIds !== null) {
  // Entity view: filter by site IDs belonging to the entity
  const siteIdList = entitySiteIds.split(',').filter(Boolean);
  if (siteIdList.length > 0) {
    emissionsQuery = emissionsQuery.in('site_id', siteIdList) as any;
  } else {
    emissionsQuery = emissionsQuery.eq('org_id', viewOrgId) as any;
  }
} else if (viewOrgId) {
  // Enterprise view: all emissions for the org
  emissionsQuery = emissionsQuery.eq('org_id', viewOrgId) as any;
} else if (viewSiteId) {
  // Site view: filter by site_id
  emissionsQuery = emissionsQuery.eq('site_id', viewSiteId) as any;
} else {
  // Individual user view (no enterprise context)
  emissionsQuery = emissionsQuery.eq('user_id', userId) as any;
}

const { data: rows, error: emissionsError } = await emissionsQuery;

// ======================== PERIOD FILTERING ========================

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

const { data: scope3Rows, error: scope3Error } = await supabase
  .from('scope3_activities')
  .select('*')
  .eq('user_id', userId)
  .order('month', { ascending: true });


if (scope3Error) {
  console.error('Scope3 load error:', scope3Error);
  return new NextResponse('Failed to load scope 3', { status: 500 });
}

// For entity/site views, attribute scope3 by month-matching (scope3 has no site_id)
const isViewFiltered = !!(viewOrgId && entitySiteIds !== null) || !!viewSiteId;
const attributedS3 = isViewFiltered && scope3Rows && rows
  ? (() => {
      const emissionMonths = new Set(rows.map((r: any) => r.month));
      return scope3Rows.filter((r: any) => emissionMonths.has(r.month));
    })()
  : (scope3Rows ?? []);

// Keep your sorting exactly the same, but use scope3Rows instead of scope3.data
const s3 = attributedS3.sort((a: any, b: any) => {
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
const [brsrProfileRes, waterEntriesRes, wasteEntriesRes, airEmissionsRes, userPlanRes] = await Promise.all([
  supabase.from('brsr_profile').select('*').eq('account_id', userId).maybeSingle(),
  supabase.from('water_entries').select('volume_withdrawn_kl').eq('account_id', userId),
  supabase.from('waste_entries').select('total_kg').eq('account_id', userId),
  supabase.from('air_emissions').select('nox_tonnes,sox_tonnes,pm_tonnes,period_year').eq('account_id', userId).order('period_year', { ascending: false }),
  supabase.from('user_plans').select('plan').eq('user_id', userId).maybeSingle(),
]);
const isEnterpriseAccount = userPlanRes.data?.plan === 'enterprise';
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
// Air emissions are annual (period_year only):pick the entry whose FY overlaps the report period
const reportStartYear = startMonth ? Number(startMonth.split('-')[0]) : 0;
const reportEndYear   = endMonth   ? Number(endMonth.split('-')[0])   : 9999;
const brsrLatestAir = (airEmissionsRes.data ?? [])
  .find((r: any) => r.period_year >= reportStartYear && r.period_year <= reportEndYear) ?? null;

// Country-aware factors
const countryCode = list[0]?.country_code ?? profile?.country ?? 'GB';
const ef = getFactorsForCountry(countryCode);

const isGB = countryCode === 'GB';
const EU_COUNTRIES_SET = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);
const isEU = EU_COUNTRIES_SET.has(countryCode);
const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy',
  ES: 'Spain', NL: 'Netherlands', PL: 'Poland', SE: 'Sweden',
  BE: 'Belgium', AT: 'Austria', IE: 'Ireland', DK: 'Denmark',
  PT: 'Portugal', IN: 'India',
};
const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;
const reportLabel = isGB ? 'SECR-ready emissions report' : isEU ? 'CSRD-aligned emissions report' : 'Carbon Footprint Report';
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
const totalLpgKg = list.reduce((s, r) => s + safe(r.lpg_kg), 0);
const totalCngKg = list.reduce((s, r) => s + safe(r.cng_kg), 0);

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
  totalGasKwh * ef.gas +
  totalLpgKg * ef.lpgKg +
  totalCngKg * ef.cngKg;

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
    safe(r.gas_kwh) * ef.gas +
    safe(r.lpg_kg) * ef.lpgKg +
    safe(r.cng_kg) * ef.cngKg;

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
    const total_kg_pre = scope1_fuel_kg + scope1_refrigerant_kg + scope2_kg + scope3_kg;
    // Individual shares for hotspot label + blurb
    const s2_share_pre  = total_kg_pre ? scope2_kg / total_kg_pre : 0;
    const s3_share_pre  = total_kg_pre ? scope3_kg / total_kg_pre : 0;
    // Individual-source dominant:for hotspot blurb and label (matches dashboard logic)
    const s1fuel_share   = total_kg_pre ? scope1_fuel_kg        / total_kg_pre : 0;
    const s1refrig_share = total_kg_pre ? scope1_refrigerant_kg / total_kg_pre : 0;
    const indivMax = Math.max(s1fuel_share, s1refrig_share, s2_share_pre, s3_share_pre);
    const hotspotDom: 'fuel' | 'electricity' | 'refrigerant' | 'scope3' =
      s2_share_pre   === indivMax ? 'electricity' :
      s3_share_pre   === indivMax ? 'scope3'       :
      s1refrig_share === indivMax ? 'refrigerant'  : 'fuel';
    const hotspotLabel = hotspotDom === 'electricity' ? 'Electricity (Scope 2)' : hotspotDom === 'scope3' ? 'Value chain (Scope 3)' : hotspotDom === 'refrigerant' ? 'Refrigerants (Scope 1)' : 'Fuels (Scope 1)';

    // Identify the dominant Scope 1 sub-source from actual logged data:purely evidence-based.
    const s1DieselCo2e  = totalDieselLitres * ef.diesel;
    const s1PetrolCo2e  = totalPetrolLitres * ef.petrol;
    const s1GasCo2e     = totalGasKwh * ef.gas;
    const s1LpgCo2e     = totalLpgKg * ef.lpgKg;
    const s1CngCo2e     = totalCngKg * ef.cngKg;
    const s1RefrigCo2e  = scope1_refrigerant_kg;
    type FuelSource = 'diesel' | 'petrol' | 'gas' | 'lpg' | 'cng' | 'refrigerant';
    const s1Breakdown: Record<FuelSource, number> = {
      diesel: s1DieselCo2e, petrol: s1PetrolCo2e, gas: s1GasCo2e,
      lpg: s1LpgCo2e, cng: s1CngCo2e, refrigerant: s1RefrigCo2e,
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

if (entityName) {
  drawText(page, `Entity:`, col1X, y, 10, font, rgb(0.45, 0.45, 0.47));
  drawText(page, entityName, col1X + 80, y, 10, font, BLACK);
  y -= 15;
}
if (siteName) {
  drawText(page, `Site:`, col1X, y, 10, font, rgb(0.45, 0.45, 0.47));
  drawText(page, siteName, col1X + 80, y, 10, font, BLACK);
  y -= 15;
}

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
// SCOPE BREAKDOWN:3-column tiles
// =========================
page.drawText('Emissions by scope', {
  x: 50, y, size: 13, font: bold, color: TEXT,
});
y -= 18;

const tileW = 156, tileH = 52, tileGap = 11;
const tileColors = [
  rgb(0.87, 0.93, 0.88),   // S1:light green
  rgb(0.86, 0.92, 0.98),   // S2:light blue
  rgb(0.96, 0.92, 0.86),   // S3:light amber
];
const tileLabels = ['Scope 1: Fuels & Refrigerants', 'Scope 2: Electricity', 'Scope 3: Value chain'];
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
  totalGasKwh +
  totalLpgKg * 12.88 +
  totalCngKg * 13.9;

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

if (revenue > 0) { drawText(page, `Annual revenue: ${currencySymbol} ${revenue.toLocaleString()}`, 50, y, 10, font, BLACK); y -= 14; }
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
        { label: 'Scope 1: Fuels & Refrigerants', value: `${((scope1_fuel_kg + scope1_refrigerant_kg) / 1000).toFixed(3)} tCO2e` },
        { label: 'Scope 2: Electricity', value: `${(scope2_kg / 1000).toFixed(3)} tCO2e` },
        { label: 'Scope 3: Value chain', value: `${scope3_t.toFixed(3)} tCO2e` },
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

    // Chart layout:leave 42px on the left for Y-axis labels
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

    // Y-axis unit label (rotated text not supported in pdf-lib:draw sideways label above)
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

    // X-axis labels:"Jan 26" format, smart skip for >6 months
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

    page.drawText('Month',                   { x: 50,  y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });
    page.drawText('Electricity (tCO2e)',     { x: 150, y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });
    page.drawText('Fuels (tCO2e)',           { x: 230, y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });
    page.drawText('Refrigerant (tCO2e)',     { x: 298, y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });
    page.drawText('Scope 3 (tCO2e)',         { x: 380, y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });
    page.drawText('Total (tCO2e)',           { x: 462, y: hY, size: 8.5, font: bold, color: rgb(1,1,1) });

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
        page.drawText('Month',                   { x: 50,  y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
        page.drawText('Electricity (tCO2e)',     { x: 150, y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
        page.drawText('Fuels (tCO2e)',           { x: 230, y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
        page.drawText('Refrigerant (tCO2e)',     { x: 298, y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
        page.drawText('Scope 3 (tCO2e)',         { x: 380, y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
        page.drawText('Total (tCO2e)',           { x: 462, y: y - 9, size: 8.5, font: bold, color: rgb(1,1,1) });
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
      const rowFuelKg   = safe(r.diesel_litres) * ef.diesel + safe(r.petrol_litres) * ef.petrol + safe(r.gas_kwh) * ef.gas + safe(r.lpg_kg) * ef.lpgKg + safe(r.cng_kg) * ef.cngKg;
      const rowRefrigKg = calcRefrigerantCo2e(safe(r.refrigerant_kg), (r.refrigerant_code as string | null) ?? 'GENERIC_HFC');
      const rowS3Kg     = scope3ByMonth.get(r.month) ?? 0;
      const rowTotal    = rowElecKg + rowFuelKg + rowRefrigKg + rowS3Kg;

      page.drawText(fmtMonth(r.month),                                { x: 50,  y: y - 5, size: 9.5, font, color: TEXT });
      page.drawText((rowElecKg / 1000).toFixed(3),                    { x: 150, y: y - 5, size: 9.5, font, color: TEXT });
      page.drawText((rowFuelKg / 1000).toFixed(3),                    { x: 230, y: y - 5, size: 9.5, font, color: TEXT });
      page.drawText((rowRefrigKg / 1000).toFixed(3),                  { x: 298, y: y - 5, size: 9.5, font, color: TEXT });
      page.drawText(rowS3Kg > 0 ? (rowS3Kg / 1000).toFixed(3) : '0', { x: 380, y: y - 5, size: 9.5, font, color: TEXT });
      page.drawText((rowTotal / 1000).toFixed(3),                     { x: 462, y: y - 5, size: 9.5, font, color: TEXT });

      y -= 24;
    }

    // Table footnote
    y -= 4;
    page.drawText('All values in tCO2e. Fuels = diesel, petrol, natural gas, LPG, CNG. Refrigerant = fugitive emissions (Scope 1).', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.52) });
    y -= 12;
    page.drawText('Total = Elec + Fuels + Refrig + Scope 3.', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.52) });
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
          label: 'Scope 1: Fuels & Refrigerants',
          value: `${scope1_t.toFixed(2)} tCO2e`,
          desc: 'Includes emissions from combustion of diesel, petrol, natural gas, LPG and CNG in company-operated vehicles or equipment, plus refrigerant fugitive emissions.',
          leftBg: rgb(0.84, 0.93, 0.86),
          rightBg: rgb(0.93, 0.97, 0.94),
        },
        {
          label: 'Scope 2: Electricity',
          value: `${scope2_t.toFixed(2)} tCO2e`,
          desc: `Calculated using national grid emission factors for ${countryName} (${ef.electricity} kg CO2e per kWh).`,
          leftBg: rgb(0.84, 0.91, 0.98),
          rightBg: rgb(0.93, 0.95, 0.99),
        },
        {
          label: 'Scope 3: Value chain',
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
    page.drawText('Scope 3: Value chain (summary)', {
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

    const s3_total_t = s3.reduce((s, r) => s + safe(r.co2e_kg), 0) / 1000;

    // Group rows by category
    const s3Groups = new Map<string, typeof s3>();
    for (const r of s3) {
      const cat = r.category ?? 'other';
      if (!s3Groups.has(cat)) s3Groups.set(cat, []);
      s3Groups.get(cat)!.push(r);
    }

    const drawS3Header = () => {
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Category',          { x: 55,  y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Emissions (tCO2e)', { x: 210, y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Share (%)',         { x: 380, y: y - 10, size: 11, font: bold, color: rgb(1, 1, 1) });
      y -= 26;
    };

    let s3AltShade = false;
    for (const [cat, rows] of Array.from(s3Groups)) {
      const catKg = rows.reduce((s: number, r: any) => s + safe(r.co2e_kg), 0);
      const catT = catKg / 1000;
      const catPct = s3_total_t ? ((catT / s3_total_t) * 100).toFixed(1) : '0';
      const catLabel = cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const hasSubRows = rows.length > 1;

      // Page overflow guard for parent row
      if (y < 80) {
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage();
        y = 780;
        drawS3Header();
      }

      // Parent row
      const parentBg = s3AltShade ? rgb(0.95, 0.95, 0.97) : rgb(0.98, 0.98, 1);
      page.drawRectangle({ x: 45, y: y - 18, width: 510, height: 22, color: parentBg });
      page.drawLine({ start: { x: 45, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
      page.drawText(catLabel,          { x: 55,  y: y - 6, size: 10, font: bold, color: TEXT });
      page.drawText(catT.toFixed(3),   { x: 210, y: y - 6, size: 10, font: bold, color: TEXT });
      page.drawText(catPct,            { x: 380, y: y - 6, size: 10, font: bold, color: TEXT });
      s3AltShade = !s3AltShade;
      y -= 24;

      // Sub-rows (only when more than one entry in this category)
      if (hasSubRows) {
        const subBg = s3AltShade ? rgb(0.97, 0.97, 0.985) : rgb(0.99, 0.99, 1);
        for (let si = 0; si < rows.length; si++) {
          const r = rows[si];
          if (y < 80) {
            page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
            page = addPage();
            y = 780;
            drawS3Header();
          }
          const rT = safe(r.co2e_kg) / 1000;
          const rPct = s3_total_t ? ((rT / s3_total_t) * 100).toFixed(1) : '0';
          const subLabel = (r.label ?? r.category ?? '').replace(/_/g, ' ');
          page.drawRectangle({ x: 45, y: y - 16, width: 510, height: 20, color: subBg });
          page.drawLine({ start: { x: 45, y: y - 16 }, end: { x: 555, y: y - 16 }, thickness: 0.2, color: rgb(0.9, 0.9, 0.92) });
          page.drawText(subLabel,         { x: 67,  y: y - 5, size: 8, font, color: rgb(0.35, 0.35, 0.38) });
          page.drawText(rT.toFixed(3),    { x: 210, y: y - 5, size: 8, font, color: rgb(0.35, 0.35, 0.38) });
          page.drawText(rPct,             { x: 380, y: y - 5, size: 8, font, color: rgb(0.35, 0.35, 0.38) });
          y -= 20;
        }
      }
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
      const hotspotText = hotspotDom === 'electricity'
        ? 'Electricity consumption is the single largest emissions source. Facilities, equipment and operational hours drive most carbon intensity.'
        : hotspotDom === 'scope3'
        ? 'Value chain activities (Scope 3) are the dominant emissions source. Upstream procurement and logistics represent the main reduction levers.'
        : hotspotDom === 'refrigerant'
        ? 'Refrigerant leakage (Scope 1 fugitive emissions) is the single largest individual emissions source. Equipment leaks or aging cooling systems are the primary area for intervention.'
        : fuelSource === 'petrol'
          ? 'Fuel combustion (Scope 1) is the dominant emissions source. Petrol consumption indicates company vehicle use as the primary reduction lever.'
          : fuelSource === 'gas'
          ? 'Fuel combustion (Scope 1) is the dominant emissions source. Natural gas consumption for heating or process energy is the primary area for intervention.'
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

      const fuelKwhE = totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh + totalLpgKg * 12.88 + totalCngKg * 13.9;
      const totalEnergyE = totalElecKwh + fuelKwhE;
      const totalCO2E = scope1_t + scope2_t + scope3_t;
      const energyTableRows: Array<{ label: string; value: string; isBold?: boolean; isHighlight?: boolean }> = [
        { label: 'Electricity', value: `${Math.round(totalElecKwh).toLocaleString()} kWh` },
        { label: 'Fuels', value: `${Math.round(fuelKwhE).toLocaleString()} kWh` },
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
        const fmtDecimal = (v: number) => { const d = Math.max(0, -Math.floor(Math.log10(v)) + 2); return v.toFixed(d); };
        const perRevenueStr = fmtDecimal(perRevenue);
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

      // Enterprise entity/site view note
      if (entityName || siteName) {
        y -= 6;
        page.drawText(
          'Note: Intensity ratios reflect the whole organisation. They are not specific to this entity/site as employee count and revenue are recorded at organisation level only.',
          { x: 55, y, size: 8, font, color: rgb(0.5, 0.5, 0.52), maxWidth: 490 }
        );
        y -= 14;
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

    // ── UNIFIED RANKED SOURCE LIST:all scopes, all sources, ordered by tCO2e ──
    const totalForPct = totalCO2kg || 1;
    const pctT = (v: number) => { const p = v / totalForPct * 100; return p > 0 && p < 0.1 ? '<0.1' : p.toFixed(1); }; // % of total
    type AllSource = 'electricity' | 'refrigerant' | 'diesel' | 'petrol' | 'gas' | 'lpg' | 'cng' | 'scope3';
    const allSourceData: Array<{ key: AllSource; co2e: number }> = ([
      { key: 'electricity' as AllSource, co2e: Number(scope2_kg)     },
      { key: 'refrigerant' as AllSource, co2e: Number(s1RefrigCo2e)  },
      { key: 'diesel'      as AllSource, co2e: Number(s1DieselCo2e)  },
      { key: 'petrol'      as AllSource, co2e: Number(s1PetrolCo2e)  },
      { key: 'gas'         as AllSource, co2e: Number(s1GasCo2e)     },
      { key: 'lpg'         as AllSource, co2e: Number(s1LpgCo2e)     },
      { key: 'cng'         as AllSource, co2e: Number(s1CngCo2e)     },
      { key: 'scope3'      as AllSource, co2e: Number(scope3_kg)     },
    ] as Array<{ key: AllSource; co2e: number }>).filter(s => s.co2e > 0).sort((a, b) => b.co2e - a.co2e);

    const allSrcLib: Record<AllSource, { name: string; scope: string; operational: string; longTermPhrase: string; action: string; immediate: string; medTerm: string }> = {
      electricity: {
        name: 'Electricity', scope: 'Scope 2',
        operational: 'electricity consumption for lighting, HVAC, equipment and IT infrastructure. Facility utilisation, equipment efficiency and operational hours are the key variables',
        longTermPhrase: 'switch to a renewable electricity tariff or PPA and invest in on-site solar generation',
        action: 'Conduct a full energy audit of facility equipment, lighting, HVAC and IT infrastructure to identify the largest consumption sources.',
        immediate: 'Analyse peak-load consumption patterns and introduce equipment-shutdown routines during low-activity periods to cut baseload.',
        medTerm: 'Upgrade to high-efficiency equipment, explore smart building-management systems, and evaluate on-site renewable generation or a green-electricity contract.',
      },
      refrigerant: {
        name: 'Refrigerant leakage', scope: 'Scope 1, fugitive',
        operational: 'fugitive emissions from cooling and HVAC systems. Equipment age, maintenance frequency and refrigerant type are the primary variables',
        longTermPhrase: 'phase out high-GWP refrigerants and adopt low-impact alternatives',
        action: 'Commission a refrigerant leak audit across all cooling and HVAC equipment and implement a log tracking all top-ups and disposals.',
        immediate: 'Schedule a certified leak detection survey and record top-up volumes per unit to identify the worst offenders.',
        medTerm: 'Develop an equipment replacement roadmap prioritising units with the highest leak rates or oldest high-GWP refrigerant profiles.',
      },
      diesel: {
        name: 'Diesel combustion', scope: 'Scope 1',
        operational: 'diesel combustion from vehicles, generators or on-site equipment. Usage patterns, run-hours and maintenance practices drive most of this impact',
        longTermPhrase: 'electrify diesel vehicles and replace generators with solar-plus-storage',
        action: 'Audit diesel consumption by source (vehicles, generators or equipment) and set monthly reduction targets for each category.',
        immediate: 'Begin logging diesel consumption and generator run-hours monthly to establish a reliable baseline.',
        medTerm: 'Evaluate battery UPS or solar-plus-storage as cleaner backup power alternatives and assess EV options for diesel vehicles.',
      },
      petrol: {
        name: 'Petrol combustion', scope: 'Scope 1',
        operational: 'petrol combustion from company vehicles. Journey frequency, route efficiency and vehicle age determine most of the impact',
        longTermPhrase: 'electrify the fleet aligned with lease renewal cycles',
        action: 'Introduce a journey approval and mileage tracking policy to eliminate unnecessary trips and reduce petrol consumption.',
        immediate: 'Begin recording petrol consumption by vehicle monthly to establish a clear usage baseline.',
        medTerm: 'Assess EV suitability for highest-mileage vehicles and evaluate whether a salary-sacrifice EV scheme would accelerate fleet transition.',
      },
      gas: {
        name: 'Natural gas combustion', scope: 'Scope 1',
        operational: 'natural gas combustion for heating or process energy. Building thermal efficiency and equipment performance are the key variables',
        longTermPhrase: 'replace gas heating with heat pumps and improved insulation',
        action: 'Commission a boiler and heating system audit to assess efficiency ratings and replacement viability.',
        immediate: 'Review gas consumption by month to identify seasonal peaks and optimise boiler controls for current occupancy.',
        medTerm: 'Evaluate heat pump suitability for your building type and commission insulation upgrades where the return justifies investment.',
      },
      lpg: {
        name: 'LPG combustion', scope: 'Scope 1',
        operational: 'LPG combustion for heating, cooking or on-site equipment. Cylinder consumption tracking and appliance efficiency are the primary variables',
        longTermPhrase: 'replace LPG appliances with electric or solar alternatives',
        action: 'Audit all LPG-consuming appliances and equipment to identify high-usage sources and assess electrification feasibility.',
        immediate: 'Begin tracking LPG cylinder consumption monthly by appliance or location to establish a reliable baseline.',
        medTerm: 'Evaluate electric or induction alternatives for cooking and heating applications and assess solar thermal or heat pump options.',
      },
      cng: {
        name: 'CNG combustion', scope: 'Scope 1',
        operational: 'CNG combustion from vehicles or generators. Fleet utilisation, route efficiency and maintenance standards are the primary variables',
        longTermPhrase: 'transition CNG fleet to electric as infrastructure matures',
        action: 'Map CNG consumption by vehicle or equipment type and set monthly reduction targets for each category.',
        immediate: 'Begin logging CNG fill-ups or dispenser records monthly to establish an accurate consumption baseline.',
        medTerm: 'Assess EV or electric equipment options for the highest CNG-consuming assets and model the transition economics.',
      },
      scope3: {
        name: 'Value-chain activities', scope: 'Scope 3',
        operational: 'upstream and downstream value-chain activities including employee commuting, business travel, purchased goods and waste. Activity levels and supplier choices drive emissions',
        longTermPhrase: 'build a full Scope 3 inventory and engage key suppliers on carbon targets',
        action: 'Expand Scope 3 data capture to cover all material categories (commuting, business travel, purchased goods, waste and logistics).',
        immediate: 'Survey employees on commute modes and distances to build a reliable commuting baseline.',
        medTerm: 'Develop a supplier engagement programme targeting the highest-emission procurement categories.',
      },
    };

    // ── INSIGHT 1: Analysis — top 3 dominant + bottom 2 minor sources ──
    {
      const top3 = allSourceData.slice(0, 3);
      const bottom2 = allSourceData.length > 3 ? allSourceData.slice(-2) : [];
      const top3Pct = top3.reduce((s, r) => s + r.co2e, 0) / totalForPct * 100;
      const top3Parts = top3.map(s => `${allSrcLib[s.key].name} (${pctT(s.co2e)}%)`);
      const topList = top3Parts.length > 1 ? top3Parts.slice(0, -1).join(', ') + ' and ' + top3Parts[top3Parts.length - 1] : top3Parts[0] ?? '';
      let i1Text = `${topList} together account for ${top3Pct.toFixed(0)}% of total emissions and are the priority reduction areas.`;
      if (bottom2.length > 0) {
        const botParts = bottom2.map(s => `${allSrcLib[s.key].name} (${pctT(s.co2e)}%)`);
        i1Text += ` ${botParts.join(' and ')} ${bottom2.length === 1 ? 'contributes' : 'contribute'} minimally but should not be ignored.`;
      }
      const yRef = { value: y };
      paragraphText(page, font, TEXT, i1Text, yRef);
      y = yRef.value;
    }

    // ── INSIGHT 2: Operational context for top 2 sources (one sentence each) ──
    {
      const top2 = allSourceData.slice(0, 2);
      for (const src of top2) {
        const lib = allSrcLib[src.key];
        const yRef = { value: y };
        paragraphTextWithBoldPrefix(page, font, bold, TEXT, `${lib.name} (${lib.scope}):`, lib.operational + '.', yRef);
        y = yRef.value;
      }
    }

    // ── INSIGHT 3: Trend ──
    {
      const trendBody =
        trend === 'rising'  ? 'emissions are rising, signalling increased operational load or reduced efficiency. Immediate investigation is recommended.' :
        trend === 'falling' ? 'emissions are declining, reflecting operational improvements. Continue monitoring to maintain progress.' :
                              'no consistent direction detected. Review data completeness and operational patterns.';
      const suffix = missingData ? ' Some monthly entries are incomplete or zero.' : '';
      const yRef = { value: y };
      paragraphTextWithBoldPrefix(page, font, bold, TEXT, 'Trend:', trendBody + suffix, yRef);
      y = yRef.value;
    }

    // ── INSIGHT 4: Long-term pathway for top 3 sources only ──
    {
      const phrases = allSourceData.slice(0, 3).map(s => allSrcLib[s.key].longTermPhrase);
      const i4Body = phrases.length === 1
        ? `${phrases[0]}.`
        : phrases.length === 2
          ? `${phrases[0]}, and ${phrases[1]}.`
          : `${phrases[0]}, ${phrases[1]}, and ${phrases[2]}.`;
      const yRef = { value: y };
      paragraphTextWithBoldPrefix(page, font, bold, TEXT, 'Long-term:', i4Body, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---------------- TOP 3 RECOMMENDED ACTIONS (table) ----------------
    page.drawText('Top 3 recommended actions', {
      x: 50, y, size: 12, font: bold, color: TEXT,
    });
    y -= 22;

    // One action per top-3 ranked sources across all scopes
    const actions = allSourceData.slice(0, 3).map(s => allSrcLib[s.key].action);
    while (actions.length < 3) actions.push('Strengthen monthly emissions data logging to build a complete baseline for year-on-year tracking and future target-setting.');

    {
      const AMBER_ACT = rgb(218 / 255, 128 / 255, 0 / 255);
      const actImpacts = ['High', 'Medium', 'Medium'];
      const actColNum = 55, actColAct = 88, actColImp = 460, actMaxW = 360;

      // Table header:BLACK, matching all other tables
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

    // Immediate actions:top 2 ranked sources across all scopes
    const imm = allSourceData.slice(0, 2).map(s => allSrcLib[s.key].immediate);
    if (imm.length < 2) imm.push('Ensure all emission sources are logged monthly to maintain data quality and support year-on-year comparison.');

    for (const a of imm) {
      const yRef = { value: y };
      paragraphText(page, font, TEXT, a, yRef);
      y = yRef.value;
    }

    y -= 10;

    // ---------------- MEDIUM-TERM ----------------
    // New page if not enough room for heading + 2 paragraphs
    if (y < 140) {
      page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
      page = addPage();
      y = 780;
    }
    page.drawText('Medium term opportunities (6–36 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: TEXT,
    });
    y -= 26;

    // Medium-term:top 2 ranked sources across all scopes
    const med = allSourceData.slice(0, 2).map(s => allSrcLib[s.key].medTerm);
    if (med.length < 2) med.push('Explore renewable energy procurement or on-site generation to reduce fossil fuel and grid electricity dependency.');

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
  `Emission calculations use national GHG conversion factors applicable to ${countryName} (${ef.version}). Electricity emissions use location-based grid factors and do not include market-based supplier factors. Fuel emissions use standard CO2e per-unit values (litres for diesel/petrol, kWh for natural gas, kg for LPG/CNG), and Scope 3 emissions use category-specific activity factors.`,
  yRef
);

// Paragraph 2 (updated)
paragraphText(
  page,
  font,
  TEXT,
  'Scope 1 reflects direct combustion of fuels and fugitive refrigerant emissions. Scope 2 reflects purchased electricity. Scope 3 reflects only the categories reported during this period and does not constitute a complete value-chain inventory. Data gaps may exist where Scope 3 information has not been collected.',
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
page.drawText(`All calculations use the national GHG conversion factors for ${countryName}.`, { x: 50, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText('Sources:', { x: 50, y, size: 11, font: bold, color: TEXT }); y -= 17;
for (const src of ef.version.split(' | ')) {
  page.drawText(src.trim(), { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
}
y -= 6;
page.drawText('These factors cover Scope 1, Scope 2 and Scope 3 (value chain).', { x: 50, y, size: 11, font, color: TEXT }); y -= 16;

y -= 14;

// --------------------------- SCOPE 1 ---------------------------
page.drawText('Scope 1: Direct emissions factors (fuels & refrigerants)', {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: TEXT,
});
y -= 22;

page.drawText(`Diesel: ${ef.diesel} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText(`Petrol: ${ef.petrol} kg CO2e per litre`, { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText(`Natural gas / PNG: ${ef.gas.toFixed(4)} kg CO2e per kWh`, { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
const lpgCngSrc = countryCode === 'IN' ? 'IPCC 2019 / BEE India' : 'DEFRA 2025';
page.drawText(`LPG: ${ef.lpgKg.toFixed(2)} kg CO2e per kg (${lpgCngSrc})`, { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText(`CNG: ${ef.cngKg.toFixed(2)} kg CO2e per kg (${lpgCngSrc})`, { x: 60, y, size: 11, font, color: TEXT }); y -= 24;
page.drawText('Refrigerant leakage (fugitive), GWP values per IPCC AR6:', { x: 60, y, size: 11, font: bold, color: TEXT }); y -= 17;
page.drawText('R-410A: 2,088 kg CO2e per kg', { x: 70, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('R-32: 675 kg CO2e per kg',      { x: 70, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('R-134A: 1,430 kg CO2e per kg',  { x: 70, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('R-407C: 1,774 kg CO2e per kg',  { x: 70, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('R-404A: 3,922 kg CO2e per kg',  { x: 70, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Generic HFC: 1,650 kg CO2e per kg', { x: 70, y, size: 11, font, color: TEXT }); y -= 30;

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

// --------------------------- ENERGY CONVERSION ---------------------------
y -= 10;
page.drawText(`Energy conversion factors${isGB ? ' (SECR requirement)' : ''}`, {
  x: 50, y, size: 12, font: bold, color: TEXT,
});
y -= 22;
page.drawText('Diesel: 10.9 kWh per litre', { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText('Petrol: 9.4 kWh per litre',  { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText('LPG: 12.88 kWh per kg',      { x: 60, y, size: 11, font, color: TEXT }); y -= 17;
page.drawText('CNG: 13.9 kWh per kg',       { x: 60, y, size: 11, font, color: TEXT }); y -= 25;

// Always start Scope 3 on a new page
page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
page = addPage();
y = 780;

// --------------------------- SCOPE 3 ---------------------------
page.drawText('Scope 3: Value chain', {
  x: 50, y, size: 12, font: bold, color: TEXT,
});
y -= 30;

// Business Travel
page.drawText('Business travel factors:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 20;
page.drawText('Car (diesel): 0.171 kg CO2e per km',   { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Car (petrol): 0.140 kg CO2e per km',   { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Taxi: 0.153 kg CO2e per km',           { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Rail: 0.036 kg CO2e per km',           { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Domestic flight: 0.254 kg CO2e per km',{ x: 60, y, size: 11, font, color: TEXT }); y -= 30;

// Employee commuting
page.drawText('Employee commuting:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 20;
page.drawText('Average commuter: 0.109 kg CO2e per km', { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Car (unspecified): 0.163 kg CO2e per km',{ x: 60, y, size: 11, font, color: TEXT }); y -= 30;

// Waste
page.drawText('Waste factors:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 20;
page.drawText('General waste to landfill: 0.466 kg CO2e per kg', { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Mixed recycling: 0.021 kg CO2e per kg',            { x: 60, y, size: 11, font, color: TEXT }); y -= 30;

// Water
page.drawText('Water supply & treatment:', { x: 50, y, size: 11, font: bold, color: TEXT });
y -= 20;
page.drawText('Water supply: 0.344 kg CO2e per m3',   { x: 60, y, size: 11, font, color: TEXT }); y -= 16;
page.drawText('Water treatment: 0.708 kg CO2e per m3',{ x: 60, y, size: 11, font, color: TEXT }); y -= 30;

// Review paragraph
{
  const yRef = { value: y };
  paragraphText(
    page, font, TEXT,
    `Emission factors are updated annually following publication of new national GHG conversion factors. Greenio automatically applies the latest factors for ${countryName} for each reporting period.`,
    yRef
  );
  y = yRef.value;
}

// Footer
page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });


    // ========================= PAGE 7:BRSR Disclosure Summary (India only) =========================
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
      const bFuelKwh = totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh + totalLpgKg * 12.88 + totalCngKg * 13.9;
      const bTotalEnergyKwh = totalElecKwh + bFuelKwh;
      const bTotalEnergyGJ = bTotalEnergyKwh * 0.0036;
      const bTotalCO2t = scope1_t + scope2_t + scope3_t;
      const bGhgPerRev = revenue > 0 ? bTotalCO2t / revenue : null;
      const bEnergyPerRev = revenue > 0 ? bTotalEnergyGJ / revenue : null;
      const bGhgPerEmp = empCount > 0 ? bTotalCO2t / empCount : null;
      const bEnergyPerEmp = empCount > 0 ? bTotalEnergyGJ / empCount : null;
      const bFmtI = (v: number) => { const d = Math.max(0, -Math.floor(Math.log10(v)) + 2); return v.toFixed(d); };

      // Word-wrap helper (shared for indicator and value columns)
      const bWrap = (text: string, maxW: number, sz: number, useFont?: typeof font): string[] => {
        const measureFont = useFont ?? font;
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (measureFont.widthOfTextAtSize(test, sz) > maxW) {
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

      // Group header:uses BLUE (Greenio green) to match report accent, same feel as scope boxes
      const bGroupHdr = (text: string) => {
        bEnsure(50);
        page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: BLUE });
        page.drawText(text, { x: BC1, y: y - 6, size: 8.5, font: bold, color: rgb(1, 1, 1) });
        y -= 26;
      };

      // Data row:notes rendered INSIDE the row background rect (no floating text)
      // status: 'auto' = green Auto-filled, 'disclosed' = green Disclosed (same style), 'missing' = amber Needs input
      const bRow = (indicator: string, value: string, auto: boolean, note?: string, status?: 'auto' | 'disclosed' | 'missing') => {
        const effectiveStatus = status ?? (auto ? 'auto' : 'missing');
        const isGreen = effectiveStatus === 'auto' || effectiveStatus === 'disclosed';
        const SZ = 8.5;
        const NOTE_SZ = 7.5;
        const NOTE_LH = 11;
        const indLines = bWrap(indicator, BC2 - BC1 - 8, SZ);
        const valLines = bWrap(value, BC3 - BC2 - 8, SZ, isGreen ? bold : undefined);
        const mainH = Math.max(22, Math.max(indLines.length, valLines.length) * 13 + 8);
        const noteLines = note ? bWrap(note, 230, NOTE_SZ) : [];
        const rowH = mainH + (noteLines.length > 0 ? noteLines.length * NOTE_LH + 6 : 0);
        bEnsure(rowH + 4);

        const rowBg = isGreen ? rgb(0.97, 0.99, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: BTL, y: y - rowH, width: BTW, height: rowH, color: rowBg });
        page.drawLine({ start: { x: BTL, y: y - rowH }, end: { x: BTL + BTW, y: y - rowH }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });

        const indStartY = y - Math.round((mainH - indLines.length * 13) / 2) - 10;
        for (let li = 0; li < indLines.length; li++) {
          page.drawText(indLines[li], { x: BC1, y: indStartY - li * 13, size: SZ, font, color: TEXT });
        }

        const valColor = isGreen ? BLUE : rgb(0.5, 0.5, 0.52);
        const valStartY = y - Math.round((mainH - valLines.length * 13) / 2) - 10;
        for (let vi = 0; vi < valLines.length; vi++) {
          page.drawText(valLines[vi], { x: BC2, y: valStartY - vi * 13, size: SZ, font: isGreen ? bold : font, color: valColor });
        }

        const badgeY = y - Math.round(mainH / 2) - 7;
        const badgeBg = isGreen ? BLUE : AMBER_BADGE;
        const badgeStr = effectiveStatus === 'auto' ? 'Auto-filled' : effectiveStatus === 'disclosed' ? 'Disclosed' : 'Needs input';
        page.drawRectangle({ x: BC3, y: badgeY, width: BADGE_W, height: 14, color: badgeBg });
        const badgeStrW = bold.widthOfTextAtSize(badgeStr, 7.5);
        page.drawText(badgeStr, { x: BC3 + Math.round((BADGE_W - badgeStrW) / 2), y: badgeY + 3, size: 7.5, font: bold, color: rgb(1, 1, 1) });

        if (noteLines.length > 0) {
          let noteY = y - mainH - 9;
          for (const nl of noteLines) {
            page.drawText(nl, { x: BC1 + 4, y: noteY, size: NOTE_SZ, font, color: rgb(0.5, 0.5, 0.52) });
            noteY -= NOTE_LH;
          }
        }

        y -= rowH + 2;
      };

      // ---- PAGE HEADER ----
      const brsrTitle = isEnterpriseAccount ? '7. BRSR Full Disclosure' : '7. BRSR Disclosure Summary';
      const brsrSubtitle = isEnterpriseAccount
        ? 'SEBI BRSR | Sections A, B and C'
        : 'SEBI BRSR | Essential Indicators';
      page.drawText(brsrTitle, { x: 50, y, size: 18, font: bold, color: TEXT });
      page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: BLUE });
      y -= 28;
      page.drawText(brsrSubtitle, { x: 50, y, size: 10, font, color: rgb(0.45, 0.45, 0.47) });
      y -= 22;

      {
        const bDark = rgb(0.15, 0.15, 0.17);
        const introStr = isEnterpriseAccount
          ? 'This report contains a full SEBI BRSR filing across three sections: Section A (General Disclosures), Section B (Management & Process), and Section C (Principle-wise Performance). Environment data is auto-populated from Greenio. All other data is sourced from your BRSR Company Profile.'
          : 'The following disclosures are formatted in accordance with SEBI\'s Business Responsibility and Sustainability Report (BRSR) framework. Fields marked "Needs input" require additional input from your organisation.';
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

      // ===== SECTION A + B: Enterprise only =====
      if (isEnterpriseAccount && brsrExtraProfile) {
        const bp = brsrExtraProfile as any;
        const sv = (v: any) => (v != null && v !== '') ? String(v) : 'Not provided';
        const inr = (v: any) => v != null && v !== '' ? `INR ${Number(v).toLocaleString('en-IN')}` : 'Not provided';
        const yesno = (v: any) => v ? 'Yes' : 'No';
        const pct = (v: any) => v != null && v !== '' ? `${v}%` : 'Not provided';

        // Helper: draw a two-column info row — same green bg as Section C rows, no badge
        const aRow = (label: string, value: string) => {
          const GRAY = rgb(0.45, 0.45, 0.47);
          const labelLines = bWrap(label, BC2 - BC1 - 8, 8.5);
          const valueLines = bWrap(value, BTL + BTW - BC2 - 8, 8.5, bold);
          const rowH = Math.max(22, Math.max(labelLines.length, valueLines.length) * 13 + 8);
          bEnsure(rowH + 2);
          const isProvided = value !== 'Not provided';
          page.drawRectangle({ x: BTL, y: y - rowH, width: BTW, height: rowH, color: rgb(0.97, 0.99, 0.97) });
          page.drawLine({ start: { x: BTL, y: y - rowH }, end: { x: BTL + BTW, y: y - rowH }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
          const startY = y - Math.round((rowH - labelLines.length * 13) / 2) - 10;
          for (let i = 0; i < labelLines.length; i++) page.drawText(labelLines[i], { x: BC1, y: startY - i * 13, size: 8.5, font, color: GRAY });
          const valStartY = y - Math.round((rowH - valueLines.length * 13) / 2) - 10;
          for (let i = 0; i < valueLines.length; i++) page.drawText(valueLines[i], { x: BC2, y: valStartY - i * 13, size: 8.5, font: bold, color: isProvided ? BLUE : rgb(0.7, 0.7, 0.72) });
          y -= rowH + 2;
        };

        // Sub-header — identical to bGroupHdr (BLUE bg, white text)
        const aSecHdr = (title: string) => {
          bEnsure(50);
          page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: BLUE });
          page.drawText(title, { x: BC1, y: y - 6, size: 8.5, font: bold, color: rgb(1, 1, 1) });
          y -= 26;
        };

        // ---- SECTION A: flows directly after intro ----
        bEnsure(300);
        page.drawText('Section A: General Disclosures', { x: 50, y, size: 14, font: bold, color: TEXT });
        page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.8, color: BLUE });
        y -= 26;

        aSecHdr('I. Entity Details');
        aRow('Corporate Identity Number (CIN)', sv(bp.cin));
        aRow('Year of incorporation', sv(bp.year_of_incorporation));
        aRow('Registered office address', sv(bp.registered_office_address));
        aRow('Company website', sv(bp.company_website));
        aRow('Paid-up capital', inr(bp.paid_up_capital_inr));
        aRow('Stock exchange listing', sv(bp.stock_exchange));
        aRow('Reporting boundary', sv(bp.reporting_boundary));
        y -= 6;

        aSecHdr('BRSR Contact Person');
        aRow('Name', sv(bp.brsr_contact_name));
        aRow('Designation', sv(bp.brsr_contact_designation));
        aRow('Email', sv(bp.brsr_contact_email));
        aRow('Phone', sv(bp.brsr_contact_phone));
        y -= 6;

        aSecHdr('II. Workforce Composition');
        aRow('Male permanent employees', sv(bp.male_permanent_employees));
        aRow('Female permanent employees', sv(bp.female_permanent_employees));
        aRow('Differently abled employees', sv(bp.differently_abled_employees));
        const womenBoardPct = bp.women_on_board != null && bp.total_board_members > 0
          ? `${bp.women_on_board} of ${bp.total_board_members} (${Math.round(bp.women_on_board / bp.total_board_members * 100)}%)`
          : 'Not provided';
        aRow('Women on Board of Directors', womenBoardPct);
        const womenKmpPct = bp.women_in_kmp != null && bp.total_kmp > 0
          ? `${bp.women_in_kmp} of ${bp.total_kmp} (${Math.round(bp.women_in_kmp / bp.total_kmp * 100)}%)`
          : 'Not provided';
        aRow('Women in Key Management Personnel', womenKmpPct);
        y -= 6;

        aSecHdr('III. Markets & Operations');
        aRow('National locations (states / UTs)', sv(bp.num_national_locations));
        aRow('International locations (countries)', sv(bp.num_international_locations));
        aRow('Exports as % of turnover', pct(bp.export_pct));
        y -= 6;

        aSecHdr('IV. Financials');
        aRow('Annual turnover', inr(bp.annual_turnover_inr));
        aRow('Net worth', inr(bp.net_worth_inr));
        y -= 6;

        // ---- SECTION B: flows after IV. Financials on same page if space allows ----
        bEnsure(430);
        y -= 24;

        page.drawText('Section B: Management & Process Disclosures', { x: 50, y, size: 14, font: bold, color: TEXT });
        page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.8, color: BLUE });
        y -= 26;

        // Policy matrix table
        const COL_P   = 55;   // Principle col start
        const COL_PE  = 230;  // Policy exists
        const COL_BA  = 300;  // Board approved
        const COL_VC  = 370;  // Extends to VC
        const COL_URL = 430;  // URL
        const MAT_W   = 510;

        // Table header
        page.drawRectangle({ x: BTL, y: y - 18, width: MAT_W, height: 22, color: BLUE });
        page.drawText('Principle', { x: COL_P, y: y - 10, size: 8, font: bold, color: rgb(1,1,1) });
        page.drawText('Policy exists', { x: COL_PE, y: y - 10, size: 8, font: bold, color: rgb(1,1,1) });
        page.drawText('Board approved', { x: COL_BA, y: y - 10, size: 8, font: bold, color: rgb(1,1,1) });
        page.drawText('Extends to VC', { x: COL_VC, y: y - 10, size: 8, font: bold, color: rgb(1,1,1) });
        page.drawText('URL', { x: COL_URL, y: y - 10, size: 8, font: bold, color: rgb(1,1,1) });
        y -= 26;

        const bPrinciples = [
          { key: 'p1', label: 'P1', title: 'Ethics, Transparency & Accountability' },
          { key: 'p2', label: 'P2', title: 'Sustainable & Safe Products' },
          { key: 'p3', label: 'P3', title: 'Employee Wellbeing' },
          { key: 'p4', label: 'P4', title: 'Stakeholder Engagement' },
          { key: 'p5', label: 'P5', title: 'Human Rights' },
          { key: 'p6', label: 'P6', title: 'Environment' },
          { key: 'p7', label: 'P7', title: 'Policy & Regulatory Advocacy' },
          { key: 'p8', label: 'P8', title: 'Inclusive Growth' },
          { key: 'p9', label: 'P9', title: 'Consumer Responsibility' },
        ];

        for (const p of bPrinciples) {
          const exists = bp[`${p.key}_policy_exists`];
          const approved = bp[`${p.key}_board_approved`];
          const vc = bp[`${p.key}_extends_to_vc`];
          const url = bp[`${p.key}_policy_url`];
          const rowBg = exists ? rgb(0.97, 0.99, 0.97) : rgb(0.99, 0.99, 1);
          const tick = (v: boolean) => v ? 'Yes' : 'No';
          const tickCol = (v: boolean) => v ? BLUE : rgb(0.6, 0.6, 0.62);
          page.drawRectangle({ x: BTL, y: y - 24, width: MAT_W, height: 28, color: rowBg });
          page.drawLine({ start: { x: BTL, y: y - 24 }, end: { x: BTL + MAT_W, y: y - 24 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
          page.drawText(p.label, { x: COL_P, y: y - 10, size: 8.5, font: bold, color: BLUE });
          page.drawText(p.title, { x: COL_P, y: y - 20, size: 7, font, color: rgb(0.5, 0.5, 0.52) });
          page.drawText(tick(exists), { x: COL_PE + 10, y: y - 14, size: 8.5, font: bold, color: tickCol(exists) });
          page.drawText(tick(approved), { x: COL_BA + 10, y: y - 14, size: 8.5, font: bold, color: tickCol(approved) });
          page.drawText(tick(vc), { x: COL_VC + 5, y: y - 14, size: 8.5, font: bold, color: tickCol(vc) });
          const urlStr = url ? (url.length > 18 ? url.substring(0, 16) + '..' : url) : '-';
          page.drawText(urlStr, { x: COL_URL, y: y - 14, size: 7.5, font, color: url ? BLUE : rgb(0.7, 0.7, 0.72) });
          y -= 30;
        }

        y -= 8;
        aSecHdr('Governance');
        aRow('Director responsible for BRSR', sv(bp.brsr_director_name));
        aRow('Board committee overseeing BRSR', sv(bp.brsr_committee_name));
        y -= 8;

        // ---- SECTION C PAGE ----
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage(); y = 780;

        page.drawText('Section C: Principle-wise Performance Disclosures', { x: 50, y, size: 14, font: bold, color: TEXT });
        page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.8, color: BLUE });
        y -= 26;
      }

      // Column headers (Section C table)
      bEnsure(100);
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0, 0, 0) });
      page.drawText('BRSR Indicator', { x: BC1, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Disclosed Value', { x: BC2, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Status', { x: BC3 + 15, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      // ===== P1-P5 and P7-P9: Enterprise only =====
      if (isEnterpriseAccount && brsrExtraProfile) {
        const bp = brsrExtraProfile as any;
        const dis = (v: any) => (v != null && v !== '') ? 'disclosed' as const : 'missing' as const;
        const boolVal = (v: any) => v ? 'Yes' : 'No';
        const numVal = (v: any, suffix = '') => v != null && v !== '' ? `${Number(v).toLocaleString('en-IN')}${suffix}` : 'Not provided';

        // P1
        bGroupHdr('Principle 1 | Ethics, Transparency & Accountability');
        const listedVal = bp.is_listed_company ? 'Listed company' : bp.is_subsidiary_of_listed ? 'Subsidiary of listed' : 'Unlisted company';
        bRow('Listed company status', listedVal, false, undefined, bp.is_listed_company != null ? 'disclosed' : 'missing');
        bRow('Code of conduct in place', boolVal(bp.has_code_of_conduct), false, undefined, dis(bp.has_code_of_conduct));
        bRow('Whistleblower / vigil mechanism in place', boolVal(bp.has_whistleblower_policy), false, undefined, dis(bp.has_whistleblower_policy));
        bRow('Anti-corruption & anti-bribery policy in place', boolVal(bp.has_anti_corruption_policy), false, undefined, dis(bp.has_anti_corruption_policy));
        y -= 4;

        // P2
        bGroupHdr('Principle 2 | Sustainable & Safe Products / Services');
        bRow('Extended Producer Responsibility (EPR) compliance', boolVal(bp.has_epr_compliance), false, undefined, dis(bp.has_epr_compliance));
        bRow('Sustainable products / services (% of turnover)', bp.sustainable_product_pct != null ? `${bp.sustainable_product_pct}%` : 'Not provided', false, undefined, dis(bp.sustainable_product_pct));
        bRow('R&D sustainability spend', bp.rd_sustainability_spend ? `INR ${Number(bp.rd_sustainability_spend).toLocaleString('en-IN')}` : 'Not provided', false, undefined, dis(bp.rd_sustainability_spend));
        y -= 4;

        // P3
        bGroupHdr('Principle 3 | Employee Wellbeing');
        bRow('Permanent employees', numVal(bp.permanent_employees), false, undefined, dis(bp.permanent_employees));
        bRow('Permanent workers', numVal(bp.permanent_workers), false, undefined, dis(bp.permanent_workers));
        bRow('Average training hours per employee per year', bp.training_hours_per_employee != null ? `${bp.training_hours_per_employee} hrs` : 'Not provided', false, undefined, dis(bp.training_hours_per_employee));
        bRow('Health insurance provided to all employees', boolVal(bp.has_health_insurance), false, undefined, dis(bp.has_health_insurance));
        bRow('Maternity / paternity benefits in place', boolVal(bp.has_maternity_paternity), false, undefined, dis(bp.has_maternity_paternity));
        y -= 4;

        // P4
        bGroupHdr('Principle 4 | Stakeholder Engagement');
        bRow('Key stakeholder groups', bp.stakeholder_groups || 'Not provided', false, undefined, dis(bp.stakeholder_groups));
        bRow('Stakeholder engagement frequency', bp.stakeholder_engagement_frequency || 'Not provided', false, undefined, dis(bp.stakeholder_engagement_frequency));
        y -= 4;

        // P5
        bGroupHdr('Principle 5 | Human Rights');
        bRow('Human rights policy in place', boolVal(bp.has_human_rights_policy), false, undefined, dis(bp.has_human_rights_policy));
        bRow('Human rights training provided to employees', boolVal(bp.human_rights_training), false, undefined, dis(bp.human_rights_training));
        bRow('Human rights complaints received (this year)', bp.human_rights_complaints != null ? String(bp.human_rights_complaints) : 'Not provided', false, undefined, dis(bp.human_rights_complaints));
        y -= 4;
      }

      // ===== GHG EMISSIONS (P6 - all India users) =====
      if (isEnterpriseAccount) {
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage(); y = 780;
      }
      bGroupHdr('Principle 6 | Environment: GHG Emissions (Essential Indicators)');
      bRow('Total Scope 1 emissions (metric tonnes CO2e)', `${scope1_t.toFixed(2)} tCO2e`, true);
      bRow('Total Scope 2 emissions (metric tonnes CO2e)', `${scope2_t.toFixed(2)} tCO2e`, true);
      bRow('Total Scope 3 emissions: value chain (metric tonnes CO2e)', `${scope3_t.toFixed(2)} tCO2e`, true, 'Scope 3 is partial. Full value-chain inventory recommended for BRSR Core.');
      bRow('Total GHG emissions, Scope 1+2+3 (metric tonnes CO2e)', `${bTotalCO2t.toFixed(2)} tCO2e`, true);
      if (bGhgPerRev !== null) {
        bRow('GHG emission intensity per rupee of turnover (tCO2e / INR)', `${bFmtI(bGhgPerRev)} tCO2e / INR`, true);
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

      // ===== P7-P9: Enterprise only =====
      if (isEnterpriseAccount && brsrExtraProfile) {
        const bp = brsrExtraProfile as any;
        const dis = (v: any) => (v != null && v !== '') ? 'disclosed' as const : 'missing' as const;
        const boolVal = (v: any) => v ? 'Yes' : 'No';

        // P7-9 always starts on its own page
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage(); y = 780;
        y -= 4;
        bGroupHdr('Principle 7 | Policy & Regulatory Advocacy');
        bRow('Industry / trade associations', bp.industry_associations || 'Not provided', false, undefined, dis(bp.industry_associations));
        bRow('Policy advocacy positions', bp.policy_advocacy_positions || 'Not provided', false, undefined, dis(bp.policy_advocacy_positions));
        y -= 4;

        bGroupHdr('Principle 8 | Inclusive Growth & Equitable Development');
        bRow('CSR spend (INR)', bp.csr_spend_inr ? `INR ${Number(bp.csr_spend_inr).toLocaleString('en-IN')}` : 'Not provided', false, undefined, dis(bp.csr_spend_inr));
        bRow('Social impact projects', bp.social_impact_projects || 'Not provided', false, undefined, dis(bp.social_impact_projects));
        y -= 4;

        bGroupHdr('Principle 9 | Consumer Responsibility');
        bRow('Consumer complaint / grievance mechanism', boolVal(bp.has_consumer_complaint_mechanism), false, undefined, dis(bp.has_consumer_complaint_mechanism));
        bRow('Data privacy policy in place', boolVal(bp.has_data_privacy_policy), false, undefined, dis(bp.has_data_privacy_policy));
        bRow('Product labelling / environmental disclosure', boolVal(bp.has_product_labelling), false, undefined, dis(bp.has_product_labelling));
        y -= 4;
      }

      // ===== BRSR COMPLETENESS SCORECARD =====
      if (isEnterpriseAccount) {
        page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
        page = addPage();
        y = 780;
      } else {
        bEnsure(200);
      }
      page.drawText('BRSR Section C Completeness Scorecard', { x: 50, y, size: 12, font: bold, color: TEXT });
      y -= 22;

      const bGhgAuto = 4 + (bGhgPerRev !== null ? 1 : 0) + (bGhgPerEmp !== null ? 1 : 0);
      const bEnergyAuto = 4 + (bEnergyPerRev !== null ? 1 : 0) + (bEnergyPerEmp !== null ? 1 : 0);
      const bWwaAuto = (bHasWater ? 1 : 0) + (bHasWaste ? 1 : 0) + (bHasAir ? 1 : 0);
      const bAddlAuto = 1 + (methodologyConfirmed ? 1 : 0) + (bHasGhgPlan ? 1 : 0) + (bHasRenew ? 1 : 0);

      // Enterprise: count P1-P5/P7-P9 disclosed indicators
      let bEntDisc = 0;
      const bEntTotal = 24; // P1:4, P2:3, P3:5, P4:2, P5:3, P7:2, P8:2, P9:3
      if (isEnterpriseAccount && brsrExtraProfile) {
        const bp = brsrExtraProfile as any;
        const dc = (v: any) => (v != null && v !== '') ? 1 : 0;
        // P1
        bEntDisc += (bp.is_listed_company != null ? 1 : 0) + dc(bp.has_code_of_conduct) + dc(bp.has_whistleblower_policy) + dc(bp.has_anti_corruption_policy);
        // P2
        bEntDisc += dc(bp.has_epr_compliance) + dc(bp.sustainable_product_pct) + dc(bp.rd_sustainability_spend);
        // P3
        bEntDisc += dc(bp.permanent_employees) + dc(bp.permanent_workers) + dc(bp.training_hours_per_employee) + dc(bp.has_health_insurance) + dc(bp.has_maternity_paternity);
        // P4
        bEntDisc += dc(bp.stakeholder_groups) + dc(bp.stakeholder_engagement_frequency);
        // P5
        bEntDisc += dc(bp.has_human_rights_policy) + dc(bp.human_rights_training) + dc(bp.human_rights_complaints);
        // P7
        bEntDisc += dc(bp.industry_associations) + dc(bp.policy_advocacy_positions);
        // P8
        bEntDisc += dc(bp.csr_spend_inr) + dc(bp.social_impact_projects);
        // P9
        bEntDisc += dc(bp.has_consumer_complaint_mechanism) + dc(bp.has_data_privacy_policy) + dc(bp.has_product_labelling);
      }

      const bOverallAuto = bGhgAuto + bEnergyAuto + bAddlAuto + bWwaAuto + (isEnterpriseAccount ? bEntDisc : 0);
      const bOverallTotal = 19 + (isEnterpriseAccount ? bEntTotal : 0);

      // Scorecard table header
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0, 0, 0) });
      page.drawText('Indicator group', { x: BC1, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Disclosed', { x: 310, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Missing', { x: 388, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
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
      if (isEnterpriseAccount) {
        const bp = brsrExtraProfile as any;
        const dc = (v: any) => (v != null && v !== '') ? 1 : 0;
        const p1 = (bp?.is_listed_company != null ? 1 : 0) + dc(bp?.has_code_of_conduct) + dc(bp?.has_whistleblower_policy) + dc(bp?.has_anti_corruption_policy);
        const p2 = dc(bp?.has_epr_compliance) + dc(bp?.sustainable_product_pct) + dc(bp?.rd_sustainability_spend);
        const p3 = dc(bp?.permanent_employees) + dc(bp?.permanent_workers) + dc(bp?.training_hours_per_employee) + dc(bp?.has_health_insurance) + dc(bp?.has_maternity_paternity);
        const p4 = dc(bp?.stakeholder_groups) + dc(bp?.stakeholder_engagement_frequency);
        const p5 = dc(bp?.has_human_rights_policy) + dc(bp?.human_rights_training) + dc(bp?.human_rights_complaints);
        const p7 = dc(bp?.industry_associations) + dc(bp?.policy_advocacy_positions);
        const p8 = dc(bp?.csr_spend_inr) + dc(bp?.social_impact_projects);
        const p9 = dc(bp?.has_consumer_complaint_mechanism) + dc(bp?.has_data_privacy_policy) + dc(bp?.has_product_labelling);
        bScoreRow('P1: Ethics & Transparency', p1, 4);
        bScoreRow('P2: Sustainable Products', p2, 3);
        bScoreRow('P3: Employee Wellbeing', p3, 5);
        bScoreRow('P4: Stakeholder Engagement', p4, 2);
        bScoreRow('P5: Human Rights', p5, 3);
      }
      bScoreRow('P6: GHG Emissions (Scope 1, 2, 3)', bGhgAuto, 6);
      bScoreRow('P6: Energy Consumption', bEnergyAuto, 6);
      bScoreRow('P6: Water, Waste and Air', bWwaAuto, 3);
      bScoreRow('P6: Additional disclosures', bAddlAuto, 4);
      if (isEnterpriseAccount) {
        const bp = brsrExtraProfile as any;
        const dc = (v: any) => (v != null && v !== '') ? 1 : 0;
        const p7 = dc(bp?.industry_associations) + dc(bp?.policy_advocacy_positions);
        const p8 = dc(bp?.csr_spend_inr) + dc(bp?.social_impact_projects);
        const p9 = dc(bp?.has_consumer_complaint_mechanism) + dc(bp?.has_data_privacy_policy) + dc(bp?.has_product_labelling);
        bScoreRow('P7: Policy Advocacy', p7, 2);
        bScoreRow('P8: Inclusive Growth', p8, 2);
        bScoreRow('P9: Consumer Responsibility', p9, 3);
      }

      // Overall row:light green highlight (matches "Total GHG" row in energy table)
      const bOverallPct = Math.round(bOverallAuto / bOverallTotal * 100);
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0.92, 0.96, 0.92) });
      page.drawLine({ start: { x: BTL, y: y - 18 }, end: { x: BTL + BTW, y: y - 18 }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });
      page.drawText('Overall BRSR Essential Indicators', { x: BC1, y: y - 7, size: 9, font: bold, color: TEXT });
      page.drawText(`${bOverallAuto} / ${bOverallTotal}`, { x: 320, y: y - 7, size: 9, font: bold, color: TEXT });
      page.drawText(`${bOverallTotal - bOverallAuto} / ${bOverallTotal}`, { x: 398, y: y - 7, size: 9, font: bold, color: TEXT });
      const bOvColor = bOverallPct >= 80 ? BLUE : bOverallPct >= 50 ? AMBER_BADGE : rgb(0.72, 0.15, 0.05);
      page.drawText(`${bOverallPct}%`, { x: 487, y: y - 7, size: 10, font: bold, color: bOvColor });
      y -= 30;

      // Tip box:amber when items missing, green when 100% complete
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

      // Disclaimer:inline draw
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

    // ========================= PAGE 7: CSRD / ESRS E1 Disclosure Summary (EU only) =========================
    if (isEU) {
      page = addPage();
      y = 780;

      const EU_BLUE = rgb(0.1, 0.2, 0.55);
      const AMBER_BADGE = rgb(218 / 255, 128 / 255, 0 / 255);
      const BTL = 45;
      const BTW = 510;
      const BC1 = 55;
      const BC2 = 325;
      const BC3 = 455;
      const BADGE_W = 90;

      const cFuelKwh = totalDieselLitres * 10.9 + totalPetrolLitres * 9.4 + totalGasKwh + totalLpgKg * 12.88 + totalCngKg * 13.9;
      const cTotalEnergyKwh = totalElecKwh + cFuelKwh;
      const cTotalEnergyGJ = cTotalEnergyKwh * 0.0036;
      const cTotalCO2t = scope1_t + scope2_t + scope3_t;
      const cGhgPerEmp = empCount > 0 ? cTotalCO2t / empCount : null;
      const cGhgPerRev = revenue > 0 ? cTotalCO2t / revenue : null;
      const cEnergyPerEmp = empCount > 0 ? cTotalEnergyGJ / empCount : null;
      const cFmtI = (v: number) => { const d = Math.max(0, -Math.floor(Math.log10(Math.abs(v) || 1)) + 2); return v.toFixed(d); };
      const hasRenewable = !!(profile as any).renewable_energy_tariff;

      const cWrap = (text: string, maxW: number, sz: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (font.widthOfTextAtSize(test, sz) > maxW) { if (cur) lines.push(cur); cur = w; }
          else { cur = test; }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      const cEnsure = (needed: number) => {
        if (y < 50 + needed) {
          page.drawText(pgFtr(), { x: 180, y: 20, size: 9, font, color: TEXT });
          page = addPage();
          y = 780;
        }
      };

      const cGroupHdr = (text: string) => {
        cEnsure(50);
        page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: BLUE });
        page.drawText(text, { x: BC1, y: y - 6, size: 8.5, font: bold, color: rgb(1, 1, 1) });
        y -= 26;
      };

      const cRow = (indicator: string, value: string, auto: boolean, note?: string) => {
        const SZ = 8.5;
        const NOTE_SZ = 7.5;
        const NOTE_LH = 11;
        const indLines = cWrap(indicator, BC2 - BC1 - 8, SZ);
        const valLines = cWrap(value, BC3 - BC2 - 8, SZ);
        const mainH = Math.max(22, Math.max(indLines.length, valLines.length) * 13 + 8);
        const noteLines = note ? cWrap(note, 230, NOTE_SZ) : [];
        const rowH = mainH + (noteLines.length > 0 ? noteLines.length * NOTE_LH + 6 : 0);
        cEnsure(rowH + 4);

        const rowBg = auto ? rgb(0.97, 0.99, 0.97) : rgb(0.99, 0.99, 1);
        page.drawRectangle({ x: BTL, y: y - rowH, width: BTW, height: rowH, color: rowBg });
        page.drawLine({ start: { x: BTL, y: y - rowH }, end: { x: BTL + BTW, y: y - rowH }, thickness: 0.3, color: rgb(0.87, 0.87, 0.87) });

        const indStartY = y - Math.round((mainH - indLines.length * 13) / 2) - 10;
        for (let li = 0; li < indLines.length; li++) {
          page.drawText(indLines[li], { x: BC1, y: indStartY - li * 13, size: SZ, font, color: TEXT });
        }
        const valColor = auto ? BLUE : rgb(0.5, 0.5, 0.52);
        const valStartY = y - Math.round((mainH - valLines.length * 13) / 2) - 10;
        for (let vi = 0; vi < valLines.length; vi++) {
          page.drawText(valLines[vi], { x: BC2, y: valStartY - vi * 13, size: SZ, font: auto ? bold : font, color: valColor });
        }
        const badgeY = y - Math.round(mainH / 2) - 7;
        page.drawRectangle({ x: BC3, y: badgeY, width: BADGE_W, height: 14, color: auto ? BLUE : AMBER_BADGE });
        const badgeStr = auto ? 'Auto-filled' : 'Needs input';
        const badgeStrW = bold.widthOfTextAtSize(badgeStr, 7.5);
        page.drawText(badgeStr, { x: BC3 + Math.round((BADGE_W - badgeStrW) / 2), y: badgeY + 3, size: 7.5, font: bold, color: rgb(1, 1, 1) });
        if (noteLines.length > 0) {
          let noteY = y - mainH - 9;
          for (const nl of noteLines) {
            page.drawText(nl, { x: BC1 + 4, y: noteY, size: NOTE_SZ, font, color: rgb(0.5, 0.5, 0.52) });
            noteY -= NOTE_LH;
          }
        }
        y -= rowH + 2;
      };

      // PAGE HEADER
      page.drawText('7. CSRD / ESRS E1 Climate Disclosure', { x: 50, y, size: 18, font: bold, color: TEXT });
      page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 1, color: EU_BLUE });
      y -= 28;
      page.drawText('EU CSRD | ESRS E1 - Climate Change (auto-populated from Greenio data)', { x: 50, y, size: 10, font, color: rgb(0.45, 0.45, 0.47) });
      y -= 22;
      {
        const cDark = rgb(0.15, 0.15, 0.17);
        const introStr = 'The following disclosures are prepared in accordance with ESRS E1 (Climate Change) under the EU Corporate Sustainability Reporting Directive (CSRD). Quantitative datapoints are auto-populated from Greenio emissions data. Fields marked "Needs input" require additional information from your organisation.';
        const introWords = introStr.split(' ');
        let introLine = '';
        for (const iw of introWords) {
          const test = introLine ? introLine + ' ' + iw : iw;
          if (font.widthOfTextAtSize(test, 10) > 495) {
            page.drawText(introLine.trim(), { x: 50, y, size: 10, font, color: cDark });
            y -= 15;
            introLine = iw;
          } else { introLine = test; }
        }
        if (introLine.trim()) { page.drawText(introLine.trim(), { x: 50, y, size: 10, font, color: cDark }); y -= 15; }
        y -= 10;
      }

      // Column headers
      page.drawRectangle({ x: BTL, y: y - 18, width: BTW, height: 22, color: rgb(0, 0, 0) });
      page.drawText('ESRS E1 Indicator', { x: BC1, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Value', { x: BC2, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText('Status', { x: BC3 + 15, y: y - 10, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= 26;

      // E1-6: GHG Emissions
      cGroupHdr('E1-6 - Gross GHG Emissions (Scope 1, 2, 3)');
      cRow('Gross Scope 1 GHG emissions (tCO2e) - direct combustion, fugitive', `${scope1_t.toFixed(2)} tCO2e`, true);
      cRow('Gross Scope 2 GHG emissions (tCO2e) - location-based electricity', `${scope2_t.toFixed(2)} tCO2e`, true, `Location-based grid factor: ${ef.electricity} kg CO2e/kWh (${countryName})`);
      cRow('Gross Scope 3 GHG emissions (tCO2e) - partial value chain', scope3_t > 0 ? `${scope3_t.toFixed(2)} tCO2e` : 'Not provided', scope3_t > 0, scope3_t > 0 ? 'Partial Scope 3 only. Full value-chain inventory recommended for CSRD completeness.' : 'Log Scope 3 activities in Greenio to auto-populate.');
      cRow('Total GHG emissions Scope 1+2+3 (tCO2e)', `${cTotalCO2t.toFixed(2)} tCO2e`, true);

      // E1-5: Energy
      cGroupHdr('E1-5 - Energy Consumption and Mix');
      cRow('Total energy consumption (GJ)', `${cTotalEnergyGJ.toFixed(2)} GJ`, true);
      cRow('Energy from electricity (GJ)', `${(totalElecKwh * 0.0036).toFixed(2)} GJ`, true);
      cRow('Energy from fossil fuels (GJ)', `${(cFuelKwh * 0.0036).toFixed(2)} GJ`, true);
      cRow('Share of renewable energy in electricity mix', hasRenewable ? 'Renewable tariff confirmed' : 'Not confirmed', hasRenewable, hasRenewable ? 'Organisation has confirmed use of a renewable energy tariff.' : 'Confirm renewable energy tariff in your Greenio profile.');

      // Intensity
      cGroupHdr('GHG Intensity Metrics');
      if (cGhgPerEmp != null) {
        cRow('GHG intensity per employee (tCO2e / FTE)', `${cFmtI(cGhgPerEmp)} tCO2e / FTE`, true);
      } else {
        cRow('GHG intensity per employee (tCO2e / FTE)', 'Not calculable', false, 'Add employee headcount in your Greenio profile.');
      }
      if (cGhgPerRev != null) {
        cRow('GHG intensity per EUR revenue (tCO2e / EUR)', `${cFmtI(cGhgPerRev)} tCO2e / EUR`, true);
      } else {
        cRow('GHG intensity per EUR revenue (tCO2e / EUR)', 'Not calculable', false, 'Add annual revenue in your Greenio profile.');
      }
      if (cEnergyPerEmp != null) {
        cRow('Energy intensity per employee (GJ / FTE)', `${cFmtI(cEnergyPerEmp)} GJ / FTE`, true);
      } else {
        cRow('Energy intensity per employee (GJ / FTE)', 'Not calculable', false, 'Add employee headcount in your Greenio profile.');
      }

      // Governance & Targets
      cGroupHdr('E1-1 / E1-4 - Climate Governance and Targets');
      cRow('Calculation methodology confirmed', methodologyConfirmed ? 'Confirmed' : 'Not confirmed', !!methodologyConfirmed, methodologyConfirmed ? 'Methodology confirmed by operator.' : 'Confirm methodology in your Greenio profile.');
      cRow('Climate transition plan (E1-1)', 'Needs input', false, 'Document your transition plan for climate change mitigation.');
      cRow('Climate targets set (E1-4)', 'Needs input', false, 'Set reduction targets in your Greenio profile to auto-populate.');
      cRow('Internal carbon price used (E1-8)', 'Needs input', false, 'Disclose whether an internal carbon price is used in investment decisions.');

      // COMPLETENESS SCORECARD
      cEnsure(120);
      y -= 20;
      page.drawText('CSRD / ESRS E1 Completeness Scorecard', { x: 50, y, size: 12, font: bold, color: TEXT });
      y -= 22;

      const cMissing: string[] = [];
      if (!empCount) cMissing.push('employee headcount');
      if (revenue <= 0) cMissing.push('annual revenue (EUR)');
      if (scope3_t <= 0) cMissing.push('Scope 3 activities');
      if (!hasRenewable) cMissing.push('renewable energy confirmation');
      if (!methodologyConfirmed) cMissing.push('methodology confirmation');

      const cAutoCount = 6 + (empCount ? 1 : 0) + (revenue > 0 ? 1 : 0) + (scope3_t > 0 ? 1 : 0) + (hasRenewable ? 1 : 0) + (methodologyConfirmed ? 1 : 0);
      const cTotalCount = 11;
      const cPct = Math.round((cAutoCount / cTotalCount) * 100);
      const cBarW = 400;
      const cFillW = Math.round(cBarW * cPct / 100);
      const cPctColor = cPct >= 80 ? BLUE : cPct >= 50 ? AMBER_BADGE : rgb(0.72, 0.15, 0.05);
      const cBarBottomY = y - 16;
      page.drawRectangle({ x: BTL, y: cBarBottomY, width: cBarW, height: 12, color: rgb(0.9, 0.9, 0.9) });
      page.drawRectangle({ x: BTL, y: cBarBottomY, width: cFillW, height: 12, color: BLUE });
      page.drawText(`${cPct}%`, { x: BTL + cBarW + 10, y: cBarBottomY + 3, size: 10, font: bold, color: cPctColor });
      y = cBarBottomY - 10;
      page.drawText(`${cAutoCount} of ${cTotalCount} datapoints auto-populated`, { x: BTL, y, size: 8, font, color: rgb(0.45, 0.45, 0.47) });
      y -= 16;

      cEnsure(70);
      const cTipText = cMissing.length > 0
        ? `To improve ESRS E1 completeness: Add (${cMissing.map((m, i) => `${i + 1}) ${m}`).join(', ')}) to your Greenio profile. Remaining indicators will auto-populate in your next report.`
        : 'All auto-populatable ESRS E1 datapoints are complete. Add transition plan, climate targets, and internal carbon price details to reach full disclosure.';
      const cTipBg = cMissing.length > 0 ? rgb(0.98, 0.97, 0.88) : rgb(0.94, 0.99, 0.94);
      const cTipAccent = cMissing.length > 0 ? AMBER_BADGE : BLUE;
      const cTipTextColor = cMissing.length > 0 ? rgb(0.45, 0.35, 0) : rgb(0.1, 0.4, 0.1);
      const cTipLines = cWrap(cTipText, 450, 8.5);
      const cTipH = cTipLines.length * 13 + 20;
      page.drawRectangle({ x: BTL, y: y - cTipH, width: BTW, height: cTipH, color: cTipBg });
      page.drawRectangle({ x: BTL, y: y - cTipH, width: 4, height: cTipH, color: cTipAccent });
      for (let ti = 0; ti < cTipLines.length; ti++) {
        page.drawText(cTipLines[ti], { x: BC1 + 8, y: y - 13 - ti * 13, size: 8.5, font: ti === 0 ? bold : font, color: cTipTextColor });
      }
      y -= cTipH + 12;

      const discStr = 'This CSRD/ESRS E1 summary is based solely on data entered into Greenio and does not constitute third-party assurance. For companies subject to mandatory CSRD reporting, limited assurance by an accredited auditor is required from FY2024 (large companies) or FY2026 (listed SMEs). ESRS E1 also requires qualitative disclosures (transition plans, risk analysis, governance) which are not auto-generated.';
      for (const dl of cWrap(discStr, 495, 8.5)) { page.drawText(dl, { x: 50, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.37) }); y -= 13; }

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