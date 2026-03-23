import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFPage, PDFFont, RGB } from "pdf-lib";
import { getFactorsForCountry } from "@/lib/factors";
import { calcRefrigerantCo2e } from "@/lib/emissionFactors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ── COLOURS — Greenio brand scheme ──
const C = {
  NAVY:    rgb(15/255,  55/255,  30/255),   // dark Greenio green (header)
  ACCENT:  rgb(33/255, 140/255,  69/255),   // Greenio primary green
  SCOPE1:  rgb(220/255, 80/255,  20/255),   // orange — fuel (kept distinct)
  SCOPE2:  rgb(29/255,  78/255, 216/255),   // blue — electricity (kept distinct)
  SCOPE3:  rgb(109/255, 40/255, 217/255),   // purple — value chain (kept distinct)
  REFRIG:  rgb(5/255,  150/255, 105/255),   // teal — refrigerants (kept distinct)
  WHITE:   rgb(1, 1, 1),
  BGCARD:  rgb(249/255, 251/255, 249/255),  // near-white with slight green tint
  DARK:    rgb(15/255,  23/255,  42/255),   // dark charcoal text
  MID:     rgb(71/255,  85/255,  90/255),   // mid grey-slate text
  MUTED:   rgb(148/255,163/255, 160/255),   // muted grey text
  RULE:    rgb(210/255, 225/255, 215/255),  // light grey-green borders
  GREEN:   rgb(22/255, 120/255,  55/255),   // confirmed/positive green
  AMBER:   rgb(217/255,119/255,   6/255),   // amber — warnings
  RED:     rgb(185/255, 28/255,  28/255),   // red — alerts
};

const PW = 595; // page width
const ML = 40;  // left margin
const MR = 555; // right margin
const CW = MR - ML; // 515

function safe(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function elecKwh(r: Record<string, unknown>) { return safe(r.electricity_kwh ?? r.electricity_kw); }
function fmt(n: number, d = 2) { return n.toFixed(d); }
function sanitize(s: string) {
  return s.replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"').replace(/[\u2080-\u2089]/g, "")
          .replace(/[^\x00-\xFF]/g, "");
}

// ── DRAW UTILITIES ──
function fillRect(p: PDFPage, x: number, y: number, w: number, h: number, c: RGB, opacity = 1) {
  p.drawRectangle({ x, y, width: w, height: h, color: c, opacity });
}
function border(p: PDFPage, x: number, y: number, w: number, h: number, c: RGB, t = 0.5) {
  p.drawRectangle({ x, y, width: w, height: h, borderColor: c, borderWidth: t });
}
function line(p: PDFPage, x1: number, y1: number, x2: number, y2: number, c: RGB, t = 0.5) {
  p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color: c });
}
function label(p: PDFPage, t: string, x: number, y: number, sz: number, f: PDFFont, c: RGB, mw?: number) {
  p.drawText(t, { x, y, size: sz, font: f, color: c, ...(mw ? { maxWidth: mw } : {}) });
}

function sectionHead(p: PDFPage, bf: PDFFont, x: number, y: number, text: string, ruleEnd: number) {
  label(p, text.toUpperCase(), x, y, 7, bf, C.ACCENT);
  line(p, x, y - 5, ruleEnd, y - 5, C.RULE, 0.6);
}

function kpiCard(
  p: PDFPage, f: PDFFont, bf: PDFFont,
  x: number, y: number, w: number, h: number,
  title: string, val: string, sub: string, ac: RGB
) {
  fillRect(p, x, y, w, h, C.BGCARD);
  border(p, x, y, w, h, C.RULE, 0.5);
  fillRect(p, x, y, 3, h, ac);
  label(p, title.toUpperCase(), x + 9, y + h - 15, 6.5, f, C.MID);
  label(p, val, x + 9, y + h - 34, 16, bf, ac);
  label(p, sub, x + 9, y + 8, 7, f, C.MUTED);
}

function horizBar(
  p: PDFPage, f: PDFFont,
  x: number, y: number, trackW: number,
  pct: number, lbl: string, valStr: string, c: RGB, lblW = 82
) {
  const bH = 10;
  const bX = x + lblW;
  const bW = Math.max((pct / 100) * trackW, pct > 0 ? 2 : 0);
  fillRect(p, bX, y, trackW, bH, C.RULE);
  if (bW > 0) fillRect(p, bX, y, bW, bH, c);
  label(p, lbl, x, y + 1, 7.5, f, C.DARK);
  label(p, valStr, bX + trackW + 4, y + 1, 7, f, C.MID);
}

// Convert month label to "Jan '25" format.
// Handles both "YYYY-MM" (e.g. "2025-04") and "Month YYYY" (e.g. "April 2025").
function fmtMonthLbl(raw: string): string {
  const MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  // YYYY-MM
  const ymMatch = raw.match(/^(\d{4})-(\d{2})/);
  if (ymMatch) {
    const moIdx = parseInt(ymMatch[2], 10) - 1;
    if (moIdx >= 0 && moIdx <= 11) return `${MNAMES[moIdx]} '${ymMatch[1].slice(2)}`;
  }
  // "Month YYYY" (full name, e.g. "April 2025")
  const nameMatch = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (nameMatch) {
    const moIdx = FULL.findIndex(m => m.toLowerCase() === nameMatch[1].toLowerCase());
    if (moIdx !== -1) return `${MNAMES[moIdx]} '${nameMatch[2].slice(2)}`;
  }
  return raw.slice(0, 7);
}

