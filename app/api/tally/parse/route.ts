import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYWORD_MAP: Record<string, string> = {
  diesel: 'diesel', hsd: 'diesel', 'high speed diesel': 'diesel',
  petrol: 'petrol', 'motor spirit': 'petrol',
  lpg: 'lpg', 'lpg cylinder': 'lpg', 'gas cylinder': 'lpg',
  'liquefied petroleum': 'lpg',
  cng: 'cng', 'compressed natural gas': 'cng',
  'natural gas': 'gas', png: 'gas', 'piped gas': 'gas',
  electricity: 'electricity', 'electric': 'electricity', power: 'electricity',
  bescom: 'electricity', msedcl: 'electricity', 'tata power': 'electricity',
  tneb: 'electricity', 'adani electricity': 'electricity', discom: 'electricity',
  'electricity charges': 'electricity', 'power charges': 'electricity',
  refrigerant: 'refrigerant', 'ac gas': 'refrigerant', r410a: 'refrigerant',
  r134a: 'refrigerant', 'refrigerant gas': 'refrigerant', 'refrigerant top': 'refrigerant',
};

function suggestSource(ledgerName: string): string | null {
  const lower = ledgerName.toLowerCase();
  for (const [keyword, source] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) return source;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const token = formData.get('token') as string | null;

    if (!userId || !token || !file) {
      return NextResponse.json({ status: 'error', error_message: 'Missing required fields' });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) {
      return NextResponse.json({ status: 'error', error_message: 'Unauthorized' }, { status: 401 });
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

    // Find header row
    const headerRowIndex = rows.findIndex((row: any[]) =>
      row.some((cell: any) => String(cell).toLowerCase().includes('date')) &&
      row.some((cell: any) =>
        String(cell).toLowerCase().includes('particular') ||
        String(cell).toLowerCase().includes('narration')
      )
    );

    if (headerRowIndex === -1) {
      return NextResponse.json({
        status: 'wrong_report',
        error_message: 'This does not look like a Day Book export. Please export the Day Book report from Tally.',
        guide_link: '/help/tally-import#step-1',
        ledgers: [],
        month_detected: null,
      });
    }

    const headers = rows[headerRowIndex] as string[];
    const particularCol = headers.findIndex((h: string) =>
      String(h).toLowerCase().includes('particular') ||
      String(h).toLowerCase().includes('narration')
    );
    const debitCol = headers.findIndex((h: string) =>
      String(h).toLowerCase() === 'debit' ||
      String(h).toLowerCase().includes('debit')
    );
    const vchTypeCol = headers.findIndex((h: string) =>
      String(h).toLowerCase().includes('vch type') ||
      String(h).toLowerCase().includes('voucher type')
    );
    const dateCol = headers.findIndex((h: string) =>
      String(h).toLowerCase() === 'date'
    );

    if (particularCol === -1 || debitCol === -1) {
      return NextResponse.json({
        status: 'wrong_report',
        error_message: 'Could not find required columns. Please export the Day Book report from Tally.',
        guide_link: '/help/tally-import#step-1',
        ledgers: [],
        month_detected: null,
      });
    }

    // Detect month from dates in file
    let month_detected: string | null = null;
    const MONTH_NAMES = ['January','February','March','April','May','June',
      'July','August','September','October','November','December'];
    const dataRows = rows.slice(headerRowIndex + 1);
    for (const row of dataRows) {
      if (dateCol !== -1 && row[dateCol]) {
        try {
          const d = new Date(row[dateCol]);
          if (!isNaN(d.getTime())) {
            month_detected = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
            break;
          }
        } catch {}
      }
    }

    // Build ledger map
    const ledgerMap = new Map<string, { total: number; count: number }>();
    const PURCHASE_TYPES = ['purchase', 'payment', 'journal', 'contra', 'debit note'];

    for (const row of dataRows) {
      const particular = String(row[particularCol] ?? '').trim();
      const debit = Number(row[debitCol]) || 0;
      const vchType = String(row[vchTypeCol] ?? '').toLowerCase();

      if (!particular || debit <= 0) continue;

      // Skip if not a purchase/payment type
      if (vchTypeCol !== -1 && !PURCHASE_TYPES.some(t => vchType.includes(t))) continue;

      // Skip totals/header rows
      const lowerParticular = particular.toLowerCase();
      if (
        lowerParticular.includes('total') ||
        lowerParticular.includes('opening balance') ||
        lowerParticular.includes('closing balance') ||
        lowerParticular === 'particulars' ||
        lowerParticular === 'narration'
      ) continue;

      const existing = ledgerMap.get(particular) ?? { total: 0, count: 0 };
      existing.total += debit;
      existing.count += 1;
      ledgerMap.set(particular, existing);
    }

    if (ledgerMap.size === 0) {
      return NextResponse.json({
        status: 'empty',
        error_message: 'No purchase or payment entries found for this period.',
        ledgers: [],
        month_detected,
        guide_link: null,
      });
    }

    // Load existing user mappings
    const { data: existingMappings } = await supabase
      .from('tally_ledger_mappings')
      .select('tally_ledger_name, emission_source, skip')
      .eq('user_id', userId);

    const mappingLookup = new Map<string, { emission_source: string | null; skip: boolean }>();
    for (const m of existingMappings ?? []) {
      mappingLookup.set(m.tally_ledger_name, {
        emission_source: m.emission_source,
        skip: m.skip,
      });
    }

    // Build response ledgers
    const ledgers = Array.from(ledgerMap.entries()).map(([name, { total, count }]) => {
      const savedMapping = mappingLookup.get(name);
      const suggestedSource = savedMapping
        ? (savedMapping.skip ? null : savedMapping.emission_source)
        : suggestSource(name);

      let match_status: 'auto_matched' | 'suggested' | 'needs_mapping' | 'skipped';
      if (savedMapping?.skip) {
        match_status = 'skipped';
      } else if (savedMapping?.emission_source) {
        match_status = 'auto_matched';
      } else if (suggestedSource) {
        match_status = 'suggested';
      } else {
        match_status = 'needs_mapping';
      }

      const flag = match_status === 'needs_mapping' ? 'new_ledger'
        : count > 1 ? 'combined_entries'
        : match_status !== 'skipped' ? 'quantity_needed'
        : null;

      return {
        tally_name: name,
        total_debit: Math.round(total),
        entry_count: count,
        match_status,
        suggested_source: suggestedSource,
        confirmed_source: savedMapping?.emission_source ?? null,
        quantity: null,
        quantity_unit: null,
        flag,
        flag_message: flag === 'new_ledger'
          ? 'New ledger — tell us what this is'
          : flag === 'combined_entries'
          ? `${count} entries combined this month`
          : flag === 'quantity_needed'
          ? 'Enter the quantity from your bill or invoice'
          : null,
      };
    });

    return NextResponse.json({
      status: 'ok',
      month_detected,
      ledgers,
      error_message: null,
      guide_link: null,
    });

  } catch (err: any) {
    console.error('Tally parse error:', err);
    return NextResponse.json({
      status: 'error',
      error_message: 'Failed to parse file. Please check the file and try again.',
      ledgers: [],
      month_detected: null,
      guide_link: '/help/tally-import',
    });
  }
}
