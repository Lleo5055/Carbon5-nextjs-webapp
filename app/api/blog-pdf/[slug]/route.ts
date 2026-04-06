import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFPage, PDFFont, RGB } from 'pdf-lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Brand colours ──
const C = {
  NAVY:    rgb(15/255,  55/255,  30/255),
  ACCENT:  rgb(33/255, 140/255,  69/255),
  DARK:    rgb(15/255,  23/255,  42/255),
  MID:     rgb(71/255,  85/255,  90/255),
  MUTED:   rgb(148/255,163/255, 160/255),
  RULE:    rgb(210/255, 225/255, 215/255),
  BGCARD:  rgb(249/255, 251/255, 249/255),
  WHITE:   rgb(1, 1, 1),
  RED:     rgb(185/255, 28/255,  28/255),
  BLUE:    rgb(29/255,  78/255, 216/255),
  GREEN:   rgb(22/255, 120/255,  55/255),
  CTASUB:  rgb(160/255, 210/255, 185/255), // readable light sage on NAVY background
};

const PW = 595;
const PH = 842;
const ML = 40;
const MR = 555;
const CW = MR - ML;

// CTA is always pinned at the bottom of the page
const CTA_Y = 58;   // bottom of CTA rect (above footer)
const CTA_H = 50;

function fillRect(p: PDFPage, x: number, y: number, w: number, h: number, c: RGB, opacity = 1) {
  p.drawRectangle({ x, y, width: w, height: h, color: c, opacity });
}
function txt(p: PDFPage, t: string, x: number, y: number, sz: number, f: PDFFont, c: RGB, mw?: number) {
  p.drawText(t, { x, y, size: sz, font: f, color: c, ...(mw ? { maxWidth: mw } : {}) });
}
function hline(p: PDFPage, x1: number, y1: number, x2: number, c: RGB, t = 0.5) {
  p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness: t, color: c });
}
function sanitize(s: string) {
  return s
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u20ac/g, 'EUR')   // € → EUR (WinAnsi Helvetica can't reliably encode it)
    .replace(/[^\x00-\xFF]/g, '');
}

function addHeader(p: PDFPage, bf: PDFFont, f: PDFFont, title: string, subtitle: string) {
  fillRect(p, 0, PH - 70, PW, 70, C.NAVY);
  txt(p, 'GREENIO', ML, PH - 24, 9, bf, C.ACCENT);
  txt(p, sanitize(title), ML, PH - 46, 15, bf, C.WHITE, CW);
  txt(p, sanitize(subtitle), ML, PH - 62, 9, f, C.CTASUB);
}

function addFooter(p: PDFPage, f: PDFFont, date: string) {
  hline(p, ML, 30, MR, C.RULE, 0.5);
  txt(p, 'greenio.co.uk', ML, 16, 7.5, f, C.MUTED);
  txt(p, date, MR - 60, 16, 7.5, f, C.MUTED);
}

function sectionHead(p: PDFPage, bf: PDFFont, y: number, text: string) {
  txt(p, text.toUpperCase(), ML, y, 7.5, bf, C.ACCENT);
  hline(p, ML, y - 6, MR, C.RULE, 0.5);
}

function ctaBanner(p: PDFPage, bf: PDFFont, f: PDFFont, headline: string, sub: string) {
  fillRect(p, ML, CTA_Y, CW, CTA_H, C.NAVY);
  // Left accent bar
  fillRect(p, ML, CTA_Y, 4, CTA_H, C.ACCENT);
  txt(p, sanitize(headline), ML + 16, CTA_Y + CTA_H - 18, 10, bf, C.WHITE, CW - 100);
  txt(p, sanitize(sub), ML + 16, CTA_Y + 10, 8, f, C.CTASUB, CW - 100);
  txt(p, 'greenio.co.uk', MR - 75, CTA_Y + 10, 8.5, bf, C.ACCENT);
}

function tableRow(
  p: PDFPage, f: PDFFont, bf: PDFFont,
  y: number, cols: string[], widths: number[], bold: boolean, shade: boolean
) {
  if (shade) fillRect(p, ML, y - 3, CW, 17, C.BGCARD);
  let x = ML + 4;
  cols.forEach((col, i) => {
    txt(p, sanitize(col), x, y, 8.5, bold ? bf : f, bold ? C.NAVY : C.DARK, widths[i] - 6);
    x += widths[i];
  });
}