function miniChart(
  p: PDFPage, f: PDFFont,
  vals: number[], lbls: string[],
  x: number, y: number, w: number, h: number, c: RGB
) {
  if (vals.length < 2) {
    fillRect(p, x, y, w, h, C.BGCARD);
    border(p, x, y, w, h, C.RULE, 0.4);
    const msg = "Add monthly data to see trend";
    const mw = f.widthOfTextAtSize(msg, 7.5);
    label(p, msg, x + (w - mw) / 2, y + h / 2 - 4, 7.5, f, C.MUTED);
    return;
  }
  const maxV = Math.max(...vals) || 1;
  const chartH = h - 18; // leave 18pt for x-axis labels
  const step = w / (vals.length - 1);
  const px = (i: number) => x + step * i;
  const py = (v: number) => y + 16 + (v / maxV) * chartH;

  // Grid lines
  for (let t = 0; t <= 2; t++) {
    const gv = (maxV * t) / 2;
    const gy = py(gv);
    line(p, x, gy, x + w, gy, C.RULE, 0.3);
    const gl = gv >= 1000 ? `${(gv/1000).toFixed(1)}t` : `${Math.round(gv)}kg`;
    label(p, gl, x - 30, gy - 3, 6, f, C.MUTED);
  }

  // Area fill
  for (let i = 0; i < vals.length - 1; i++) {
    const baseY = py(0);
    const x1 = px(i), y1 = py(vals[i]);
    const x2 = px(i + 1), y2 = py(vals[i + 1]);
    const avgH = ((y1 - baseY) + (y2 - baseY)) / 2;
    if (avgH > 0) {
      p.drawRectangle({ x: x1, y: baseY, width: x2 - x1, height: avgH, color: c, opacity: 0.15 });
    }
  }

  // Line
  for (let i = 0; i < vals.length - 1; i++) {
    p.drawLine({ start: { x: px(i), y: py(vals[i]) }, end: { x: px(i+1), y: py(vals[i+1]) }, thickness: 1.8, color: c });
  }

  // Dots
  for (let i = 0; i < vals.length; i++) {
    p.drawCircle({ x: px(i), y: py(vals[i]), size: 2.5, color: c });
  }

  // X labels — show every 3rd month; clamp so labels never overflow chart edges
  lbls.forEach((l, i) => {
    if (i % 3 !== 0) return;
    const formatted = fmtMonthLbl(l);
    const lw = f.widthOfTextAtSize(formatted, 6);
    const lx = Math.min(Math.max(px(i) - lw / 2, x), x + w - lw);
    label(p, formatted, lx, y + 2, 6, f, C.MUTED);
  });
}

