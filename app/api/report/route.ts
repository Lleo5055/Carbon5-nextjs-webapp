// ============================================================
// CLEAN ASCII-SAFE PDF REPORT ROUTE (PART 1/4)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '../../../lib/supabaseClient';

export const runtime = 'nodejs';

// ============================================================
// TYPES
// ============================================================

type EmissionRow = {
  month: string | null;
  electricity_kw: number | null;
  diesel_litres: number | null;
  petrol_litres?: number | null;
  gas_kwh?: number | null;
  refrigerant_kg?: number | null;
  total_co2e: number | null;
};

type Scope3Row = {
  month: string | null;
  co2e_kg: number | null;
  category: string | null;
};

type MethodologyRow = {
  methodology_confirmed: boolean;
  methodology_note: string | null;
};
function fmtKg(v: number): string {
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtT(v: number): string {
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(v: number): string {
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ============================================================
// TEXT WRAPPING (ASCII SAFE)
// ============================================================

function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  maxWidth: number,
  lineHeight: number
): number {
  if (!text) return y;

  const words = text.split(' ');
  let line = '';

  for (const word of words) {
    const testLine = line ? line + ' ' + word : word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && line) {
      page.drawText(line, { x, y, size, font });
      y -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, { x, y, size, font });
    y -= lineHeight;
  }

  return y;
}

// ============================================================
// BULLET LIST (ASCII SAFE)
// ============================================================

function drawBulletList(
  page: any,
  items: string[],
  x: number,
  y: number,
  font: any,
  size: number,
  maxWidth: number,
  lineHeight: number
): number {
  const textX = x + 12;

  for (const item of items) {
    // Using "-" because Helvetica cannot encode unicode bullets
    page.drawText('-', { x, y, size, font });

    y = drawWrappedText(
      page,
      item,
      textX,
      y,
      font,
      size,
      maxWidth - 12,
      lineHeight
    );

    y -= 4;
  }

  return y;
}

// ============================================================
// SPARKLINE (ASCII SAFE)
// ============================================================

function drawSparkline(
  page: any,
  values: number[],
  x: number,
  topY: number,
  width: number,
  height: number
): number {
  if (!values.length) return topY - height;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const leftX = x;
  const rightX = x + width;
  const baseY = topY - height / 2;

  page.drawLine({
    start: { x: leftX, y: baseY },
    end: { x: rightX, y: baseY },
    thickness: 0.5,
    color: rgb(0.8, 0.82, 0.86),
  });

  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  let prevX = leftX;
  let prevY = baseY - ((values[0] - min) / range) * (height / 2);

  for (let i = 1; i < values.length; i++) {
    const xi = leftX + stepX * i;
    const yi = baseY - ((values[i] - min) / range) * (height / 2);

    page.drawLine({
      start: { x: prevX, y: prevY },
      end: { x: xi, y: yi },
      thickness: 0.9,
      color: rgb(0.1, 0.16, 0.28),
    });

    prevX = xi;
    prevY = yi;
  }

  page.drawCircle({
    x: prevX,
    y: prevY,
    size: 2.5,
    color: rgb(0.1, 0.16, 0.28),
  });

  return topY - height - 8;
}

// ============================================================
// MAIN REPORT HANDLER (BEGINNING)
// ============================================================

async function handleReport(req: NextRequest): Promise<NextResponse> {
  let step = 'start';

  try {
    // ------------------------------------------------------------
    // 1. LOAD USER PLAN (FREE LIMIT CHECK)
    // ------------------------------------------------------------
    step = 'load-user-plan'; // ✅ REQUIRED FIX

    const { data: planRow, error: planErr } = await supabase
      .from('user_plans')
      .select('id, user_id, plan, report_count')
      .maybeSingle();

    if (planErr) console.error('Plan load error', planErr);

    const plan = planRow?.plan ?? 'free';
    const reportCount = Number(planRow?.report_count ?? 0);

    const isFree = plan === 'free';
    const freeLimit = 1;

    if (isFree && reportCount >= freeLimit) {
      const limitDoc = await PDFDocument.create();
      const font = await limitDoc.embedFont(StandardFonts.Helvetica);
      const page = limitDoc.addPage();
      const { height } = page.getSize();

      let y = height - 50;

      page.drawText('Carbon Central - Free Plan Limit Reached', {
        x: 50,
        y,
        size: 16,
        font,
      });
      y -= 28;

      page.drawText('You have used your free PDF export.', {
        x: 50,
        y,
        size: 11,
        font,
      });
      y -= 16;

      page.drawText('Upgrade to enable unlimited PDF reports.', {
        x: 50,
        y,
        size: 11,
        font,
      });

      const bytes = await limitDoc.save();

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="carbon-report-limit.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ------------------------------------------------------------
    // 2. PERIOD SELECTION (NEW LOGIC)
    // ------------------------------------------------------------
    step = 'period-parse';

    const url = new URL(req.url);

    // "periodType" = quick / custom / all
    const periodType = url.searchParams.get('periodType') || 'all';

    // "period" = 1m / 3m / 6m / 12m / custom date strings
    const period = url.searchParams.get('period') || null;

    // Optional: for custom range
    const fromDate = url.searchParams.get('from') || null;
    const toDate = url.searchParams.get('to') || null;

    // ------------------------------------------------------------
    // 3. LOAD EMISSIONS (SCOPE 1 + SCOPE 2)
    // ------------------------------------------------------------
    step = 'load-emissions';

    const { data: emissionsData, error: emissionsErr } = await supabase
      .from('emissions')

      .select(
        'month, electricity_kw, diesel_litres, petrol_litres, gas_kwh, refrigerant_kg, total_co2e'
      )
      .order('month', { ascending: true });

    if (emissionsErr) console.error('Emissions load error', emissionsErr);

    // Normalise rows
    let rows: EmissionRow[] = Array.isArray(emissionsData)
      ? (emissionsData as EmissionRow[])
      : [];
    // Apply reporting period filter BEFORE sorting
    if (periodType === 'quick') {
      const months = {
        '1m': 1,
        '3m': 3,
        '6m': 6,
        '12m': 12,
      } as Record<string, number>;

      const back = months[period as keyof typeof months] ?? 999;
      // default = all
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - back);

      rows = rows.filter((r) => {
        const d = r.month ? new Date(r.month) : null;
        return d && d >= cutoff;
      });
    }

    // Corrected custom range filter
    if (periodType === 'custom' && fromDate && toDate) {
      const startDate = new Date(fromDate + '-01');
      const endDate = new Date(toDate + '-01');

      rows = rows.filter((r) => {
        const d = r.month ? new Date(r.month) : null;
        return d && d >= startDate && d <= endDate;
      });
    }

    // --- FIX: Proper sorting by real chronological dates ---
    rows.sort((a, b) => {
      const da = a.month ? new Date(a.month) : null;
      const db = b.month ? new Date(b.month) : null;

      if (!da && !db) return 0;
      if (!da) return -1;
      if (!db) return 1;

      return da.getTime() - db.getTime();
    });

    // ------------------------------------------------------------
    // 4. LOAD SCOPE 3
    // ------------------------------------------------------------
    step = 'load-scope3';

    let scope3TotalKg = 0;
    const scope3CategoryTotals: Record<string, number> = {};

    const scope3Query = supabase
      .from('scope3_activities')

      .select('month, co2e_kg, category, user_id');

    const { data: s3Data, error: s3Err } = planRow?.user_id
      ? await scope3Query.eq('user_id', planRow.user_id)
      : await scope3Query;

    if (s3Err) console.error('Scope 3 load error', s3Err);

    // Normalise Scope 3 rows
    const scope3Rows: Scope3Row[] = Array.isArray(s3Data)
      ? (s3Data as Scope3Row[])
      : [];

    // --- FIX: Proper Scope 3 sorting (convert to real Date) ---
    scope3Rows.sort((a, b) => {
      const da = a.month ? new Date(a.month) : null;
      const db = b.month ? new Date(b.month) : null;

      if (!da && !db) return 0;
      if (!da) return -1;
      if (!db) return 1;

      return da.getTime() - db.getTime();
    });

    for (const r of scope3Rows) {
      const kg = Number(r.co2e_kg ?? 0);
      scope3TotalKg += kg;

      const cat = (r.category ?? 'Other').trim() || 'Other';
      scope3CategoryTotals[cat] = (scope3CategoryTotals[cat] ?? 0) + kg;
    }

    const scope3BreakdownArray = Object.entries(scope3CategoryTotals)
      .map(([category, totalKg]) => ({ category, totalKg }))
      .sort((a, b) => b.totalKg - a.totalKg);

    // ------------------------------------------------------------
    // 5. LOAD METHODOLOGY CONFIRMATION
    // ------------------------------------------------------------
    step = 'load-methodology';

    let methodology: MethodologyRow | null = null;

    if (planRow?.user_id) {
      const { data: mData, error: mErr } = await supabase
        .from('secr_methodology')
        .select('methodology_confirmed, methodology_note')
        .eq('user_id', planRow.user_id)
        .maybeSingle();

      if (mErr) console.error('Methodology load error', mErr);

      methodology = mData ?? null;
    }

    // STOP HERE - PDF generation begins in PART 2/4
    // ============================================================
    // SCOPE CALCULATIONS & HOTSPOT DETECTION
    // (CONTINUATION OF handleReport)
    // ============================================================

    // ------------------------------------------------------------
    // 6. AGGREGATE SCOPE 1 AND SCOPE 2
    // ------------------------------------------------------------

    // UK standard DEFRA factors (ASCII only)
    const EF_ELECTRICITY = 0.20705; // kg CO2e per kWh
    const EF_DIESEL = 2.68; // kg CO2e per litre

    const totalElectricityKwh = rows.reduce(
      (sum, r) => sum + Number(r.electricity_kw ?? 0),
      0
    );

    const totalDieselLitres = rows.reduce(
      (sum, r) => sum + Number(r.diesel_litres ?? 0),
      0
    );

    // Diesel kWh equivalent for SECR energy total
    const dieselKwhEq = totalDieselLitres * 10.7;

    const electricityCo2 = totalElectricityKwh * EF_ELECTRICITY;
    const fuelCo2 = totalDieselLitres * EF_DIESEL;

    // Stored Total CO2e if available (Scope 1 + 2)
    const storedTotal = rows.reduce((s, r) => s + Number(r.total_co2e ?? 0), 0);

    // Combined total CO2e (Scope 1 + 2 + 3)
    const baseTotal = electricityCo2 + fuelCo2 + scope3TotalKg;
    const totalCo2 = storedTotal > 0 ? storedTotal + scope3TotalKg : baseTotal;

    const totalT = totalCo2 / 1000; // tonnes CO2e

    const elecShare = totalCo2 ? (electricityCo2 / totalCo2) * 100 : 0;
    const fuelShare = totalCo2 ? (fuelCo2 / totalCo2) * 100 : 0;
    const scope3Share = totalCo2 ? (scope3TotalKg / totalCo2) * 100 : 0;

    const totalEnergyKwh = totalElectricityKwh + dieselKwhEq;

    // ------------------------------------------------------------
    // 7. HOTSPOT DETECTION
    // ------------------------------------------------------------

    const hotspot =
      scope3TotalKg >= electricityCo2 && scope3TotalKg >= fuelCo2
        ? 'Scope 3'
        : electricityCo2 >= fuelCo2
        ? 'Electricity usage'
        : 'Fuel consumption';

    // ------------------------------------------------------------
    // 8. MONTH-LEVEL ANALYSIS (HIGHEST, LATEST, TREND)
    // ------------------------------------------------------------

    const rowsWithTotals = rows.map((r) => {
      const calc =
        Number(r.total_co2e ?? 0) ||
        Number(r.electricity_kw ?? 0) * EF_ELECTRICITY +
          Number(r.diesel_litres ?? 0) * EF_DIESEL;

      return { r, total: calc };
    });

    const byDesc = [...rowsWithTotals].sort((a, b) => b.total - a.total);
    const highest = byDesc[0];
    const lowestNonZero = byDesc.find((x) => x.total > 0);
    const latest = rowsWithTotals[rowsWithTotals.length - 1];

    const highestLabel = highest?.r?.month ?? 'Highest month';
    const latestLabel = latest?.r?.month ?? 'Latest month';

    const trendText =
      latest && lowestNonZero && latest.total < lowestNonZero.total
        ? 'Latest reported month shows a reduction compared to your earlier peak.'
        : 'Latest reported month is similar to or above your earlier peak.';

    // ------------------------------------------------------------
    // 9. SPARKLINE VALUES (LAST 12 MONTHS)
    // ------------------------------------------------------------

    const sparkRows = rowsWithTotals.slice(-12);
    const sparkValues = sparkRows.map((m) => m.total);

    // ------------------------------------------------------------
    // 10. PDF DOCUMENT CREATION
    // ------------------------------------------------------------

    step = 'pdf-create';

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595; // A4 width
    const marginX = 50;
    const textWidth = pageWidth - marginX * 2;

    // ============================================================
    // PAGE 1 - COVER PAGE AND AT A GLANCE SUMMARY
    // ============================================================

    {
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      let y = height - 80;

      // Title
      page.drawText('Carbon Footprint Assessment Report', {
        x: marginX,
        y,
        size: 22,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.7,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 32;

      const subtitle =
        period === 'all'
          ? rows.length
            ? 'Reporting period: all recorded months (' + rows.length + ')'
            : 'Reporting period: all recorded months (no data)'
          : 'Reporting period: ' + period.toUpperCase();

      page.drawText(subtitle, {
        x: marginX,
        y,
        size: 12,
        font,
      });

      y -= 20;

      page.drawText('Organisation: Carbon Central client', {
        x: marginX,
        y,
        size: 11,
        font,
      });

      y -= 16;

      const today = new Date().toISOString().slice(0, 10);

      page.drawText('Report date: ' + today, {
        x: marginX,
        y,
        size: 11,
        font,
      });

      y -= 24;

      page.drawText(
        'Total emissions this period: ' + totalT.toFixed(2) + ' tCO2e',
        {
          x: marginX,
          y,
          size: 14,
          font: bold,
        }
      );

      y -= 30;

      y = drawWrappedText(
        page,
        'This report provides a structured SECR-style summary of your greenhouse gas emissions and key insights.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 20;

      // At a glance card
      const cardTop = y;
      const cardHeight = scope3TotalKg > 0 ? 110 : 90;

      page.drawRectangle({
        x: marginX - 4,
        y: cardTop - cardHeight + 10,
        width: textWidth + 8,
        height: cardHeight,
        color: rgb(0.97, 0.97, 0.985),
      });

      page.drawText('At a glance', {
        x: marginX,
        y: cardTop,
        size: 12,
        font: bold,
      });

      y = cardTop - 20;

      page.drawText(
        'Scope 1 (fuels): ' + (fuelCo2 / 1000).toFixed(2) + ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      page.drawText(
        'Scope 2 (electricity): ' +
          (electricityCo2 / 1000).toFixed(2) +
          ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      if (scope3TotalKg > 0) {
        page.drawText(
          'Scope 3 (selected categories): ' +
            (scope3TotalKg / 1000).toFixed(2) +
            ' tCO2e',
          { x: marginX, y, size: 11, font }
        );
        y -= 14;
      }

      page.drawText(
        'Energy use equivalent (electricity + diesel): ' +
          totalEnergyKwh.toFixed(0) +
          ' kWh',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      const hotspotLabel =
        hotspot === 'Electricity usage'
          ? 'electricity use'
          : hotspot === 'Fuel consumption'
          ? 'diesel fuel use'
          : 'Scope 3 value chain activities';

      page.drawText('Main hotspot: ' + hotspotLabel, {
        x: marginX,
        y,
        size: 11,
        font,
      });
    }

    // ============================================================
    // PAGE 2 - EXECUTIVE SUMMARY AND HISTORY
    // ============================================================
    {
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      let y = height - 60;

      page.drawText('1. Executive summary', {
        x: marginX,
        y,
        size: 18,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.7,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 28;

      page.drawText('Total emissions: ' + totalT.toFixed(2) + ' tCO2e', {
        x: marginX,
        y,
        size: 12,
        font,
      });

      y -= 18;

      page.drawText(
        'Electricity (Scope 2): ' + electricityCo2.toFixed(0) + ' kg CO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      page.drawText(
        'Fuels (Scope 1 - diesel): ' + fuelCo2.toFixed(0) + ' kg CO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 18;

      if (scope3TotalKg > 0) {
        y = drawWrappedText(
          page,
          'Scope 3 (selected categories): ' +
            scope3TotalKg.toFixed(0) +
            ' kg CO2e (' +
            scope3Share.toFixed(1) +
            '% of total). Values shown reflect only categories logged in Carbon Central.',
          marginX,
          y,
          font,
          11,
          textWidth,
          14
        );

        y -= 8;
      }

      const hotspotSentence =
        hotspot === 'Electricity usage'
          ? 'Electricity usage is the largest controllable contributor.'
          : hotspot === 'Fuel consumption'
          ? 'Fuel usage is the largest controllable contributor.'
          : 'Recorded Scope 3 activities are the largest contributor.';

      y = drawWrappedText(
        page,
        hotspotSentence,
        marginX,
        y,
        font,
        11,
        textWidth,
        14
      );

      y -= 12;

      if (rows.length > 0) {
        page.drawText('Period highlights', {
          x: marginX,
          y,
          size: 12,
          font: bold,
        });

        y -= 18;

        y = drawWrappedText(
          page,
          'Highest month: ' +
            highestLabel +
            ' (' +
            highest.total.toFixed(2) +
            ' kg CO2e)',
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y = drawWrappedText(
          page,
          'Latest month: ' +
            latestLabel +
            ' (' +
            latest.total.toFixed(2) +
            ' kg CO2e)',
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y = drawWrappedText(
          page,
          trendText,
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );
      }

      // Sparkline
      if (sparkValues.length >= 2 && Math.max(...sparkValues) > 0) {
        y -= 14;

        page.drawText('Trend over recent months (Scope 1 and 2)', {
          x: marginX,
          y,
          size: 11,
          font: bold,
        });

        const sparkTop = y - 6;

        y = drawSparkline(page, sparkValues, marginX, sparkTop, textWidth, 28);

        y -= 10;
      }

      // START PAGE 2 TABLE IN PART 3/4
      // ============================================================
      // EMISSIONS HISTORY TABLE
      // ============================================================

      y -= 10;

      page.drawText('2. Emissions history by month', {
        x: marginX,
        y,
        size: 16,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.6,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 28;

      const renderHistoryTable = (p: any, startY: number) => {
        let yy = startY;

        if (!rows.length) {
          p.drawText('No emissions data recorded yet.', {
            x: marginX,
            y: yy,
            size: 11,
            font,
          });
          return yy - 14;
        }

        const tableWidth = textWidth;
        const headerHeight = 20;
        const rowHeight = 14;

        // Header bar
        p.drawRectangle({
          x: marginX - 2,
          y: yy - headerHeight + 4,
          width: tableWidth + 4,
          height: headerHeight,
          color: rgb(0.1, 0.16, 0.28),
        });

        const headerY = yy - headerHeight / 2 + 2;

        p.drawText('Month', {
          x: marginX,
          y: headerY,
          size: 10,
          font: bold,
          color: rgb(1, 1, 1),
        });
        p.drawText('Electricity (kWh)', {
          x: marginX + 130,
          y: headerY,
          size: 10,
          font: bold,
          color: rgb(1, 1, 1),
        });
        p.drawText('Diesel (L)', {
          x: marginX + 270,
          y: headerY,
          size: 10,
          font: bold,
          color: rgb(1, 1, 1),
        });
        p.drawText('Total CO2e (kg)', {
          x: marginX + 380,
          y: headerY,
          size: 10,
          font: bold,
          color: rgb(1, 1, 1),
        });

        yy -= headerHeight + 8;

        const limitedRows = rows.slice(0, 18);

        limitedRows.forEach((row, index) => {
          if (index % 2 === 1) {
            p.drawRectangle({
              x: marginX - 2,
              y: yy - rowHeight + 2,
              width: tableWidth + 4,
              height: rowHeight,
              color: rgb(0.985, 0.985, 0.985),
            });
          }

          const month = row.month ?? 'Unknown';
          const elec = Number(row.electricity_kw ?? 0);
          const diesel = Number(row.diesel_litres ?? 0);
          const totalVal =
            row.total_co2e ?? elec * EF_ELECTRICITY + diesel * EF_DIESEL;

          p.drawText(month, { x: marginX, y: yy, size: 10, font });
          p.drawText(elec.toFixed(0), {
            x: marginX + 130,
            y: yy,
            size: 10,
            font,
          });
          p.drawText(diesel.toFixed(0), {
            x: marginX + 270,
            y: yy,
            size: 10,
            font,
          });
          p.drawText(totalVal.toFixed(2), {
            x: marginX + 380,
            y: yy,
            size: 10,
            font,
          });

          yy -= rowHeight;
        });

        if (rows.length > limitedRows.length) {
          yy -= 12;

          yy = drawWrappedText(
            p,
            'Note: ' +
              (rows.length - limitedRows.length) +
              ' additional months are recorded in the system but not shown here to keep this report concise.',
            marginX,
            yy,
            font,
            9,
            textWidth,
            13
          );
        }

        return yy;
      };

      y = renderHistoryTable(page, y);
    }

    // ============================================================
    // PAGE 3 - SCOPE BREAKDOWN AND SECR SUMMARY
    // ============================================================

    {
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      let y = height - 60;

      page.drawText('3. Scope breakdown and SECR summary', {
        x: marginX,
        y,
        size: 18,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.6,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 32;

      // ------------------------------------------------------------
      // Scope 1
      // ------------------------------------------------------------

      page.drawText(
        'Scope 1 (direct fuel emissions): ' +
          (fuelCo2 / 1000).toFixed(2) +
          ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 16;

      y = drawWrappedText(
        page,
        'Includes combustion of diesel in company operated vehicles or equipment.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      // ------------------------------------------------------------
      // Scope 2
      // ------------------------------------------------------------

      page.drawText(
        'Scope 2 (purchased electricity): ' +
          (electricityCo2 / 1000).toFixed(2) +
          ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 16;

      y = drawWrappedText(
        page,
        'Calculated using UK location based grid factors from DEFRA BEIS.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      // ------------------------------------------------------------
      // Scope 3
      // ------------------------------------------------------------

      if (scope3TotalKg > 0) {
        page.drawText(
          'Scope 3 (selected categories): ' +
            (scope3TotalKg / 1000).toFixed(2) +
            ' tCO2e',
          { x: marginX, y, size: 11, font }
        );

        y -= 16;

        y = drawWrappedText(
          page,
          'Scope 3 values represent only categories that you have logged in Carbon Central. This is not a complete Scope 3 inventory.',
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y -= 16;

        if (scope3BreakdownArray.length > 0) {
          page.drawText('Scope 3 (selected categories - summary)', {
            x: marginX,
            y,
            size: 11,
            font: bold,
          });

          y -= 18;

          const headerHeight = 18;
          const rowHeight = 14;

          page.drawRectangle({
            x: marginX - 2,
            y: y - headerHeight + 3,
            width: textWidth + 4,
            height: headerHeight,
            color: rgb(0.1, 0.16, 0.28),
          });

          const headerY = y - headerHeight / 2;

          const col1 = marginX;
          const col2 = marginX + 220;
          const col3 = marginX + 360;

          page.drawText('Category', {
            x: col1,
            y: headerY,
            size: 10,
            font: bold,
            color: rgb(1, 1, 1),
          });
          page.drawText('Emissions (tCO2e)', {
            x: col2,
            y: headerY,
            size: 10,
            font: bold,
            color: rgb(1, 1, 1),
          });
          page.drawText('Share (%)', {
            x: col3,
            y: headerY,
            size: 10,
            font: bold,
            color: rgb(1, 1, 1),
          });

          y -= headerHeight + 10;

          const topRows = scope3BreakdownArray.slice(0, 5);

          topRows.forEach((row, index) => {
            if (index % 2 === 1) {
              page.drawRectangle({
                x: marginX - 2,
                y: y - rowHeight + 2,
                width: textWidth + 4,
                height: rowHeight,
                color: rgb(0.985, 0.985, 0.985),
              });
            }

            const share =
              scope3TotalKg > 0
                ? ((row.totalKg / scope3TotalKg) * 100).toFixed(1)
                : '0.0';

            page.drawText(row.category, {
              x: col1,
              y,
              size: 10,
              font,
            });

            page.drawText((row.totalKg / 1000).toFixed(2), {
              x: col2,
              y,
              size: 10,
              font,
            });

            page.drawText(share, {
              x: col3,
              y,
              size: 10,
              font,
            });

            y -= rowHeight;
          });

          if (scope3BreakdownArray.length > topRows.length) {
            y -= 12;

            y = drawWrappedText(
              page,
              'Additional Scope 3 categories exist in Carbon Central but are not shown here to keep this summary compact.',
              marginX,
              y,
              font,
              9,
              textWidth,
              13
            );
          }

          y -= 20;
        }
      }

      // ------------------------------------------------------------
      // HOTSPOT ANALYSIS
      // ------------------------------------------------------------

      page.drawText('Hotspot analysis', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      const hotspotText =
        hotspot === 'Electricity usage'
          ? 'Electricity usage is the main hotspot. Optimising heating, cooling, lighting and equipment schedules can reduce consumption.'
          : hotspot === 'Fuel consumption'
          ? 'Fuel usage is the main hotspot. Route efficiency, driver behaviour and vehicle maintenance offer opportunities.'
          : 'Scope 3 value chain emissions are the main hotspot. Supplier engagement and procurement improvements are important.';

      y = drawWrappedText(
        page,
        hotspotText,
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 24;

      // ------------------------------------------------------------
      // SECR SUMMARY
      // ------------------------------------------------------------

      page.drawText('SECR summary', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 20;

      // Energy consumption
      page.drawText('Energy consumption (kWh equivalent):', {
        x: marginX,
        y,
        size: 11,
        font: bold,
      });

      y -= 16;

      page.drawText('Electricity: ' + totalElectricityKwh.toFixed(0) + ' kWh', {
        x: marginX,
        y,
        size: 11,
        font,
      });

      y -= 14;

      page.drawText(
        'Road fuels (diesel): ' + dieselKwhEq.toFixed(0) + ' kWh equivalent',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      page.drawText(
        'Total energy: ' + totalEnergyKwh.toFixed(0) + ' kWh equivalent',
        { x: marginX, y, size: 11, font }
      );

      y -= 22;

      // GHG emissions
      page.drawText('GHG emissions:', {
        x: marginX,
        y,
        size: 11,
        font: bold,
      });

      y -= 16;

      page.drawText('Scope 1: ' + (fuelCo2 / 1000).toFixed(2) + ' tCO2e', {
        x: marginX,
        y,
        size: 11,
        font,
      });

      y -= 14;

      page.drawText(
        'Scope 2: ' + (electricityCo2 / 1000).toFixed(2) + ' tCO2e',
        {
          x: marginX,
          y,
          size: 11,
          font,
        }
      );

      y -= 14;

      page.drawText(
        'Scope 3 (selected): ' + (scope3TotalKg / 1000).toFixed(2) + ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 14;

      page.drawText(
        'Total (S1 + S2 + S3): ' + (totalCo2 / 1000).toFixed(2) + ' tCO2e',
        { x: marginX, y, size: 11, font }
      );

      y -= 22;

      // Intensity metrics placeholder
      page.drawText('Intensity metrics', {
        x: marginX,
        y,
        size: 11,
        font: bold,
      });

      y -= 16;

      y = drawWrappedText(
        page,
        'Intensity metrics such as tCO2e per employee or per revenue will be added once organisational and financial data is available in Carbon Central.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );
    }
    // ============================================================
    // PAGE 4 - INSIGHTS AND ACTION PLAN
    // ============================================================

    {
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      let y = height - 60;

      // Title
      page.drawText('4. Insights and action plan', {
        x: marginX,
        y,
        size: 18,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.6,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 32;

      // Key insights
      page.drawText('Key insights', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      const insights: string[] = [
        'Total emissions for the period: ' +
          totalT.toFixed(2) +
          ' tCO2e. The primary hotspot is ' +
          (hotspot === 'Electricity usage'
            ? 'electricity usage'
            : hotspot === 'Fuel consumption'
            ? 'fuel usage'
            : 'selected Scope 3 categories') +
          '.',
        scope3TotalKg > 0
          ? 'Electricity contributed ' +
            elecShare.toFixed(1) +
            '%, fuel contributed ' +
            fuelShare.toFixed(1) +
            '%, and selected Scope 3 contributed ' +
            scope3Share.toFixed(1) +
            '%.'
          : 'Electricity contributed ' +
            elecShare.toFixed(1) +
            '% and fuel contributed ' +
            fuelShare.toFixed(1) +
            '%.',
        'As more months and categories are logged, year on year comparisons and deeper insights will become available automatically.',
      ];

      y = drawBulletList(page, insights, marginX, y, font, 10, textWidth, 14);

      y -= 10;

      // Hotspot based recommendations
      let top3Immediate: string[] = [];
      let extraImmediate: string[] = [];
      let mediumActions: string[] = [];

      if (hotspot === 'Electricity usage') {
        top3Immediate = [
          'Check building controls to avoid unnecessary heating, cooling or lighting during unoccupied hours.',
          'Identify equipment that remains running overnight and create shutdown routines.',
          'Review HVAC settings to ensure temperatures and timings reflect real usage patterns.',
        ];
        extraImmediate = [
          'Verify that metering data is complete to enable targeted optimisation.',
        ];
        mediumActions = [
          'Plan upgrades for lighting, HVAC or controls in highest use sites.',
          'Explore green power contracts or on site generation options.',
        ];
      } else if (hotspot === 'Fuel consumption') {
        top3Immediate = [
          'Review routing efficiency to reduce unnecessary trips.',
          'Promote driver awareness on idling and driving behaviour.',
          'Ensure vehicles are maintained regularly for peak efficiency.',
        ];
        extraImmediate = ['Standardise mileage and fuel logs across vehicles.'];
        mediumActions = [
          'Evaluate transition to more efficient or lower emission vehicles.',
          'Use telematics or fuel tracking to benchmark routes and drivers.',
        ];
      } else {
        // Scope 3 hotspot
        top3Immediate = [
          'Confirm which Scope 3 categories are currently logged and identify missing categories.',
          'Engage priority suppliers to request activity specific emissions data.',
          'Review procurement options for consolidation or low carbon alternatives.',
        ];
        extraImmediate = [
          'Create a priority supplier list based on spend and emissions relevance.',
        ];
        mediumActions = [
          'Develop a structured supplier engagement plan with shared reduction targets.',
          'Include low carbon criteria in procurement for major contracts.',
        ];
      }

      // Top 3 box
      const boxHeight = 105;
      const boxBottom = y - boxHeight + 10;

      page.drawRectangle({
        x: marginX - 4,
        y: boxBottom,
        width: textWidth + 8,
        height: boxHeight,
        color: rgb(0.97, 0.97, 0.985),
      });

      page.drawText('Top 3 recommended actions', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawBulletList(
        page,
        top3Immediate,
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y = boxBottom - 14;

      // Extra immediate
      if (extraImmediate.length > 0) {
        page.drawText('Immediate actions (0-6 months)', {
          x: marginX,
          y,
          size: 12,
          font: bold,
        });

        y -= 18;

        y = drawBulletList(
          page,
          extraImmediate,
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y -= 10;
      }

      // Medium term
      page.drawText('Medium term opportunities (6-36 months)', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawBulletList(
        page,
        mediumActions,
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );
    }

    // ============================================================
    // PAGE 5 - METHODOLOGY AND GOVERNANCE
    // ============================================================

    {
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      let y = height - 60;

      page.drawText('5. Methodology and governance', {
        x: marginX,
        y,
        size: 18,
        font: bold,
      });

      page.drawLine({
        start: { x: marginX, y: y - 6 },
        end: { x: pageWidth - marginX, y: y - 6 },
        thickness: 0.6,
        color: rgb(0.8, 0.82, 0.86),
      });

      y -= 30;

      // Methodology
      page.drawText('Methodology', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawWrappedText(
        page,
        'Emission factors are based on UK Government GHG Conversion Factors (DEFRA BEIS). Electricity uses location based grid factors. Fuel emissions use standard kg CO2e per litre factors.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      if (scope3TotalKg > 0) {
        y = drawWrappedText(
          page,
          'Scope 3 values are calculated from activity data logged in Carbon Central. These are selected categories only and do not represent a full Scope 3 inventory.',
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y -= 12;
      }

      // SECR confirmation
      page.drawText('SECR methodology confirmation', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      const confirmedText =
        methodology && methodology.methodology_confirmed
          ? 'OK: The reporting organisation has confirmed that this methodology is appropriate for statutory SECR disclosures.'
          : 'WARNING: The reporting organisation has not confirmed the methodology. SECR compliance requires explicit confirmation.';

      y = drawWrappedText(
        page,
        confirmedText,
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      if (methodology?.methodology_note) {
        page.drawText('Boundary or methodology notes:', {
          x: marginX,
          y,
          size: 11,
          font: bold,
        });

        y -= 18;

        y = drawWrappedText(
          page,
          methodology.methodology_note,
          marginX,
          y,
          font,
          10,
          textWidth,
          14
        );

        y -= 12;
      }

      // Organisational boundary
      page.drawText('Organisational boundary', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawWrappedText(
        page,
        'This report covers UK operations under operational control. Additional sites or non UK operations can be added in future reporting periods.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      // Responsibility
      page.drawText('Responsibility statement', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawWrappedText(
        page,
        'Directors remain responsible for completeness and accuracy of data and for any formal SECR disclosures based on this report.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;

      // Data quality
      page.drawText('Data quality and limitations', {
        x: marginX,
        y,
        size: 12,
        font: bold,
      });

      y -= 18;

      y = drawWrappedText(
        page,
        'This report is based only on data entered in Carbon Central for this reporting period. Missing data, estimates or unlogged sites will affect completeness.',
        marginX,
        y,
        font,
        10,
        textWidth,
        14
      );

      y -= 12;
    }

    // ============================================================
    // FOOTER - PAGE NUMBERS
    // ============================================================

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    pages.forEach((p, index) => {
      const { width } = p.getSize();
      const footerY = 30;

      p.drawText('Carbon Central - Confidential', {
        x: marginX,
        y: footerY,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const label = 'Page ' + (index + 1) + ' of ' + totalPages;
      const w = font.widthOfTextAtSize(label, 9);

      p.drawText(label, {
        x: width / 2 - w / 2,
        y: footerY,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    // ============================================================
    // SAVE PDF AND UPDATE REPORT COUNT
    // ============================================================

    const pdfBytes = await pdfDoc.save();

    if (isFree && planRow?.id) {
      await supabase
        .from('user_plans')
        .update({ report_count: reportCount + 1 })
        .eq('id', planRow.id);
    }

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="carbon-report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('PDF ERROR:', err);

    const errorDoc = await PDFDocument.create();
    const font = await errorDoc.embedFont(StandardFonts.Helvetica);
    const page = errorDoc.addPage();
    const { height } = page.getSize();

    page.drawText('Error generating PDF report.', {
      x: 50,
      y: height - 50,
      size: 14,
      font,
    });

    page.drawText(String(err).slice(0, 200), {
      x: 50,
      y: height - 90,
      size: 10,
      font,
    });

    return new NextResponse(await errorDoc.save(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="carbon-report-error.pdf"',
      },
    });
  }
}

// ============================================================
// EXPORT HANDLERS
// ============================================================

export async function GET(req: NextRequest) {
  return handleReport(req);
}

export async function POST(req: NextRequest) {
  return handleReport(req);
}