// ── BRSR PDF ──
async function buildBrsrPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const bf = await doc.embedFont(StandardFonts.HelveticaBold);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const p = doc.addPage([PW, PH]);
  addHeader(p, bf, f, 'Is BRSR Mandatory in 2026? Quick Reference', 'Business Responsibility and Sustainability Reporting - India');
  addFooter(p, f, date);
  ctaBanner(p, bf, f, 'Automate your BRSR GHG disclosures with Greenio', 'Track Scope 1, 2 & 3 emissions. Export BRSR-ready reports in minutes.');

  let y = PH - 95;

  // At a glance
  sectionHead(p, bf, y, 'At a Glance');
  y -= 22;

  const glanceRows: [string, string][] = [
    ['Who must file?', 'Top 1000 NSE/BSE listed companies by market cap'],
    ['Since when?', 'FY 2022-23 (mandatory)'],
    ['BRSR Core?', 'Top 150 companies - enhanced disclosures + third-party assurance'],
    ['Voluntary for?', 'Unlisted companies and smaller listed companies'],
    ['Filed with?', 'Annual Report (SEBI mandate)'],
    ['Deadline?', 'Within 60 days of FY end (by 31 May for most companies)'],
  ];
  glanceRows.forEach(([q, a], i) => {
    if (i % 2 === 0) fillRect(p, ML, y - 3, CW, 17, C.BGCARD);
    txt(p, sanitize(q), ML + 4, y, 8.5, bf, C.NAVY, 155);
    txt(p, sanitize(a), ML + 165, y, 8.5, f, C.DARK, CW - 169);
    y -= 18;
  });

  y -= 10;
  sectionHead(p, bf, y, 'Three Tiers of Compliance');
  y -= 22;

  const tiers: { label: string; detail: string; color: RGB }[] = [
    { label: 'Top 150 Companies', detail: 'BRSR Core filing + mandatory third-party assurance', color: C.GREEN },
    { label: 'Top 1000 Companies', detail: 'Full BRSR mandatory filing with SEBI annual report', color: C.ACCENT },
    { label: 'All Other Companies', detail: 'Voluntary BRSR adoption - encouraged but not required', color: C.MUTED },
  ];
  tiers.forEach(t => {
    fillRect(p, ML, y - 4, 4, 20, t.color);
    fillRect(p, ML + 4, y - 4, CW - 4, 20, C.BGCARD);
    txt(p, sanitize(t.label), ML + 12, y + 7, 9, bf, C.DARK);
    txt(p, sanitize(t.detail), ML + 12, y - 2, 8, f, C.MID, CW - 20);
    y -= 26;
  });

  y -= 10;
  sectionHead(p, bf, y, 'Key Disclosure Areas (9 Principles)');
  y -= 20;

  const principles = [
    'P1  Ethical governance & integrity',
    'P2  Sustainable products & processes',
    'P3  Employee wellbeing',
    'P4  Stakeholder engagement',
    'P5  Human rights',
    'P6  Environmental stewardship (Energy, Water, Waste, GHG)',
    'P7  Policy advocacy',
    'P8  Inclusive growth',
    'P9  Consumer responsibility',
  ];
  principles.forEach((pr, i) => {
    if (i % 2 === 0) fillRect(p, ML, y - 2, CW, 15, C.BGCARD);
    txt(p, sanitize(pr), ML + 6, y, 8.5, i === 5 ? bf : f, i === 5 ? C.ACCENT : C.DARK);
    y -= 16;
  });

  y -= 10;
  sectionHead(p, bf, y, 'GHG Emissions Under BRSR (Principle 6)');
  y -= 20;

  const ghgRows: [string, string][] = [
    ['Scope 1', 'Direct emissions - fuel combustion, company vehicles, refrigerants'],
    ['Scope 2', 'Indirect emissions - purchased electricity, steam, heat'],
    ['Scope 3', 'Value chain emissions - business travel, supply chain (voluntary)'],
    ['Unit', 'Metric tonnes CO2e (tCO2e)'],
    ['Intensity', 'Per rupee of turnover AND per employee - both required'],
  ];
  ghgRows.forEach(([lbl, detail], i) => {
    if (i % 2 === 0) fillRect(p, ML, y - 3, CW, 17, C.BGCARD);
    txt(p, sanitize(lbl), ML + 4, y, 8.5, bf, C.NAVY, 80);
    txt(p, sanitize(detail), ML + 90, y, 8.5, f, C.DARK, CW - 94);
    y -= 18;
  });

  return doc.save();
}