function wrap(text: string, f: PDFFont, sz: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(t, sz) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function bullets(
  p: PDFPage, f: PDFFont, bf: PDFFont,
  x: number, startY: number, items: string[], maxW: number
): number {
  let y = startY;
  for (const item of items) {
    const lines = wrap(item, f, 8.5, maxW - 16);
    label(p, "\u2022", x, y, 10, bf, C.ACCENT);
    lines.forEach((ln, li) => label(p, ln, x + 12, y - li * 12, 8.5, f, C.DARK));
    y -= lines.length * 12 + 9;
  }
  return y;
}

// ── SHARED PDF BUILDER ──
interface PdfInput {
  companyName: string; industry: string; countryCode: string; periodLabel: string;
  monthCount: number;
  total_t: number; scope1_t: number; scope2_t: number; scope3_t: number;
  scope2_kg: number; scope1fuel_kg: number; refrigCo2eKg: number; scope3_kg: number;
  trendVals: number[]; trendLabels: string[];
  trendPct: number | null; trendUp: boolean;
  s3Entries: [string, number][];
  intEmp: number | null; intRev: number | null;
  insights: string[]; aiSummary: string;
  performance?: {
    score: number;
    stars: number;
    statusLabel: string | null;
    statusDescription: string | null;
    riskLevel: string;
    trendStability: string;
    monthlyCompliance: string;
  } | null;
}

async function buildPdf(p: PdfInput): Promise<Uint8Array> {
  const CNAMES: Record<string,string> = {
    GB:"United Kingdom",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",
    NL:"Netherlands",PL:"Poland",SE:"Sweden",BE:"Belgium",AT:"Austria",
    IE:"Ireland",DK:"Denmark",PT:"Portugal",IN:"India",US:"United States",
  };
  const CATL: Record<string,string> = {
    employee_commuting:"Commuting", business_travel:"Biz. Travel",
    purchased_goods:"Purchased Goods", waste:"Waste",
    upstream_transport:"Upstream", downstream_transport:"Downstream", other:"Other",
  };
  const IND_AVG = 1.82;
  const GT = (p.total_t * 1000) || 1;
  const elecPct   = (p.scope2_kg    / GT) * 100;
  const fuelPct   = (p.scope1fuel_kg / GT) * 100;
  const refrigPct = (p.refrigCo2eKg  / GT) * 100;
  const s3Pct     = (p.scope3_kg    / GT) * 100;

  const pdf  = await PDFDocument.create();
  const page = pdf.addPage([PW, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const company = p.companyName || "Your Organisation";
  const country = CNAMES[p.countryCode] ?? p.countryCode;

  // ── HEADER ──
  fillRect(page, 0, 782, PW, 60, C.NAVY);
  fillRect(page, 0, 782, 4, 60, C.ACCENT);
  label(page, "Leadership Snapshot", ML, 820, 21, bold, C.WHITE);
  label(page, company, ML, 800, 9, font, rgb(160/255,210/255,175/255));
  const perStr = `Period: ${p.periodLabel}`;
  label(page, perStr, MR - bold.widthOfTextAtSize(perStr, 8), 820, 8, bold, rgb(160/255,210/255,175/255));
  const metaStr = [p.industry, country].filter(Boolean).join("  |  ");
  if (metaStr) label(page, metaStr, MR - font.widthOfTextAtSize(metaStr, 7.5), 800, 7.5, font, rgb(130/255,185/255,150/255));

  // ── KPI CARDS ──
  const KPI_Y = 706; const KPI_H = 68; const KPI_W = (CW - 18) / 4;
  [
    { t:"Total CO2e", v:`${fmt(p.total_t)} t`,  s:`${p.monthCount} month${p.monthCount!==1?"s":""} recorded`, c:C.ACCENT },
    { t:"Scope 1",    v:`${fmt(p.scope1_t)} t`, s:"Fuel & refrigerants",                                       c:C.SCOPE1 },
    { t:"Scope 2",    v:`${fmt(p.scope2_t)} t`, s:"Grid electricity",                                          c:C.SCOPE2 },
    { t:"Scope 3",    v:`${fmt(p.scope3_t)} t`, s:"Value chain",                                               c:C.SCOPE3 },
  ].forEach((k, i) => kpiCard(page, font, bold, ML + i*(KPI_W+6), KPI_Y, KPI_W, KPI_H, k.t, k.v, k.s, k.c));

  // ── PERFORMANCE  y=616–688 ──
  const PERF_TOP = 688; const PERF_BOT = 616;
  if (p.performance) {
    const perf = p.performance;
    const scoreStr = `Score: ${perf.score} / 100`;
    const sw = bold.widthOfTextAtSize(scoreStr, 7.5);
    sectionHead(page, bold, ML, PERF_TOP, "Performance", MR - sw - 10);
    label(page, scoreStr, MR - sw, PERF_TOP, 7.5, bold, C.ACCENT);

    // Status pill + stars + description
    const ROW_Y = PERF_TOP - 18;
    if (perf.statusLabel) {
      const pillC = perf.statusLabel === 'Falling' ? C.GREEN : perf.statusLabel === 'Rising' ? C.RED : C.AMBER;
      const pillBg = perf.statusLabel === 'Falling' ? rgb(236/255,253/255,245/255)
        : perf.statusLabel === 'Rising' ? rgb(254/255,242/255,242/255) : rgb(255/255,251/255,235/255);
      const pillW = bold.widthOfTextAtSize(perf.statusLabel, 7) + 8;
      fillRect(page, ML, ROW_Y - 1, pillW, 11, pillBg);
      label(page, perf.statusLabel, ML + 4, ROW_Y + 1, 7, bold, pillC);
      const starX0 = ML + pillW + 8;
      for (let i = 0; i < 5; i++) {
        if (i < perf.stars) fillRect(page, starX0 + i * 9, ROW_Y, 7, 7, C.AMBER);
        else border(page, starX0 + i * 9, ROW_Y, 7, 7, C.RULE, 0.8);
      }
      if (perf.statusDescription) {
        const descX = starX0 + 5 * 9 + 8;
        label(page, sanitize(perf.statusDescription), descX, ROW_Y + 1, 7, font, C.MID, MR - descX);
      }
    } else {
      label(page, 'Insufficient data for month-over-month comparison.', ML, ROW_Y + 1, 7, font, C.MUTED);
    }

    // Stat cards: Risk Signals | Trend Stability | Monthly Compliance
    const cardY = PERF_BOT + 4;
    const cardH = 28;
    const CARD_W = (CW - 8) / 3;
    const riskC = perf.riskLevel === 'High' ? C.RED : perf.riskLevel === 'Medium' ? C.AMBER : C.GREEN;
    const trendC = perf.trendStability === 'Falling' ? C.GREEN : perf.trendStability === 'Rising' ? C.RED : C.AMBER;
    const compC = perf.monthlyCompliance === 'On track' ? C.GREEN : C.MUTED;
    ([
      { title: 'RISK SIGNALS',       value: perf.riskLevel,         col: riskC  },
      { title: 'TREND STABILITY',    value: perf.trendStability,    col: trendC },
      { title: 'MONTHLY COMPLIANCE', value: perf.monthlyCompliance, col: compC  },
    ] as { title: string; value: string; col: RGB }[]).forEach((card, i) => {
      const cx = ML + i * (CARD_W + 4);
      fillRect(page, cx, cardY, CARD_W, cardH, C.BGCARD);
      border(page, cx, cardY, CARD_W, cardH, C.RULE, 0.5);
      fillRect(page, cx, cardY, 3, cardH, card.col);
      label(page, card.title, cx + 8, cardY + cardH - 11, 5.5, font, C.MUTED);
      label(page, card.value, cx + 8, cardY + 7, 9, bold, card.col);
    });
  } else {
    sectionHead(page, bold, ML, PERF_TOP, "Performance", MR);
    label(page, 'Performance data not available.', ML, PERF_TOP - 18, 7.5, font, C.MUTED);
  }

  // ── BENCHMARKING  y=524–598 ──
  const BH_TOP = 598; const BH_BOT = 524;
  sectionHead(page, bold, ML, BH_TOP, "Benchmarking vs Industry Average", MR);
  const BENCH_LBL_W = 108;
  const BENCH_BAR_W = CW - BENCH_LBL_W;
  const BENCH_BAR_H = 13;
  const ROW1_Y = BH_TOP - 30;
  const ROW2_Y = BH_TOP - 54;
  const BENCH_BAR_X = ML + BENCH_LBL_W;
  const maxBench = Math.max(p.total_t, IND_AVG, 0.01);

  fillRect(page, BENCH_BAR_X, ROW1_Y, BENCH_BAR_W, BENCH_BAR_H, C.RULE);
  const yourBarW = Math.min(p.total_t / maxBench, 1) * BENCH_BAR_W;
  if (yourBarW > 0) fillRect(page, BENCH_BAR_X, ROW1_Y, yourBarW, BENCH_BAR_H, C.ACCENT, 0.85);
  label(page, "Your total", ML, ROW1_Y + 10, 6.5, font, C.MID);
  label(page, `${fmt(p.total_t,2)} t`, ML, ROW1_Y + 0, 10, bold, C.ACCENT);

  fillRect(page, BENCH_BAR_X, ROW2_Y, BENCH_BAR_W, BENCH_BAR_H, C.RULE);
  const smeBarW = (IND_AVG / maxBench) * BENCH_BAR_W;
  if (smeBarW > 0) fillRect(page, BENCH_BAR_X, ROW2_Y, smeBarW, BENCH_BAR_H, C.AMBER, 0.85);
  label(page, "SME average", ML, ROW2_Y + 10, 6.5, font, C.MID);
  label(page, `${fmt(IND_AVG,2)} t`, ML, ROW2_Y + 0, 10, bold, C.AMBER);

  const ctxMsg = p.total_t === 0
    ? "Add emission data to see your position relative to the SME average of 1.82 tCO2e."
    : p.total_t <= IND_AVG
      ? `You are ${fmt(IND_AVG-p.total_t,2)} tCO2e below the SME average - strong performance.`
      : `You are ${fmt(p.total_t-IND_AVG,2)} tCO2e above the SME average. Focus on Scope 1 and 2 to close the gap.`;
  label(page, p.aiSummary || ctxMsg, ML, BH_BOT + 8, 7.5, font, C.MID, CW);

  // ── TREND + SOURCES  y=376–506 ──
  const R2_BOT = 376; const R2_TOP = 506;
  sectionHead(page, bold, ML, R2_TOP, "Emissions Trend", ML + 258);
  if (p.trendPct !== null) {
    const bc = p.trendUp ? C.RED : C.GREEN;
    const bgC = p.trendUp ? rgb(254/255,242/255,242/255) : rgb(236/255,253/255,245/255);
    const bs = `${p.trendUp?"+":""}${fmt(p.trendPct,1)}% vs prior period`;
    const titleW = bold.widthOfTextAtSize("EMISSIONS TREND", 7);
    const bw = bold.widthOfTextAtSize(bs, 6.5) + 8;
    fillRect(page, ML + titleW + 6, R2_TOP - 2, bw, 10, bgC);
    label(page, bs, ML + titleW + 10, R2_TOP + 2, 6.5, bold, bc);
  }
  sectionHead(page, bold, ML + 268, R2_TOP, "Emission Sources", MR);
  line(page, ML+258, R2_BOT, ML+258, R2_TOP+2, C.RULE, 0.6);
  miniChart(page, font, p.trendVals, p.trendLabels, ML + 34, R2_BOT + 8, 216, R2_TOP - R2_BOT - 20, C.ACCENT);

  const srcX = ML + 268;
  const srcBarW = MR - srcX - 82 - 58;
  [
    { l:"Electricity", p:elecPct,   v:`${fmt(p.scope2_kg/1000,2)} t  ${fmt(elecPct,1)}%`,    c:C.SCOPE2 },
    { l:"Fuel",        p:fuelPct,   v:`${fmt(p.scope1fuel_kg/1000,2)} t  ${fmt(fuelPct,1)}%`, c:C.SCOPE1 },
    { l:"Refrigerants",p:refrigPct, v:`${fmt(p.refrigCo2eKg/1000,2)} t  ${fmt(refrigPct,1)}%`,c:C.REFRIG },
    { l:"Scope 3",     p:s3Pct,     v:`${fmt(p.scope3_kg/1000,2)} t  ${fmt(s3Pct,1)}%`,       c:C.SCOPE3 },
  ].forEach((b, i) => horizBar(page, font, srcX, R2_TOP - 18 - i * 22, srcBarW, b.p, b.l, b.v, b.c));

  // ── INTENSITY + SCOPE 3  y=258–358 ──
  const R3_TOP = 358; const R3_BOT = 260;
  sectionHead(page, bold, ML, R3_TOP, "Intensity Metrics", ML + 218);
  sectionHead(page, bold, ML + 268, R3_TOP, "Scope 3 Breakdown", MR);
  line(page, ML+258, R3_BOT, ML+258, R3_TOP+2, C.RULE, 0.6);
  const IT = R3_TOP - 18;
  label(page, "tCO2e / employee", ML, IT, 7.5, font, C.MID);
  label(page, p.intEmp !== null ? `${fmt(p.intEmp,2)} t` : "N/A", ML, IT - 16, 14, bold, p.intEmp !== null ? C.ACCENT : C.MUTED);
  label(page, "tCO2e / M revenue", ML + 112, IT, 7.5, font, C.MID);
  label(page, p.intRev !== null ? `${fmt(p.intRev,2)} t` : "N/A", ML + 112, IT - 16, 14, bold, p.intRev !== null ? C.ACCENT : C.MUTED);
  label(page, "SME average: ~1.82 tCO2e per employee", ML, R3_BOT + 6, 6.5, font, C.MID);
  const S3X = ML + 268;
  const s3BarW = MR - S3X - 72 - 44;
  if (p.s3Entries.length === 0) {
    label(page, "No Scope 3 activities recorded yet", S3X, IT - 8, 8, font, C.MUTED);
  } else {
    const s3Total = p.s3Entries.reduce((s,[,v])=>s+v,0)||1;
    p.s3Entries.forEach(([cat, val], i) =>
      horizBar(page, font, S3X, IT - 8 - i*22, s3BarW, (val/s3Total)*100, CATL[cat]??cat, `${fmt(val/1000,2)} t`, C.SCOPE3, 72));
  }

  // ── INSIGHTS  y=242 ──
  sectionHead(page, bold, ML, 242, "Key Insights & Recommendations", MR);
  bullets(page, font, bold, ML, 224, p.insights, CW);

  // ── FOOTER ──
  fillRect(page, 0, 28, PW, 28, rgb(245/255,249/255,246/255));
  line(page, 0, 56, PW, 56, C.RULE, 0.5);
  const today = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const FACTOR_LABELS: Record<string, string> = {
    GB: "DEFRA 2025  |  BEIS / National Grid 2026  |  IPCC AR6",
    IN: "CEA / IEA 2026  |  DEFRA 2025  |  IPCC AR6",
  };
  const factorStr = FACTOR_LABELS[p.countryCode] ?? "Eurostat 2026  |  DEFRA 2025  |  IPCC AR6";
  label(page, `Generated: ${today}   |   Boundary: Operational Control   |   Factors: ${factorStr}   |   Greenio`, ML, 37, 6.5, font, C.MUTED);

  return pdf.save();
}

// ── POST HANDLER (browser sends pre-fetched data — no server-side DB calls) ──
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    // ── Plan gate: Leadership Snapshot is Pro+ only ──
    const reqUserId = b.userId as string | undefined;
    if (reqUserId) {
      try {
        const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const hdrs = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

        let userPlan: string | null = null;

        // Direct plan lookup
        const planRows = await fetch(
          `${SB_URL}/rest/v1/user_plans?user_id=eq.${reqUserId}&select=plan&order=created_at.desc&limit=1`,
          { headers: hdrs }
        ).then(r => r.json());
        if (Array.isArray(planRows) && planRows[0]?.plan) {
          userPlan = planRows[0].plan;
        }

        // Team member — inherit owner's plan
        if (!userPlan) {
          const memberRows = await fetch(
            `${SB_URL}/rest/v1/team_members?member_user_id=eq.${reqUserId}&status=eq.active&select=owner_id&limit=1`,
            { headers: hdrs }
          ).then(r => r.json());
          const ownerId = Array.isArray(memberRows) && memberRows[0]?.owner_id ? memberRows[0].owner_id : null;
          if (ownerId) {
            const ownerPlanRows = await fetch(
              `${SB_URL}/rest/v1/user_plans?user_id=eq.${ownerId}&select=plan&order=created_at.desc&limit=1`,
              { headers: hdrs }
            ).then(r => r.json());
            if (Array.isArray(ownerPlanRows) && ownerPlanRows[0]?.plan) {
              userPlan = ownerPlanRows[0].plan;
            }
          }
        }

        if (!['pro', 'enterprise'].includes(userPlan ?? '')) {
          return NextResponse.json(
            { error: 'Leadership Snapshot requires a Pro plan. Upgrade at /billing.' },
            { status: 403 }
          );
        }
      } catch {
        // Fail open — don't block Pro users due to a network hiccup
      }
    }

    const elecCo2eKg   = safe(b.elecCo2eKg);
    const fuelCo2eKg   = safe(b.fuelCo2eKg);
    const refrigCo2eKg = safe(b.refrigCo2eKg);
    const scope3_kg    = safe(b.scope3Kg);
    const total_kg     = elecCo2eKg + fuelCo2eKg + refrigCo2eKg + scope3_kg;
    const total_t      = total_kg / 1000;

    const trendMonths  = ((b.trendMonths ?? []) as { label: string; totalKg: number }[])
      .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
    let trendPct: number | null = null;
    let trendUp = false;
    if (trendMonths.length >= 4) {
      const half = Math.floor(trendMonths.length / 2);
      const f1 = trendMonths.slice(0, half).reduce((s, m) => s + m.totalKg, 0);
      const f2 = trendMonths.slice(half).reduce((s, m) => s + m.totalKg, 0);
      if (f1 > 0) { trendPct = ((f2 - f1) / f1) * 100; trendUp = trendPct > 0; }
    }

    const employeeCount = safe(b.employeeCount);
    const annualRevenue = safe(b.annualRevenue);
    const GT = total_kg || 1;
    const elecPct   = (elecCo2eKg   / GT) * 100;
    const fuelPct   = (fuelCo2eKg   / GT) * 100;
    const refrigPct = (refrigCo2eKg  / GT) * 100;
    const s3Pct     = (scope3_kg    / GT) * 100;

    const rawInsights = Array.isArray(b.insights) ? (b.insights as string[]).map(sanitize).filter(Boolean) : [];
    let insights = rawInsights.length >= 3 ? rawInsights : (() => {
      const dom = fuelPct >= elecPct && fuelPct >= refrigPct && fuelPct >= s3Pct ? "fuel"
        : elecPct >= refrigPct && elecPct >= s3Pct ? "electricity"
        : refrigPct >= s3Pct ? "refrigerant" : "scope3";
      const iMap: Record<string,string> = {
        fuel:        `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. Audit consumption by fuel type — diesel, petrol, natural gas, LPG or CNG — and target the largest source first for the highest-impact reduction.`,
        electricity: `Electricity (Scope 2) represents ${fmt(elecPct,1)}% of your footprint. Switching to a renewable tariff or on-site solar can eliminate most of these emissions.`,
        refrigerant: `Refrigerant leaks account for ${fmt(refrigPct,1)}% of emissions. A scheduled leak-detection programme is the single highest-impact action available.`,
        scope3:      `Value-chain activities (Scope 3) represent ${fmt(s3Pct,1)}% of total. Engaging key suppliers on their own carbon targets is the most effective lever.`,
      };
      const trendStr = trendPct !== null
        ? `Emissions ${trendUp?"increased":"decreased"} ${Math.abs(trendPct).toFixed(1)}% period-on-period. ${trendUp?"Investigate the highest months to identify the cause of increase.":"Maintain this positive trajectory by continuing current efficiency initiatives."}`
        : "Record at least 4 months of data to unlock period-on-period trend analysis and track your reduction progress.";
      const intEmpVal = employeeCount > 0 ? total_t / employeeCount : null;
      const intStr = intEmpVal !== null
        ? `Carbon intensity is ${fmt(intEmpVal,2)} tCO2e per employee vs an SME average of ~1.82. ${intEmpVal < 1.82 ? "You are below the SME average - strong performance." : "Operational efficiency can help close the gap."}`
        : "Complete your profile with employee headcount and annual revenue to unlock intensity benchmarking.";
      return [iMap[dom], trendStr, intStr];
    })();

    const scope3ByCat = (b.scope3ByCat ?? {}) as Record<string, number>;
    const s3Entries = Object.entries(scope3ByCat).sort((a,b)=>b[1]-a[1]).slice(0,4) as [string, number][];

    const perf = b.performanceData as {
      score: number; stars: number; statusLabel: string | null;
      statusDescription: string | null; riskLevel: string;
      trendStability: string; monthlyCompliance: string;
    } | null ?? null;

    const pdfBytes = await buildPdf({
      companyName:  String(b.companyName ?? "Your Organisation"),
      industry:     String(b.industry ?? ""),
      countryCode:  String(b.countryCode ?? "GB"),
      periodLabel:  String(b.periodLabel ?? "All time"),
      monthCount:   trendMonths.length,
      total_t, scope1_t: (fuelCo2eKg + refrigCo2eKg) / 1000,
      scope2_t: elecCo2eKg / 1000, scope3_t: scope3_kg / 1000,
      scope2_kg: elecCo2eKg, scope1fuel_kg: fuelCo2eKg,
      refrigCo2eKg, scope3_kg,
      trendVals: trendMonths.map(m => m.totalKg),
      trendLabels: trendMonths.map(m => m.label),
      trendPct, trendUp, s3Entries,
      intEmp: employeeCount > 0 ? total_t / employeeCount : null,
      intRev: annualRevenue > 0 ? total_t / (annualRevenue / 1_000_000) : null,
      insights, aiSummary: sanitize(String(b.aiSummary ?? "")),
      performance: perf,
    });

    const snapCompany = String(b.companyName ?? 'Greenio').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const snapFilename = `${snapCompany}-snapshot.pdf`;

    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${snapFilename}"`,
      },
    });
  } catch (err: unknown) {
    console.error("[SNAPSHOT POST ERROR]", err);
    return NextResponse.json({ error: "Failed to generate snapshot" }, { status: 500 });
  }
}

