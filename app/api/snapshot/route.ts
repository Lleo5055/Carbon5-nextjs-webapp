import { NextResponse } from "next/server"; 
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Suggestion: This function can be better organized by having all data at the top, then
  // the presentation layer (creating the PDF) below it. It could also be split
  // into smaller functions. Not everything needs to be inside a try/catch
  // block.
  try {
    // -------------------------
    // LOAD DATA
    // -------------------------
    // Suggestion: Do we need to filter by user_id or similar?
    const { data: emissions } = await supabase
      .from("emissions")
      .select("*")
      .order("month", { ascending: true });

    const { data: scope3 } = await supabase
      .from("scope3_activities")
      .select("*")
      .order("month", { ascending: true });

    const em = emissions ?? [];
    const s3 = scope3 ?? [];

    // -------------------------
    // PDF START
    // -------------------------
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 800;

    // TITLE
    page.drawText("Leadership Snapshot", {
      x: 50,
      y,
      size: 22,
      font: bold,
      color: rgb(28 / 255, 60 / 255, 180 / 255),
    });

    // ---------------------------------------------------------
    // SUMMARY PARAGRAPH (THIS IS THE ONLY THING ADDED)
    // ---------------------------------------------------------
    y -= 40;

    const summary = 
      `This snapshot provides a high-level overview of your organisation’s ` +
      `carbon reporting activity. You have reported ${em.length} months of ` +
      `emission data, demonstrating consistency in tracking operational impact. ` +
      `Additionally, ${s3.length} Scope 3 activity records indicate engagement ` +
      `with value-chain emissions, a key component of mature carbon management.`;

    page.drawText(summary, {
      x: 50,
      y,
      size: 12,
      font,
      lineHeight: 14,
      maxWidth: 500
    });
// ---------------------------------------
// MINI TREND CHART (same technique as report)
// ---------------------------------------

y -= 80;

page.drawText("Trend over recent months (Scope 1 & 2)", {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: rgb(0.15, 0.15, 0.6),
});

y -= 70;

// Extract last 6 months of total_co2e
const trend = em.slice(-6).map(r => r.total_co2e || 0);
if (trend.length >= 2) {
  const chartX = 50;
  const chartY = y;
  const chartWidth = 500;
  const chartHeight = 60;

  // Chart border (optional)
  page.drawLine({
    start: { x: chartX, y: chartY },
    end: { x: chartX + chartWidth, y: chartY },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Scaling
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const range = max - min || 1;
  const step = chartWidth / (trend.length - 1);

  const scale = (value: number) => {
  return chartY + ((value - min) / range) * chartHeight;
};


  // Draw line segments
  for (let i = 0; i < trend.length - 1; i++) {
    const x1 = chartX + step * i;
    const y1 = scale(trend[i]);
    const x2 = chartX + step * (i + 1);
    const y2 = scale(trend[i + 1]);

    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1.2,
      color: rgb(0.12, 0.20, 0.75), // blue line
    });
  }

  y -= chartHeight + 35;
}
// -------------------------------------------------------
// EMISSION BREAKDOWN GRAPH (horizontal % bars)
// -------------------------------------------------------
y -= 40;
page.drawText("Emission Breakdown by Source (%)", {
  x: 50,
  y,
  size: 12,
  font: bold,
  color: rgb(0.15, 0.15, 0.6),
});

y -= 25;

// Aggregate values
let elec = em.reduce((s, r) => s + ((r.electricity_kw || 0) * (r.ef_electricity || 0)), 0);
let diesel = em.reduce((s, r) => s + ((r.diesel_litres || 0) * (r.ef_diesel || 0)), 0);
let petrol = em.reduce((s, r) => s + ((r.petrol_litres || 0) * (r.ef_petrol || 0)), 0);
let refrig = em.reduce((s, r) => s + (r.refrigerant_kg || 0), 0);
let scope3Total = s3.reduce((s, r) => s + (r.co2e_kg || 0), 0);

const fuel = diesel + petrol;

// For pie-like breakdown, we include only main buckets:
const buckets = [
  { label: "Electricity", value: elec, color: rgb(0.2, 0.4, 0.9) },
  { label: "Fuel", value: fuel, color: rgb(0.9, 0.4, 0.2) },
  { label: "Refrigerants", value: refrig, color: rgb(0.2, 0.7, 0.6) },
  { label: "Scope 3", value: scope3Total, color: rgb(0.6, 0.2, 0.7) },
];

const total = buckets.reduce((s, b) => s + b.value, 0) || 1;

const chartWidth = 300;
const barHeight = 12;

for (const b of buckets) {
  const pct = (b.value / total) * 100;
  const width = (pct / 100) * chartWidth;

  // Label
  page.drawText(`${b.label} (${pct.toFixed(1)}%)`, {
    x: 50,
    y,
    size: 11,
    font,
  });

  // Bar (filled rectangle)
  page.drawRectangle({
    x: 200,
    y: y - 4,
    width,
    height: barHeight,
    color: b.color,
  });

  y -= 25;
}

    // -------------------------
    // END PDF
    // -------------------------
    const pdfBytes = await pdf.save();

    return new NextResponse(pdfBytes.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="leadership-snapshot.pdf"',
      },
    });

  } catch (err) {
    console.error("SNAPSHOT ERROR:", err);
    return NextResponse.json(
      { error: "Failed to generate snapshot" },
      { status: 500 }
    );
  }
}