// ── CSRD PDF ──
async function buildCsrdPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const bf = await doc.embedFont(StandardFonts.HelveticaBold);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const p = doc.addPage([PW, PH]);
  addHeader(p, bf, f, 'CSRD Timeline 2025-2026 Cheat Sheet', 'Corporate Sustainability Reporting Directive - EU');
  addFooter(p, f, date);
  ctaBanner(p, bf, f, 'Track GHG emissions for your CSRD report with Greenio', 'Scope 1, 2 & 3 data collection, ESRS E1 reporting, and audit-ready exports.');

  let y = PH - 95;

  sectionHead(p, bf, y, 'Phased Rollout - Who Reports When');
  y -= 24;

  const waves = [
    { wave: 'Wave 1', year: '2024', type: 'Large PIEs', detail: 'Listed, 500+ employees', deadline: '28 March 2025', urgent: false, done: true },
    { wave: 'Wave 2', year: '2025', type: 'Other Large Companies', detail: '250+ employees OR EUR40m+ turnover', deadline: '28 March 2026', urgent: true, done: false },
    { wave: 'Wave 3', year: '2026', type: 'Listed SMEs', detail: 'Opt-out available until 31 Dec 2027', deadline: '28 March 2027*', urgent: false, done: false },
  ];

  waves.forEach(w => {
    const borderC = w.urgent ? C.RED : w.done ? C.MUTED : C.ACCENT;
    fillRect(p, ML, y - 8, CW, 32, C.BGCARD);
    fillRect(p, ML, y - 8, 4, 32, borderC);
    txt(p, sanitize(w.wave + ' (' + w.year + ')'), ML + 12, y + 14, 9, bf, borderC);
    txt(p, sanitize(w.type), ML + 110, y + 14, 9, bf, C.DARK);
    txt(p, sanitize(w.detail), ML + 12, y + 2, 8, f, C.MID, 200);
    txt(p, 'Deadline: ' + sanitize(w.deadline), MR - 120, y + 14, 8.5, f, C.MID);
    if (w.urgent) txt(p, 'ACT NOW', MR - 62, y + 2, 7.5, bf, C.RED);
    y -= 38;
  });

  y -= 6;
  txt(p, '* Listed SMEs may opt out of Wave 3 until 31 December 2027', ML, y, 7.5, f, C.MUTED);
  y -= 18;

  sectionHead(p, bf, y, 'ESRS - European Sustainability Reporting Standards');
  y -= 20;

  const esrs: [string, string, string][] = [
    ['ESRS 2', 'General disclosures', 'Mandatory for all'],
    ['E1', 'Climate change (GHG, energy, transition plan)', 'Mandatory + phase-in'],
    ['E2', 'Pollution', 'If material'],
    ['E3', 'Water & marine resources', 'If material'],
    ['E4', 'Biodiversity & ecosystems', 'If material'],
    ['E5', 'Resource use & circular economy', 'If material'],
    ['S1-S4', 'Social (workforce, communities, consumers)', 'If material'],
    ['G1', 'Business conduct', 'If material'],
  ];

  const colW: [number, number, number] = [60, 275, 180];
  tableRow(p, f, bf, y, ['Standard', 'Topic', 'Applicability'], colW, true, false);
  hline(p, ML, y - 4, MR, C.RULE, 0.5);
  y -= 16;
  esrs.forEach(([std, topic, app], i) => {
    tableRow(p, f, bf, y, [std, topic, app], colW, false, i % 2 === 0);
    y -= 16;
  });

  y -= 10;
  sectionHead(p, bf, y, 'Double Materiality Assessment - Key Steps');
  y -= 20;

  const steps = [
    '1  Map your value chain - upstream suppliers and downstream customers',
    '2  Identify impacts, risks and opportunities (IROs) across ESRS topics',
    '3  Assess impact materiality: scale, scope, irremediability',
    '4  Assess financial materiality: likelihood and potential magnitude',
    '5  Prioritise material topics and set your disclosure scope',
    '6  Have assessment validated (Wave 2 requires limited assurance)',
  ];
  steps.forEach((s, i) => {
    if (i % 2 === 0) fillRect(p, ML, y - 2, CW, 15, C.BGCARD);
    txt(p, sanitize(s), ML + 6, y, 8.5, f, C.DARK);
    y -= 16;
  });

  return doc.save();
}