// ── GET HANDLER (kept for direct URL access — may fail if Node.js network blocked) ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Period params
    const periodType = searchParams.get("periodType");
    const period     = searchParams.get("period");
    let startMonth   = searchParams.get("start");
    let endMonth     = searchParams.get("end");

    if (periodType === "quick" && period && period !== "All") {
      const m = Number(period.replace("M", ""));
      if (!isNaN(m)) {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        const start = new Date(end);
        start.setMonth(start.getMonth() - (m - 1));
        const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        startMonth = f(start); endMonth = f(end);
      }
    }

    // ── FETCH ALL DATA via Supabase REST API (direct fetch, no client library) ──
    const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const hdrs: HeadersInit = {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    };

    const [emJson, s3Json, profileJson, aiJson] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/emissions?user_id=eq.${userId}&order=month.asc`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SB_URL}/rest/v1/scope3_activities?user_id=eq.${userId}&order=month.asc`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SB_URL}/rest/v1/profiles?id=eq.${userId}&select=company_name,industry,country,employee_count,annual_revenue&limit=1`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SB_URL}/rest/v1/ai_benchmarking?user_id=eq.${userId}&select=benchmarking&limit=1`, { headers: hdrs }).then(r => r.json()),
    ]);

    console.log("[SNAPSHOT] userId:", userId);
    console.log("[SNAPSHOT] emissions rows:", Array.isArray(emJson) ? emJson.length : emJson);
    console.log("[SNAPSHOT] scope3 rows:", Array.isArray(s3Json) ? s3Json.length : s3Json);
    console.log("[SNAPSHOT] profile:", JSON.stringify(Array.isArray(profileJson) ? profileJson[0] : profileJson));

    let em = (Array.isArray(emJson) ? emJson : []) as Record<string, unknown>[];
    const s3All = (Array.isArray(s3Json) ? s3Json : []) as Record<string, unknown>[];
    const profile = (Array.isArray(profileJson) ? profileJson[0] : {}) as Record<string, unknown> ?? {};
    const aiBench = (Array.isArray(aiJson) ? aiJson[0]?.benchmarking : null) ?? null;

    // Period filter
    if ((periodType === "quick" || periodType === "custom") && startMonth && endMonth) {
      const s = new Date(startMonth), e = new Date(endMonth);
      em = em.filter(r => { const d = new Date(r.month as string); return d >= s && d <= e; });
    }

    // ── EMISSION FACTORS ──
    const cc = (em[em.length-1]?.country_code as string) ?? (profile.country as string) ?? "GB";
    const ef = getFactorsForCountry(cc);
    const CNAMES: Record<string,string> = {
      GB:"United Kingdom",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",
      NL:"Netherlands",PL:"Poland",SE:"Sweden",BE:"Belgium",AT:"Austria",
      IE:"Ireland",DK:"Denmark",PT:"Portugal",IN:"India",US:"United States",
    };

    // ── CALCULATIONS ──
    const elecKwhTotal = em.reduce((s, r) => s + elecKwh(r), 0);
    const dieselTotal  = em.reduce((s, r) => s + safe(r.diesel_litres), 0);
    const petrolTotal  = em.reduce((s, r) => s + safe(r.petrol_litres), 0);
    const gasTotal     = em.reduce((s, r) => s + safe(r.gas_kwh), 0);
    const lpgTotal     = em.reduce((s, r) => s + safe(r.lpg_kg), 0);
    const cngTotal     = em.reduce((s, r) => s + safe(r.cng_kg), 0);
    const refrigCo2eKg = em.reduce((s, r) =>
      s + calcRefrigerantCo2e(safe(r.refrigerant_kg), (r.refrigerant_code as string) ?? "GENERIC_HFC"), 0);

    const scope2_kg     = elecKwhTotal * ef.electricity;
    const scope1fuel_kg = dieselTotal * ef.diesel + petrolTotal * ef.petrol + gasTotal * ef.gas + lpgTotal * ef.lpgKg + cngTotal * ef.cngKg;
    const scope1_kg     = scope1fuel_kg + refrigCo2eKg;
    const scope3_kg     = s3All.reduce((s, r) => s + safe(r.co2e_kg), 0);

    // Fallback: if raw recalc gives 0 (e.g. old data without raw fields), use stored total_co2e
    const storedKg   = em.reduce((s, r) => s + safe(r.total_co2e), 0);
    const calcTotal  = scope1_kg + scope2_kg;
    const useStored  = calcTotal === 0 && storedKg > 0;

    const eff_scope1 = useStored ? storedKg * 0.55 : scope1_kg;
    const eff_scope2 = useStored ? storedKg * 0.45 : scope2_kg;
    const total_kg   = (useStored ? storedKg : calcTotal) + scope3_kg;

    const total_t  = total_kg  / 1000;
    const scope1_t = eff_scope1 / 1000;
    const scope2_t = eff_scope2 / 1000;
    const scope3_t = scope3_kg  / 1000;

    const GT = total_kg || 1;
    const elecPct   = (scope2_kg    / GT) * 100;
    const fuelPct   = (scope1fuel_kg / GT) * 100;
    const refrigPct = (refrigCo2eKg  / GT) * 100;
    const s3Pct     = (scope3_kg    / GT) * 100;

    // Intensity
    const empCount = safe(profile.employee_count);
    const revenue  = safe(profile.annual_revenue);
    const intEmp   = empCount > 0 ? total_t / empCount : null;
    const intRev   = revenue  > 0 ? total_t / (revenue / 1_000_000) : null;

    // Trend
    let trendPct: number | null = null;
    let trendUp = false;
    if (em.length >= 4) {
      const half = Math.floor(em.length / 2);
      const f1 = em.slice(0, half).reduce((s, r) => s + safe(r.total_co2e), 0);
      const f2 = em.slice(half).reduce((s, r) => s + safe(r.total_co2e), 0);
      if (f1 > 0) { trendPct = ((f2 - f1) / f1) * 100; trendUp = trendPct > 0; }
    }

    const MA = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const trendVals   = em.map(r => safe(r.total_co2e));
    const trendLabels = em.map(r => MA[new Date(r.month as string).getMonth()]);

    const periodLabel = em.length
      ? (() => { const s = new Date(em[0].month as string); const e = new Date(em[em.length-1].month as string);
                 return `${MA[s.getMonth()]} ${s.getFullYear()} - ${MA[e.getMonth()]} ${e.getFullYear()}`; })()
      : "All time";

    // Scope 3 breakdown
    const s3Cat: Record<string,number> = {};
    for (const r of s3All) { const c = (r.category as string) ?? "other"; s3Cat[c] = (s3Cat[c]??0) + safe(r.co2e_kg); }
    const s3Entries = Object.entries(s3Cat).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const CATL: Record<string,string> = {
      employee_commuting:"Commuting", business_travel:"Biz. Travel",
      purchased_goods:"Purchased Goods", waste:"Waste",
      upstream_transport:"Upstream", downstream_transport:"Downstream", other:"Other",
    };

    // Insights
    let insights: string[] = [];
    if (aiBench?.insights?.length >= 3) {
      insights = (aiBench.insights as string[]).slice(0, 3).map(sanitize);
    } else {
      const dom = fuelPct >= elecPct && fuelPct >= refrigPct && fuelPct >= s3Pct ? "fuel"
        : elecPct >= refrigPct && elecPct >= s3Pct ? "electricity"
        : refrigPct >= s3Pct ? "refrigerant" : "scope3";
      // Determine dominant fuel type for a specific insight
      const fuelCo2ByType: [string, number][] = [
        ['diesel',  dieselTotal * ef.diesel],
        ['petrol',  petrolTotal * ef.petrol],
        ['gas',     gasTotal    * ef.gas],
        ['lpg',     lpgTotal    * ef.lpgKg],
        ['cng',     cngTotal    * ef.cngKg],
      ].filter(([, v]) => (v as number) > 0) as [string, number][];
      const dominantFuel = fuelCo2ByType.sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? 'diesel';
      const fuelInsightMap: Record<string, string> = {
        diesel:  `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. Diesel is the largest fuel source — fleet route optimisation and transitioning to EVs or HVO are the highest-impact near-term actions.`,
        petrol:  `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. Petrol is the largest fuel source — driver efficiency training and electrifying the vehicle fleet are the most effective levers.`,
        gas:     `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. Natural gas / PNG is the largest source — upgrading boilers, improving insulation and switching to heat pumps can significantly reduce this.`,
        lpg:     `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. LPG is the largest fuel source — substituting with PNG where available or switching to electric alternatives will deliver the greatest reductions.`,
        cng:     `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. CNG is the largest fuel source — optimising vehicle loads and scheduling, or transitioning to EVs, are the most effective near-term actions.`,
      };
      const fuelInsight = fuelInsightMap[dominantFuel] ??
        `Fuel (Scope 1) accounts for ${fmt(fuelPct,1)}% of emissions. Audit consumption by fuel type — diesel, petrol, natural gas, LPG or CNG — and target the largest source first for the highest-impact reduction.`;
      const iMap: Record<string,string> = {
        fuel:        fuelInsight,
        electricity: `Electricity (Scope 2) represents ${fmt(elecPct,1)}% of your footprint. Switching to a renewable tariff or investing in on-site solar can eliminate most of these emissions.`,
        refrigerant: `Refrigerant leaks account for ${fmt(refrigPct,1)}% of emissions. A scheduled leak-detection programme is the single highest-impact action available.`,
        scope3:      `Value-chain activities (Scope 3) represent ${fmt(s3Pct,1)}% of total. Engaging key suppliers on their own carbon targets is the most effective lever.`,
      };
      const trendStr = trendPct !== null
        ? `Emissions ${trendUp ? "increased" : "decreased"} ${Math.abs(trendPct).toFixed(1)}% period-on-period. ${trendUp ? "Investigate the highest months to identify the cause of increase." : "Maintain this positive trajectory by continuing current efficiency initiatives."}`
        : "Record at least 4 months of data to unlock period-on-period trend analysis and track your emission reduction progress.";
      const intStr = intEmp !== null
        ? `Carbon intensity is ${fmt(intEmp,2)} tCO2e per employee vs an SME average of ~1.82. ${intEmp < 1.82 ? "You are below the SME average - strong performance." : "Operational efficiency measures can help close the gap."}`
        : "Complete your profile with employee headcount and annual revenue to unlock intensity benchmarking metrics.";
      insights = [iMap[dom], trendStr, intStr];
    }

    const aiSummary = sanitize(aiBench?.summary ?? "");
    const IND_AVG = 1.82;

    // ── BUILD PDF ──
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([PW, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const company  = (profile.company_name as string) ?? "Your Organisation";
    const industry = (profile.industry as string) ?? "";
    const country  = CNAMES[cc] ?? cc;

    // ═══════════════════════════════════════════════
    // SECTION 1 — HEADER  y=782–842  h=60
    // ═══════════════════════════════════════════════
    fillRect(page, 0, 782, PW, 60, C.NAVY);
    fillRect(page, 0, 782, 4, 60, C.ACCENT); // left accent

    label(page, "Leadership Snapshot", ML, 820, 21, bold, C.WHITE);
    label(page, company, ML, 800, 9, font, rgb(160/255,210/255,175/255));

    const perStr = `Period: ${periodLabel}`;
    label(page, perStr, MR - bold.widthOfTextAtSize(perStr, 8), 820, 8, bold, rgb(160/255,210/255,175/255));

    const metaStr = [industry, country].filter(Boolean).join("  |  ");
    if (metaStr) label(page, metaStr, MR - font.widthOfTextAtSize(metaStr, 7.5), 800, 7.5, font, rgb(130/255,185/255,150/255));

    // ═══════════════════════════════════════════════
    // SECTION 2 — KPI CARDS  y=706–774  h=68
    // ═══════════════════════════════════════════════
    const KPI_Y = 706; const KPI_H = 68;
    const KPI_W = (CW - 18) / 4; // 4 cards, 3 gaps of 6pt

    [
      { t:"Total CO2e", v:`${fmt(total_t)} t`,  s:`${em.length} month${em.length!==1?"s":""} recorded`, c:C.ACCENT  },
      { t:"Scope 1",    v:`${fmt(scope1_t)} t`, s:"Fuel & refrigerants",                                  c:C.SCOPE1  },
      { t:"Scope 2",    v:`${fmt(scope2_t)} t`, s:"Grid electricity",                                     c:C.SCOPE2  },
      { t:"Scope 3",    v:`${fmt(scope3_t)} t`, s:"Value chain",                                          c:C.SCOPE3  },
    ].forEach((k, i) => kpiCard(page, font, bold, ML + i*(KPI_W+6), KPI_Y, KPI_W, KPI_H, k.t, k.v, k.s, k.c));

    // Trend badge
    if (trendPct !== null) {
      const bc = trendUp ? C.RED : C.GREEN;
      const bs = `${trendUp?"+":""}${fmt(trendPct,1)}% vs prior period`;
      const bw = bold.widthOfTextAtSize(bs, 7) + 10;
      fillRect(page, ML, KPI_Y - 15, bw, 13, trendUp ? rgb(254/255,242/255,242/255) : rgb(236/255,253/255,245/255));
      label(page, bs, ML+5, KPI_Y - 9, 7, bold, bc);
    }

    // ═══════════════════════════════════════════════
    // SECTION 3 — TREND CHART + EMISSION SOURCES
    //  y=556–690  h=134
    // ═══════════════════════════════════════════════
    const R2_BOT = 556; const R2_TOP = 690;

    sectionHead(page, bold, ML, R2_TOP, "Emissions Trend", ML + 258);
    sectionHead(page, bold, ML + 268, R2_TOP, "Emission Sources", MR);
    line(page, ML+258, R2_BOT, ML+258, R2_TOP+2, C.RULE, 0.6); // divider

    // Chart (left)
    miniChart(page, font, trendVals, trendLabels,
      ML + 34, R2_BOT + 8, 216, R2_TOP - R2_BOT - 20, C.ACCENT);

    // Emission source bars (right)
    const srcX = ML + 268;
    const bW = MR - srcX - 68; // bar track width
    [
      { l:"Electricity", p:elecPct,   v:`${fmt(scope2_kg/1000,2)}t  ${fmt(elecPct,1)}%`,    c:C.SCOPE2 },
      { l:"Fuel",        p:fuelPct,   v:`${fmt(scope1fuel_kg/1000,2)}t  ${fmt(fuelPct,1)}%`, c:C.SCOPE1 },
      { l:"Refrigerants",p:refrigPct, v:`${fmt(refrigCo2eKg/1000,2)}t  ${fmt(refrigPct,1)}%`,c:C.REFRIG },
      { l:"Scope 3",     p:s3Pct,     v:`${fmt(scope3_kg/1000,2)}t  ${fmt(s3Pct,1)}%`,       c:C.SCOPE3 },
    ].forEach((b, i) => {
      horizBar(page, font, srcX, R2_TOP - 18 - i * 22, bW, b.p, b.l, b.v, b.c);
    });

    // ═══════════════════════════════════════════════
    // SECTION 4 — INTENSITY + SCOPE 3 BREAKDOWN
    //  y=444–544  h=100
    // ═══════════════════════════════════════════════
    const R3_TOP = 542; const R3_BOT = 444;

    sectionHead(page, bold, ML, R3_TOP, "Intensity Metrics", ML + 218);
    sectionHead(page, bold, ML + 268, R3_TOP, "Scope 3 Breakdown", MR);
    line(page, ML+258, R3_BOT, ML+258, R3_TOP+2, C.RULE, 0.6);

    // Intensity left
    const IT = R3_TOP - 18;
    label(page, "tCO2e / employee", ML, IT, 7.5, font, C.MID);
    label(page, intEmp !== null ? `${fmt(intEmp,2)} t` : "N/A", ML, IT - 16, 14, bold, intEmp !== null ? C.ACCENT : C.MUTED);

    label(page, "tCO2e / M revenue", ML + 112, IT, 7.5, font, C.MID);
    label(page, intRev !== null ? `${fmt(intRev,2)} t` : "N/A", ML + 112, IT - 16, 14, bold, intRev !== null ? C.ACCENT : C.MUTED);

    label(page, "SME average: ~1.82 tCO2e per employee", ML, R3_BOT + 6, 6.5, font, C.MUTED);

    // Scope 3 breakdown right
    const S3X = ML + 268;
    const S3W = MR - S3X - 60;
    if (s3Entries.length === 0) {
      label(page, "No Scope 3 activities recorded yet", S3X, IT - 8, 8, font, C.MUTED);
    } else {
      const s3Total = s3Entries.reduce((s,[,v])=>s+v,0)||1;
      s3Entries.forEach(([cat, val], i) => {
        horizBar(page, font, S3X, IT - 8 - i*22, S3W, (val/s3Total)*100,
          CATL[cat]??cat, `${fmt(val/1000,2)}t`, C.SCOPE3, 72);
      });
    }

    // ═══════════════════════════════════════════════
    // SECTION 5 — BENCHMARKING  y=358–434  h=76
    // ═══════════════════════════════════════════════
    const BH_TOP = 432; const BH_BOT = 358;

    sectionHead(page, bold, ML, BH_TOP, "Benchmarking vs SME Average", MR);

    const BTRK = CW; // full content width for bar track
    const BAR_Y = BH_TOP - 26; const BAR_H = 14;
    const maxBench = Math.max(total_t, IND_AVG, 0.01);

    fillRect(page, ML, BAR_Y, BTRK, BAR_H, C.RULE); // track
    const yourW = Math.min((total_t / maxBench) * BTRK, BTRK);
    if (yourW > 0) fillRect(page, ML, BAR_Y, yourW, BAR_H, C.ACCENT);

    const avgX = ML + (IND_AVG / maxBench) * BTRK;
    line(page, avgX, BAR_Y - 4, avgX, BAR_Y + BAR_H + 4, C.AMBER, 2);

    label(page, `You: ${fmt(total_t,2)} tCO2e`, ML, BAR_Y - 10, 7.5, bold, C.ACCENT);

    // SME Avg label — clamp to page
    const smeLbl = `SME Avg: ${IND_AVG} tCO2e`;
    const smeLblW = font.widthOfTextAtSize(smeLbl, 7);
    const smeLblX = Math.min(avgX - smeLblW / 2, MR - smeLblW - 2);
    label(page, smeLbl, smeLblX, BAR_Y + BAR_H + 7, 7, font, C.AMBER);

    const ctxMsg = total_t === 0
      ? "Add emission data to see your position relative to the SME average of 1.82 tCO2e."
      : total_t <= IND_AVG
        ? `You are ${fmt(IND_AVG-total_t,2)} tCO2e below the SME average - strong performance. Keep logging to track progress.`
        : `You are ${fmt(total_t-IND_AVG,2)} tCO2e above the SME average. Scope 1 and 2 reductions are the recommended focus.`;
    label(page, aiSummary || ctxMsg, ML, BH_BOT + 8, 7.5, font, C.MID, BTRK);

    // ═══════════════════════════════════════════════
    // SECTION 6 — KEY INSIGHTS  y=66–350
    // ═══════════════════════════════════════════════
    const INS_TOP = 348;
    sectionHead(page, bold, ML, INS_TOP, "Key Insights & Recommendations", MR);
    bullets(page, font, bold, ML, INS_TOP - 18, insights, CW);

    // ═══════════════════════════════════════════════
    // SECTION 7 — FOOTER  y=28–56
    // ═══════════════════════════════════════════════
    fillRect(page, 0, 28, PW, 28, rgb(245/255,249/255,246/255));
    line(page, 0, 56, PW, 56, C.RULE, 0.5);
    const today = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    label(page, `Generated: ${today}   |   Boundary: Operational Control   |   Factors: DEFRA 2025 / EU Eurostat 2026   |   Greenio`,
      ML, 37, 6.5, font, C.MUTED);

    const pdfBytes = await pdf.save();
    const getSnapCompany = ((profile.company_name as string) ?? 'Greenio').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getSnapCompany}-snapshot.pdf"`,
      },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SNAPSHOT ERROR]", msg);
    const isNetwork = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND");
    return NextResponse.json({
      error: isNetwork
        ? "Cannot reach database. Your Supabase project may be paused — visit supabase.com/dashboard to restore it."
        : "Failed to generate snapshot",
      detail: msg,
    }, { status: 500 });
  }
}
