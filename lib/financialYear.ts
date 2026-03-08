// lib/financialYear.ts
//
// Feature 1.2 — April–March financial year
//
// Returns the current financial year label, start date, and end date
// for any fy_start_month setting.
//
// India accounts: fy_start_month = 4 (April)  → FY 2025-26
// UK/EU accounts: fy_start_month = 1 (January) → 2025
//
// Spec-verified behaviour:
//   getFinancialYear(4, new Date('2026-03-08')) → { label: 'FY 2025-26', start: 2025-04-01, end: 2026-03-31 }
//   getFinancialYear(4, new Date('2026-05-01')) → { label: 'FY 2026-27', start: 2026-04-01, end: 2027-03-31 }

export type FinancialYear = {
  label: string;  // 'FY 2025-26' (India) or '2025' (UK/EU)
  start: Date;    // First day of financial year
  end: Date;      // Last day of financial year
};

/**
 * Returns the financial year containing the given reference date.
 *
 * @param fyStartMonth  1 = January (calendar year), 4 = April (India)
 * @param referenceDate Defaults to today
 */
export function getFinancialYear(
  fyStartMonth: number,
  referenceDate: Date = new Date()
): FinancialYear {
  const month = referenceDate.getMonth() + 1; // 1–12
  const year  = referenceDate.getFullYear();

  let startYear: number;

  if (fyStartMonth === 1) {
    // Calendar year — FY start is January of the current year
    startYear = year;
  } else {
    // Non-calendar FY — if today is before the start month we are still
    // in the *previous* year's FY.
    startYear = month >= fyStartMonth ? year : year - 1;
  }

  const endYear = fyStartMonth === 1 ? startYear : startYear + 1;

  // start = fyStartMonth day 1 of startYear
  const start = new Date(startYear, fyStartMonth - 1, 1);

  // end = last day of the month before fyStartMonth in endYear
  // For fy_start_month = 4 (April): end = March 31 of endYear
  // For fy_start_month = 1 (Jan):   end = December 31 of startYear
  const end =
    fyStartMonth === 1
      ? new Date(startYear, 11, 31)
      : new Date(endYear, fyStartMonth - 1, 0); // day 0 = last day of prior month

  const label =
    fyStartMonth === 1
      ? `${startYear}`
      : `FY ${startYear}-${String(endYear).slice(-2)}`;

  return { label, start, end };
}

/**
 * Returns start/end as YYYY-MM-DD strings plus the FY label.
 * Use this for dashboard filter defaults and report period selectors.
 */
export function getFYDateRange(
  fyStartMonth: number,
  referenceDate?: Date
): { start: string; end: string; label: string } {
  const fy = getFinancialYear(fyStartMonth, referenceDate);
  return {
    label: fy.label,
    start: fy.start.toISOString().slice(0, 10),
    end:   fy.end.toISOString().slice(0, 10),
  };
}

/**
 * Returns fy_start_month for a country code.
 * India = 4 (April). Everything else = 1 (January).
 */
export function fyStartMonthForCountry(countryCode: string): number {
  return countryCode === 'IN' ? 4 : 1;
}

/**
 * Returns all months (as { month: number, year: number }) in a financial year.
 * Useful for populating month dropdowns scoped to an FY.
 */
export function getMonthsInFY(
  fyStartMonth: number,
  referenceDate?: Date
): { month: number; year: number; label: string }[] {
  const fy = getFinancialYear(fyStartMonth, referenceDate);
  const months: { month: number; year: number; label: string }[] = [];
  const cursor = new Date(fy.start);

  while (cursor <= fy.end) {
    months.push({
      month: cursor.getMonth() + 1,
      year:  cursor.getFullYear(),
      label: cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