// ── SECR PDF ──
async function buildSecrPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const bf = await doc.embedFont(StandardFonts.HelveticaBold);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const p = doc.addPage([PW, PH]);
  addHeader(p, bf, f, 'SECR Reporting 2026 - UK Compliance Cheat Sheet', 'Streamlined Energy and Carbon Reporting');
  addFooter(p, f, date);
  ctaBanner(p, bf, f, 'Prepare your SECR report with Greenio', 'Track UK energy use and Scope 1, 2 & 3 emissions. Export audit-ready SECR reports.');

  let y = PH - 95;

  sectionHead(p, bf, y, 'Do You Qualify for SECR?');
  y -= 22;

  txt(p, 'You must report if you are UK-registered AND meet at least ONE of the following:', ML, y, 9, bf, C.DARK);
  y -= 16;
  txt(p, 'Unquoted companies must meet 2 of the 3 size tests for 2 consecutive years to qualify.', ML, y, 7.5, f, C.MUTED);
  y -= 18;

  const criteria: [string, string, RGB][] = [
    ['Quoted company', 'Any company listed on LSE, AIM, or equivalent EU/EEA market', C.GREEN],
    ['250+ employees', 'Average headcount in the financial year exceeds 250', C.BLUE],
    ['GBP36m+ turnover', 'Annual turnover exceeds GBP36 million', C.BLUE],
    ['GBP18m+ balance sheet', 'Total balance sheet assets exceed GBP18 million', C.BLUE],
  ];

  criteria.forEach(([label, detail, c], i) => {
    fillRect(p, ML, y - 4, 4, 22, c);
    if (i % 2 === 0) fillRect(p, ML + 4, y - 4, CW - 4, 22, C.BGCARD);
    txt(p, sanitize(label), ML + 12, y + 8, 9, bf, C.DARK);
    txt(p, sanitize(detail), ML + 12, y - 2, 8, f, C.MID, CW - 20);
    y -= 28;
  });

  y -= 8;
  sectionHead(p, bf, y, 'What Must Be Reported?');
  y -= 20;

  const mustReport: [string, string, string][] = [
    ['Scope 1', 'Direct emissions: fuel combustion, company vehicles, on-site plant', 'Mandatory'],
    ['Scope 2', 'Indirect: purchased electricity (location-based or market-based)', 'Mandatory'],
    ['Scope 3', 'Business travel in employee-owned vehicles (if material)', 'Mandatory'],
    ['Energy use', 'Total energy consumption (kWh) - electricity, gas, transport fuel', 'Mandatory'],
    ['Intensity ratio', 'At least one metric (per employee, per GBP1m revenue, etc.)', 'Mandatory'],
    ['Methodology', 'Reference to GHG Protocol or equivalent standard used', 'Mandatory'],
    ['Prior year', 'Comparative figures for the previous reporting year', 'Mandatory'],
  ];

  const colW2: [number, number, number] = [70, 295, 150];
  tableRow(p, f, bf, y, ['Category', 'What to include', 'Status'], colW2, true, false);
  hline(p, ML, y - 4, MR, C.RULE, 0.5);
  y -= 16;
  mustReport.forEach(([cat, what, status], i) => {
    tableRow(p, f, bf, y, [cat, what, status], colW2, false, i % 2 === 0);
    y -= 16;
  });

  y -= 10;
  sectionHead(p, bf, y, 'Where to Report & Deadlines');
  y -= 20;

  const reportingInfo: [string, string][] = [
    ['Where?', "Directors' Report within your Companies House annual filing"],
    ['Deadline?', '9 months after FY end (private); 6 months (public/quoted)'],
    ['Assurance?', 'Not legally required - but best practice for CSRD-overlapping companies'],
    ['Small co?', 'Fewer than 250 employees AND below both size tests = exempt'],
    ['Global ops?', 'Report UK energy/emissions only, or global with a UK breakdown'],
  ];

  reportingInfo.forEach(([q, a], i) => {
    if (i % 2 === 0) fillRect(p, ML, y - 3, CW, 17, C.BGCARD);
    txt(p, sanitize(q), ML + 4, y, 8.5, bf, C.NAVY, 90);
    txt(p, sanitize(a), ML + 100, y, 8.5, f, C.DARK, CW - 104);
    y -= 18;
  });

  return doc.save();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  let pdfBytes: Uint8Array;
  let filename: string;

  try {
    if (slug === 'is-brsr-mandatory') {
      pdfBytes = await buildBrsrPdf();
      filename = 'brsr-mandatory-2026-cheatsheet.pdf';
    } else if (slug === 'csrd-timeline') {
      pdfBytes = await buildCsrdPdf();
      filename = 'csrd-timeline-2025-2026-cheatsheet.pdf';
    } else if (slug === 'what-is-secr-reporting') {
      pdfBytes = await buildSecrPdf();
      filename = 'secr-reporting-2026-cheatsheet.pdf';
    } else {
      return NextResponse.json({ error: 'No PDF for this blog post' }, { status: 404 });
    }
  } catch (err) {
    console.error('blog-pdf error', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
