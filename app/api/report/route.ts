import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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


export async function GET(req: NextRequest) {
  try {
    // ======================== LOAD DATA ========================
    const { data: rows } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true });

    const scope3 = await supabase
      .from('scope3_activities')
      .select('*')
      .order('month', { ascending: true });

    const s3 = scope3.data || [];
    const list = rows || [];

    // ======================== LOAD USER PROFILE ========================
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id || null;

    let profile: any = {};
    if (userId) {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      profile = p || {};
    }

    // Extract profile fields (Organisation Card)
    const companyName = profile.company_name || 'Not provided';
    const industry = profile.industry || 'Not provided';
    const empCount = Number(profile.employee_count || 0);
    const revenue = Number(profile.annual_revenue || 0);
    const outputUnits = Number(profile.annual_output_units || 0);
    const methodologyConfirmed = !!profile.methodology_confirmed;

    const eeActions = profile.energy_efficiency_actions || '';

    // ======================== CALCULATIONS ========================
    const totalElec = list.reduce((s, r) => s + safe(r.electricity_kw), 0);
    const totalDiesel = list.reduce((s, r) => s + safe(r.diesel_litres), 0);
    const totalCO2 = list.reduce((s, r) => s + safe(r.total_co2e), 0);

    const scope1_t = (totalDiesel * 2.68) / 1000;
    const scope2_t = totalElec * 0.000233;
    const scope3_t = s3.reduce((s, r) => s + safe(r.co2e_kg), 0) / 1000;

    const months = list.map((r) => r.month);
    const values = list.map((r) => safe(r.total_co2e));

    const peak = Math.max(...values, 0);
    const peakIdx = values.indexOf(peak);
    const peakMonth = months[peakIdx] || '-';

    const latest = values[values.length - 1] || 0;
    const latestMonth = months[months.length - 1] || '-';

    // ======================== PDF INIT ========================
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const BLUE = rgb(28 / 255, 60 / 255, 180 / 255); // carbon blue
    const LIGHT_TILE = rgb(230 / 255, 238 / 255, 255 / 255);
    const TEXT = rgb(32 / 255, 32 / 255, 34 / 255);

    // paragraph wrapper
    function paragraph(page, str, startX, maxWidth, size, yRef) {
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
    }

    // ========================= PAGE 1 =========================
    let page = pdf.addPage([595, 842]);
    let y = 780;

    // Header
    page.drawText('Carbon Footprint Assessment Report', {
      x: 50,
      y,
      size: 22,
      font: bold,
      color: BLUE,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 40;

    // Reporting metadata
    drawText(
      page,
      `Reporting period: all recorded months (${list.length})`,
      50,
      y,
      11,
      font,
      TEXT
    );
    y -= 18;
    drawText(page, `Organisation: ${companyName}`, 50, y, 11, font, TEXT);
    y -= 18;
    drawText(
      page,
      `Report date: ${new Date().toISOString().slice(0, 10)}`,
      50,
      y,
      11,
      font,
      TEXT
    );
    y -= 20;

    // ---------------- ORGANISATION CARD ----------------
    page.drawRectangle({
      x: 50,
      y: y - 115,
      width: 225,
      height: 115,
      color: LIGHT_TILE,
    });

    let oy = y - 14;

    page.drawText('Organisation details', {
      x: 60,
      y: oy,
      size: 12,
      font: bold,
      color: BLUE,
    });

    oy -= 18;
    page.drawText(`Company: ${companyName}`, {
      x: 60,
      y: oy,
      size: 10,
      font,
      color: TEXT,
    });
    oy -= 14;
    page.drawText(`Industry: ${industry}`, {
      x: 60,
      y: oy,
      size: 10,
      font,
      color: TEXT,
    });
    oy -= 14;
    page.drawText(`Employees: ${empCount}`, {
      x: 60,
      y: oy,
      size: 10,
      font,
      color: TEXT,
    });
    oy -= 14;
    page.drawText(`Revenue: £${revenue.toLocaleString()}`, {
      x: 60,
      y: oy,
      size: 10,
      font,
      color: TEXT,
    });
    oy -= 14;
    page.drawText(`Output units: ${outputUnits}`, {
      x: 60,
      y: oy,
      size: 10,
      font,
      color: TEXT,
    });

    // ---------------- TOTAL EMISSIONS ----------------
    y -= 140;
    page.drawText(
      `Total emissions this period: ${(totalCO2 / 1000).toFixed(2)} tCO2e`,
      { x: 50, y, size: 16, font: bold, color: BLUE }
    );

    y -= 30;

    // Summary sentence
    paragraph(
      page,
      'This report provides a structured SECR-ready summary of your greenhouse gas emissions, hotspots, and recommended actions.',
      50,
      480,
      11,
      { value: y }
    );
    y = y - 0;

    // ---------------- AT A GLANCE TILE ----------------
    y -= 20;

    page.drawRectangle({
      x: 45,
      y: y - 110,
      width: 510,
      height: 110,
      color: LIGHT_TILE,
    });

    page.drawText(`Scope 1 (fuels): ${scope1_t.toFixed(2)} tCO2e`, {
      x: 55,
      y: y - 12,
      size: 11,
      font,
      color: TEXT,
    });
    page.drawText(`Scope 2 (electricity): ${scope2_t.toFixed(2)} tCO2e`, {
      x: 55,
      y: y - 32,
      size: 11,
      font,
      color: TEXT,
    });
    page.drawText(`Scope 3 (selected): ${scope3_t.toFixed(2)} tCO2e`, {
      x: 55,
      y: y - 52,
      size: 11,
      font,
      color: TEXT,
    });

    const energy_kwh = totalElec + totalDiesel * 10;
    page.drawText(`Energy use equivalent: ${energy_kwh} kWh`, {
      x: 55,
      y: y - 72,
      size: 11,
      font,
      color: TEXT,
    });

    page.drawText(`Main hotspot: diesel fuel use`, {
      x: 55,
      y: y - 92,
      size: 11,
      font,
      color: TEXT,
    });

    // ==== FOOTER PAGE 1 ====
    page.drawText('Carbon Central · SECR-ready emissions report · Page 1', {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
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
      color: BLUE,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 34;

    // ---- KEY METRICS SUMMARY ----
    page.drawText(`Total emissions: ${(totalCO2 / 1000).toFixed(2)} tCO2e`, {
      x: 50,
      y,
      size: 12,
      font,
      color: TEXT,
    });

    y -= 20;
    page.drawText(
      `Electricity (Scope 2): ${(totalElec * 0.233).toFixed(0)} kg CO2e`,
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
      `Fuels (Scope 1 – diesel): ${(totalDiesel * 2.68).toFixed(0)} kg CO2e`,
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
      color: BLUE,
    });
    y -= 22;

    page.drawText(`Highest month: ${peakMonth} (${peak.toFixed(2)} kg CO2e)`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });

    y -= 18;
    page.drawText(
      `Latest month: ${latestMonth} (${latest.toFixed(2)} kg CO2e)`,
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
      color: BLUE,
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

    function sx(i) {
      return 50 + (i / Math.max(values.length - 1, 1)) * 495;
    }
    function sy(v) {
      const max = Math.max(...values, 1);
      const min = Math.min(...values, 0);
      return chartBaseY - 70 + 60 - ((v - min) / (max - min || 1)) * 60;
    }

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
      color: BLUE,
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
      page.drawRectangle({
        x: 45,
        y: y - 16,
        width: 510,
        height: 22,
        color: rowShade ? rgb(0.95, 0.95, 0.97) : rgb(0.98, 0.98, 1),
      });

      rowShade = !rowShade;

      page.drawText(r.month, { x: 55, y: y - 5, size: 11, font, color: TEXT });
      page.drawText(String(safe(r.electricity_kw)), {
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
    page.drawText('Carbon Central · SECR-ready emissions report · Page 2', {
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
    page.drawText('3. Scope breakdown and SECR summary', {
      x: 50,
      y,
      size: 18,
      font: bold,
      color: BLUE,
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

    paragraph(
      page,
      'Includes emissions from combustion of diesel in company-operated vehicles or equipment.',
      50,
      480,
      11,
      { value: y }
    );

    y -= 20;

    // ---- Scope 2 ----
    page.drawText(
      `Scope 2 (purchased electricity): ${scope2_t.toFixed(2)} tCO2e`,
      { x: 50, y, size: 12, font, color: TEXT }
    );
    y -= 16;

    paragraph(
      page,
      'Calculated using UK location-based grid factors issued by DEFRA BEIS.',
      50,
      480,
      11,
      { value: y }
    );

    y -= 20;

    // ---- Scope 3 ----
    page.drawText(
      `Scope 3 (selected categories): ${scope3_t.toFixed(3)} tCO2e`,
      { x: 50, y, size: 12, font, color: TEXT }
    );
    y -= 16;

    paragraph(
      page,
      'Scope 3 values represent only categories recorded in Carbon Central. This is not a complete Scope 3 inventory.',
      50,
      480,
      11,
      { value: y }
    );

    // Add spacing before table
    y -= 40;

    // ---- Scope 3 SUMMARY TABLE ----
    page.drawText('Scope 3 (selected categories – summary)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
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

    // ---- HOTSPOT ----
    page.drawText('Hotspot analysis', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 20;

    paragraph(
      page,
      'Fuel usage remains the dominant hotspot. Operational routing, driving behaviour, and maintenance practices represent the main levers for reducing emissions.',
      50,
      480,
      11,
      { value: y }
    );

    y -= 40;

    // ---- SECR ----
    page.drawText('SECR summary', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    page.drawText(`Electricity: ${totalElec.toFixed(0)} kWh`, {
      x: 50,
      y,
      size: 11,
      font,
      color: TEXT,
    });
    y -= 16;

    page.drawText(
      `Road fuels (diesel): ${(totalDiesel * 10.9).toFixed(0)} kWh`,
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
      `Total energy: ${(totalElec + totalDiesel * 10.9).toFixed(0)} kWh`,
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
      color: BLUE,
    });
    y -= 20;

    page.drawText(
      `tCO2e per employee: ${
        empCount ? (totalCO2 / 1000 / empCount).toFixed(3) : 'data not provided'
      }`,
      { x: 50, y, size: 11, font, color: TEXT }
    );

    y -= 16;

    page.drawText(
      `tCO2e per £ revenue: ${
        revenue ? (totalCO2 / 1000 / revenue).toFixed(6) : 'data not provided'
      }`,
      { x: 50, y, size: 11, font, color: TEXT }
    );

    y -= 16;

    page.drawText(
      `tCO2e per output unit: ${
        outputUnits
          ? (totalCO2 / 1000 / outputUnits).toFixed(6)
          : 'data not provided'
      }`,
      { x: 50, y, size: 11, font, color: TEXT }
    );
    // ---- FOOTER ----
    page.drawText('Carbon Central · SECR-ready emissions report · Page 3', {
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
      color: BLUE,
    });

    page.drawLine({
      start: { x: 50, y: y - 6 },
      end: { x: 545, y: y - 6 },
      thickness: 1,
      color: BLUE,
    });

    y -= 40;

    // ---------------- DYNAMIC SIGNALS ----------------
    const total_t = scope1_t + scope2_t + scope3_t;
    const s1_share = total_t ? scope1_t / total_t : 0;
    const s2_share = total_t ? scope2_t / total_t : 0;
    const s3_share = total_t ? scope3_t / total_t : 0;

    let dominant = 'fuel';
    if (s2_share > s1_share && s2_share > s3_share) dominant = 'electricity';
    if (s3_share > s1_share && s3_share > s2_share) dominant = 'scope3';

    let trend = 'stable';
    if (values.length > 3) {
      const first = values[0];
      const last = values[values.length - 1];
      if (last > first * 1.15) trend = 'rising';
      else if (last < first * 0.85) trend = 'falling';
      else trend = 'inconsistent';
    }

    const missingData = list.length === 0 || values.includes(0);

    // ---------------- PARAGRAPH FUNCTION ----------------
    function paragraphText(textStr) {
      const maxWidth = 480;
      const fontSize = 11;
      let words = textStr.split(' ');
      let line = '';

      for (let w of words) {
        const testLine = line + w + ' ';
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth) {
          page.drawText(line.trim(), {
            x: 50,
            y,
            size: fontSize,
            font,
            color: TEXT,
          });
          y -= 15;
          line = w + ' ';
        } else {
          line = testLine;
        }
      }

      if (line.trim() !== '') {
        page.drawText(line.trim(), {
          x: 50,
          y,
          size: fontSize,
          font,
          color: TEXT,
        });
        y -= 15;
      }

      y -= 12;
    }

    // ---------------- KEY INSIGHTS ----------------
    page.drawText('Key insights', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 26;

    // INSIGHT 1 — Emissions profile
    paragraphText(
      dominant === 'fuel'
        ? 'Fuel combustion is the primary source of emissions, highlighting a fleet-intensive operational model. Mileage patterns, idling behaviour and route variability strongly influence emissions outcomes.'
        : dominant === 'electricity'
        ? 'Electricity consumption accounts for the largest emissions share, indicating that facilities, equipment and operational hours drive most carbon intensity.'
        : 'Scope 3 activities represent the dominant emissions contributors, indicating upstream supply chain processes and purchased goods have the strongest influence on organisational carbon impact.'
    );

    // INSIGHT 2 — Operational interpretation
    paragraphText(
      dominant === 'fuel'
        ? 'Operational fuel use suggests inefficiencies such as non-optimised routing, inconsistent driver behaviour or under-maintained vehicles. These are common high-impact areas in transport-oriented operations.'
        : dominant === 'electricity'
        ? 'Electricity-driven emissions suggest opportunities in equipment efficiency, load control, heating and cooling optimisation and facility utilisation.'
        : 'A Scope 3-heavy profile highlights the need for deeper supplier engagement, data collection and value-chain transparency to build a complete emissions baseline.'
    );

    // INSIGHT 3 — Trend interpretation
    let trendParagraph =
      trend === 'rising'
        ? 'Recent emissions indicate an upward trajectory, signalling increased operational load or reduced efficiency. This trend warrants immediate diagnostic analysis.'
        : trend === 'falling'
        ? 'Emissions have declined over recent months, reflecting early improvements or reduced operational intensity. Continued monitoring can help maintain momentum.'
        : 'Month-to-month fluctuations show no consistent trend, suggesting varying operational patterns or inconsistent data logging.';
    if (missingData)
      trendParagraph +=
        ' Some entries appear incomplete or zero, reducing analytical confidence.';
    paragraphText(trendParagraph);

    // INSIGHT 4 — Strategic implications
    paragraphText(
      dominant === 'fuel'
        ? 'Long-term decarbonisation will require structured fleet optimisation, including driver training, telematics, preventative maintenance and a phased transition to hybrid or electric vehicles.'
        : dominant === 'electricity'
        ? 'Strategic reductions will require integrated energy-efficiency planning, equipment upgrades and a shift towards renewable or lower-carbon electricity procurement.'
        : 'Meaningful reductions require supply-chain collaboration, sustainability requirements in procurement, data transparency and prioritisation of high-impact suppliers.'
    );

    y -= 10;

    // ---------------- TOP 3 RECOMMENDED ACTIONS ----------------
    page.drawText('Top 3 recommended actions', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
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

    actions.forEach((a) => paragraphText(a));

    y -= 10;

    // ---------------- IMMEDIATE ACTIONS (0–6M) ----------------
    page.drawText('Immediate actions (0–6 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
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

    imm.forEach((a) => paragraphText(a));

    y -= 10;

    // ---------------- MEDIUM TERM OPPORTUNITIES (6–36M) ----------------
    page.drawText('Medium term opportunities (6–36 months)', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
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

    med.forEach((a) => paragraphText(a));

    // ---- FOOTER ----
    page.drawText('Carbon Central · SECR-ready emissions report · Page 4', {
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
      color: BLUE,
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
      color: BLUE,
    });
    y -= 22;

    paragraphText(
      'Emission calculations use UK Government GHG Conversion Factors (DEFRA BEIS). Electricity uses location-based grid factors, fuel emissions use standard kg CO2e/litre values and Scope 3 emissions use category-specific conversion factors.'
    );

    paragraphText(
      'Scope 1 reflects direct emissions from fuel use. Scope 2 reflects purchased electricity. Scope 3 reflects only categories recorded during this reporting period and is not a complete value-chain inventory.'
    );

    paragraphText(
      'Boundary: This report follows an operational-control boundary unless otherwise stated. The reporting period covers all months entered by the organisation.'
    );

    // ---------------- METHODOLOGY CONFIRMATION ----------------
    page.drawText('SECR methodology confirmation', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    if (methodologyConfirmed) {
      paragraphText(
        'The organisation has confirmed that the SECR calculation methodology used in this report is correct and approved.'
      );
    } else {
      paragraphText(
        'The organisation has NOT confirmed the SECR methodology. A fully SECR-compliant disclosure cannot be issued until confirmation is provided.'
      );
    }

    // ---------------- ORGANISATIONAL BOUNDARY ----------------
    page.drawText('Organisational boundary', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    paragraphText(
      'This report covers UK operations under operational control. Additional locations or non-UK operations may be added in future reporting cycles.'
    );

    // ---------------- RESPONSIBILITY STATEMENT ----------------
    page.drawText('Responsibility statement', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    paragraphText(
      'Directors or authorised representatives are responsible for the completeness and accuracy of all data provided. Carbon Central calculations use the data exactly as entered and do not include independent verification unless separately commissioned.'
    );

    // ---------------- ENERGY EFFICIENCY ACTIONS ----------------
    page.drawText('Energy efficiency actions this year', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    if (eeActions && eeActions.trim().length > 0) {
      paragraphText(eeActions.trim());
    } else {
      paragraphText(
        'No energy-efficiency actions were reported for this year.'
      );
    }

    // ---------------- DATA QUALITY ----------------
    page.drawText('Data quality and limitations', {
      x: 50,
      y,
      size: 12,
      font: bold,
      color: BLUE,
    });
    y -= 22;

    paragraphText(
      'This report is based only on data entered into Carbon Central. Months with missing entries, zero values or partial Scope 3 coverage may reduce completeness and analytical accuracy.'
    );

    // ---- FOOTER ----
    page.drawText('Carbon Central · SECR-ready emissions report · Page 5', {
      x: 180,
      y: 20,
      size: 9,
      font,
      color: TEXT,
    });

    // ========================= RETURN PDF =========================
    const pdfBytes = await pdf.save();

    return new NextResponse(pdfBytes, {
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
