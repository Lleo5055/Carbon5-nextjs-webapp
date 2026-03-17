import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Template file location: public/templates/Greenio_Bulk_Upload_Template.xlsx
// This file must be placed there manually by the developer.

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
};

type ParsedRow = {
  row_number: number;
  month: string;
  month_key: string;
  year: number;
  diesel: number;
  petrol: number;
  lpg: number;
  cng: number;
  gas: number;
  other_fuel: number;
  refrigerant: number;
  refrigerant_code: string;
  electricity: number;
  production_output: number | null;
  production_unit: string | null;
  existing_electricity: number;
  existing_diesel: number;
  existing_petrol: number;
  existing_lpg: number;
  existing_cng: number;
  existing_gas: number;
  existing_refrigerant: number;
  final_electricity: number;
  final_diesel: number;
  final_petrol: number;
  final_lpg: number;
  final_cng: number;
  final_gas: number;
  final_refrigerant: number;
  status: 'valid' | 'skipped';
  skip_reason: string | null;
};

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
      return NextResponse.json({ status: 'error', error: 'Missing required fields' });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) {
      return NextResponse.json({ status: 'error', error: 'Unauthorized' }, { status: 401 });
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Find the Emissions Upload sheet — try by name first, fall back to first sheet
    const sheetName = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('emission') || n.toLowerCase().includes('upload')
    ) ?? workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    // Force sheet range to include all 13 columns minimum
    const sheetRange = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:M50');
    sheetRange.e.c = Math.max(sheetRange.e.c, 12);
    // Read cells directly to avoid merged cell truncation issues
    const totalCols = 13; // A through M

    const allRows: any[][] = [];
    for (let r = 0; r <= sheetRange.e.r; r++) {
      const row: any[] = [];
      for (let c = 0; c < totalCols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        row.push(cell ? (cell.v ?? '') : '');
      }
      allRows.push(row);
    }

    // Find header row — look for row containing 'Month' and 'Year' and 'Diesel' or 'Electricity'
    const headerRowIndex = allRows.findIndex((row: any[]) => {
      const lower = row.map((c: any) => String(c).toLowerCase().trim().replace(/\n/g, ' ').replace(/\s+/g, ' '));
      const hasMonth = lower.some(c => c === 'month' || c === 'month *');
      const hasYear = lower.some(c => c === 'year' || c === 'year *');
      const hasFuel = lower.some(c => c.includes('diesel') || c.includes('electricity'));
      return hasMonth && hasYear && hasFuel;
    });

    if (headerRowIndex === -1) {
      return NextResponse.json({
        status: 'wrong_template',
        error: 'This does not look like a Greenio bulk upload template. Please download the official template and try again.',
        rows: [],
      });
    }

    const headers = (allRows[headerRowIndex] as any[]).map((h: any) =>
      String(h).toLowerCase().trim().replace(/\n/g, ' ').replace(/\s+/g, ' ')
    );

    // Validate required headers present
    const missingHeaders = ['month', 'year', 'electricity'].filter(h =>
      !headers.some(header => header.includes(h))
    );
    if (missingHeaders.length > 0) {
      return NextResponse.json({
        status: 'wrong_template',
        error: `Missing required columns: ${missingHeaders.join(', ')}. Please use the official Greenio template.`,
        rows: [],
      });
    }

    // Normalize headers — strip line breaks, units in brackets, asterisks
    const normalizedHeaders = headers.map(h =>
      h.toLowerCase()
        .replace(/\n/g, ' ')
        .replace(/\(.*?\)/g, '')  // remove anything in brackets e.g. (Litres), (kWh), (kg)
        .replace(/\*/g, '')        // remove asterisks
        .replace(/\s+/g, ' ')
        .trim()
    );

    const col = (keyword: string) =>
      normalizedHeaders.findIndex(h => h.includes(keyword));

    const monthCol = col('month');
    const yearCol = col('year');
    const dieselCol = col('diesel');
    const petrolCol = col('petrol');
    const lpgCol = col('lpg');
    const cngCol = col('cng');
    const gasCol = normalizedHeaders.findIndex(h => h.includes('natural gas') || h.includes('png'));
    const otherFuelCol = col('other fuel');
    const refrigCol = normalizedHeaders.findIndex(h => h.includes('refrigerant') && !h.includes('type'));
    const refrigTypeCol = normalizedHeaders.findIndex(h => h.includes('refrigerant') && h.includes('type'));
    const elecCol = col('electricity');
    const prodOutputCol = col('production output');
    const prodUnitCol = col('production unit');

    // Check existing months for this user (to detect updates and consolidate)
    const { data: existingEmissions } = await supabase
      .from('emissions')
      .select('month, month_key, electricity_kw, diesel_litres, petrol_litres, lpg_kg, cng_kg, gas_kwh, refrigerant_kg, refrigerant_code, total_co2e')
      .eq('user_id', userId);

    const existingMonthKeys = new Set((existingEmissions ?? []).map(e => e.month_key?.slice(0, 7) ?? ''));

    // Build lookup of existing values by month_key for consolidation
    const existingByMonthKey = new Map<string, any>();
    for (const e of existingEmissions ?? []) {
      const mk = e.month_key?.slice(0, 7) ?? '';
      if (mk) existingByMonthKey.set(mk, e);
    }

    // Process data rows
    const dataRows = allRows.slice(headerRowIndex + 1);
    const parsedRows: ParsedRow[] = [];
    const seenMonthKeys = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const rowNum = headerRowIndex + 2 + i; // 1-indexed for user display

      // Skip empty rows
      const hasData = row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined);
      if (!hasData) continue;

      // Skip footer / branding rows
      const firstCell = String(row[0] ?? '').toLowerCase();
      if (firstCell.includes('prepared by') || firstCell.includes('greenio') ||
          firstCell.includes('note') || firstCell.includes('emission factor')) continue;

      const monthRaw = String(row[monthCol] ?? '').trim();
      const yearRaw = Number(row[yearCol]);

      // Validate month
      const monthNum = MONTHS[monthRaw.toLowerCase()];
      if (!monthNum) {
        parsedRows.push({
          row_number: rowNum,
          month: monthRaw || '(blank)',
          month_key: '',
          year: yearRaw,
          diesel: 0, petrol: 0, lpg: 0, cng: 0, gas: 0,
          other_fuel: 0, refrigerant: 0, refrigerant_code: 'GENERIC_HFC',
          electricity: 0, production_output: null, production_unit: null,
          existing_electricity: 0, existing_diesel: 0, existing_petrol: 0,
          existing_lpg: 0, existing_cng: 0, existing_gas: 0, existing_refrigerant: 0,
          final_electricity: 0, final_diesel: 0, final_petrol: 0,
          final_lpg: 0, final_cng: 0, final_gas: 0, final_refrigerant: 0,
          status: 'skipped',
          skip_reason: `Invalid month "${monthRaw}" — use full month name (e.g. January)`,
        });
        continue;
      }

      // Validate year
      if (!yearRaw || yearRaw < 2018 || yearRaw > 2035) {
        parsedRows.push({
          row_number: rowNum,
          month: monthRaw,
          month_key: '',
          year: yearRaw,
          diesel: 0, petrol: 0, lpg: 0, cng: 0, gas: 0,
          other_fuel: 0, refrigerant: 0, refrigerant_code: 'GENERIC_HFC',
          electricity: 0, production_output: null, production_unit: null,
          existing_electricity: 0, existing_diesel: 0, existing_petrol: 0,
          existing_lpg: 0, existing_cng: 0, existing_gas: 0, existing_refrigerant: 0,
          final_electricity: 0, final_diesel: 0, final_petrol: 0,
          final_lpg: 0, final_cng: 0, final_gas: 0, final_refrigerant: 0,
          status: 'skipped',
          skip_reason: `Invalid year "${yearRaw}" — must be between 2018 and 2035`,
        });
        continue;
      }

      const monthKey = `${yearRaw}-${monthNum}`;
      const monthLabel = `${MONTH_NAMES[monthNum]} ${yearRaw}`;

      // Skip duplicate months within same upload
      if (seenMonthKeys.has(monthKey)) {
        parsedRows.push({
          row_number: rowNum,
          month: monthLabel,
          month_key: monthKey,
          year: yearRaw,
          diesel: 0, petrol: 0, lpg: 0, cng: 0, gas: 0,
          other_fuel: 0, refrigerant: 0, refrigerant_code: 'GENERIC_HFC',
          electricity: 0, production_output: null, production_unit: null,
          existing_electricity: 0, existing_diesel: 0, existing_petrol: 0,
          existing_lpg: 0, existing_cng: 0, existing_gas: 0, existing_refrigerant: 0,
          final_electricity: 0, final_diesel: 0, final_petrol: 0,
          final_lpg: 0, final_cng: 0, final_gas: 0, final_refrigerant: 0,
          status: 'skipped',
          skip_reason: `Duplicate month — ${monthLabel} appears more than once in this file`,
        });
        continue;
      }
      seenMonthKeys.add(monthKey);

      const n = (colIdx: number) => colIdx !== -1 ? Math.max(0, Number(row[colIdx]) || 0) : 0;
      const s = (colIdx: number) => colIdx !== -1 ? String(row[colIdx] ?? '').trim() : '';

      const refrigCode = s(refrigTypeCol) || 'GENERIC_HFC';
      const prodOutput = prodOutputCol !== -1 && row[prodOutputCol] !== '' && row[prodOutputCol] !== null
        ? Number(row[prodOutputCol]) || null
        : null;
      const prodUnit = s(prodUnitCol) || null;

      const existing = existingByMonthKey.get(monthKey);
      const uploadDiesel = n(dieselCol);
      const uploadPetrol = n(petrolCol);
      const uploadLpg = n(lpgCol);
      const uploadCng = n(cngCol);
      const uploadGas = n(gasCol);
      const uploadRefrig = n(refrigCol);
      const uploadElec = n(elecCol);

      parsedRows.push({
        row_number: rowNum,
        month: monthLabel,
        month_key: monthKey,
        year: yearRaw,
        diesel: uploadDiesel,
        petrol: uploadPetrol,
        lpg: uploadLpg,
        cng: uploadCng,
        gas: uploadGas,
        other_fuel: n(otherFuelCol),
        refrigerant: uploadRefrig,
        refrigerant_code: refrigCode,
        electricity: uploadElec,
        production_output: prodOutput,
        production_unit: prodUnit,
        existing_electricity: Number(existing?.electricity_kw) || 0,
        existing_diesel: Number(existing?.diesel_litres) || 0,
        existing_petrol: Number(existing?.petrol_litres) || 0,
        existing_lpg: Number(existing?.lpg_kg) || 0,
        existing_cng: Number(existing?.cng_kg) || 0,
        existing_gas: Number(existing?.gas_kwh) || 0,
        existing_refrigerant: Number(existing?.refrigerant_kg) || 0,
        final_electricity: (Number(existing?.electricity_kw) || 0) + uploadElec,
        final_diesel: (Number(existing?.diesel_litres) || 0) + uploadDiesel,
        final_petrol: (Number(existing?.petrol_litres) || 0) + uploadPetrol,
        final_lpg: (Number(existing?.lpg_kg) || 0) + uploadLpg,
        final_cng: (Number(existing?.cng_kg) || 0) + uploadCng,
        final_gas: (Number(existing?.gas_kwh) || 0) + uploadGas,
        final_refrigerant: (Number(existing?.refrigerant_kg) || 0) + uploadRefrig,
        status: 'valid',
        skip_reason: null,
      });
    }

    const validRows = parsedRows.filter(r => r.status === 'valid');
    const skippedRows = parsedRows.filter(r => r.status === 'skipped');

    if (validRows.length === 0) {
      return NextResponse.json({
        status: 'empty',
        error: 'No valid rows found. Check that your Month and Year columns are filled correctly.',
        rows: parsedRows,
      });
    }

    // Mark each valid row as new or update
    const rowsWithStatus = validRows.map(r => ({
      ...r,
      is_update: existingMonthKeys.has(r.month_key),
    }));

    return NextResponse.json({
      status: 'ok',
      total_rows: parsedRows.length,
      valid_count: validRows.length,
      skipped_count: skippedRows.length,
      rows: rowsWithStatus,
      skipped_rows: skippedRows,
    });

  } catch (err: any) {
    console.error('Bulk upload parse error:', err);
    return NextResponse.json({
      status: 'error',
      error: 'Failed to parse file. Make sure you are uploading the Greenio bulk upload template.',
      rows: [],
    });
  }
}
