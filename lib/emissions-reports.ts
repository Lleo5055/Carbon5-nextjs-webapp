// lib/emissions-report.ts

import { supabase } from '@/lib/supabaseClients';

export type ReportMonth = {
  monthLabel: string; // e.g. "November 2025"
  electricityKwh: number;
  fuelLitres: number;
  refrigerantKg: number;
  totalCo2eKg: number; // from DB directly
};

export type EmissionsReport = {
  periodLabel: string;
  months: ReportMonth[];
  breakdownBySource: {
    electricitySharePercent: number;
    fuelSharePercent: number;
    refrigerantSharePercent: number;
  };
  suggestions: string[];
};

// 🔹 Fetch real rows from Supabase
async function fetchRowsForUser(userId: string) {
  const { data, error } = await supabase
    .from('emissions')
    .select(
      `
      month,
      electricity_kw,
      fuel_liters,
      refrigerant_kg,
      total_co2e
    `
    )
    .eq('user_id', userId) // IMPORTANT: only get this user’s data
    .order('month', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return [];
  }

  return data ?? [];
}

export async function getEmissionsReportForUser(): Promise<EmissionsReport> {
  // ✔ Get logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      periodLabel: 'All data',
      months: [],
      breakdownBySource: {
        electricitySharePercent: 0,
        fuelSharePercent: 0,
        refrigerantSharePercent: 0,
      },
      suggestions: [],
    };
  }

  const rows = await fetchRowsForUser(user.id);

  if (!rows.length) {
    return {
      periodLabel: 'All data',
      months: [],
      breakdownBySource: {
        electricitySharePercent: 0,
        fuelSharePercent: 0,
        refrigerantSharePercent: 0,
      },
      suggestions: [],
    };
  }

  // 🔹 Convert rows → ReportMonth[]
  const months: ReportMonth[] = rows.map((r: any) => ({
    monthLabel: r.month,
    electricityKwh: Number(r.electricity_kw || 0),
    fuelLitres: Number(r.fuel_liters || 0),
    refrigerantKg: Number(r.refrigerant_kg || 0),
    totalCo2eKg: Number(r.total_co2e || 0),
  }));

  // 🔹 Sort newest → oldest (already text, so reorder based on row order)
  // (Already ordered in SQL, but we ensure)
  const sortedMonths = months;

  // 🔹 Breakdown by source %
  const totalAll = sortedMonths.reduce((sum, m) => sum + m.totalCo2eKg, 0);

  const totalElec = sortedMonths.reduce(
    (sum, m) => sum + m.electricityKwh * 0.42, // if needed later, but not for %
    0
  );

  const totalFuel = sortedMonths.reduce(
    (sum, m) => sum + m.fuelLitres * 2.7,
    0
  );

  const totalRef = sortedMonths.reduce(
    (sum, m) => sum + m.refrigerantKg * 1300,
    0
  );

  // Avoid divide by zero
  const denom = totalElec + totalFuel + totalRef || 1;

  const breakdownBySource = {
    electricitySharePercent: Math.round((totalElec / denom) * 1000) / 10,
    fuelSharePercent: Math.round((totalFuel / denom) * 1000) / 10,
    refrigerantSharePercent: Math.round((totalRef / denom) * 1000) / 10,
  };

  const suggestions: string[] = [];

  if (breakdownBySource.electricitySharePercent > 40) {
    suggestions.push(
      'Electricity use is a significant driver. Consider LED lighting, higher AC setpoints, and better controls.'
    );
  }
  if (breakdownBySource.fuelSharePercent > 25) {
    suggestions.push(
      'Fuel usage is high. Review vehicle routing, idling, and behaviour.'
    );
  }
  if (breakdownBySource.refrigerantSharePercent > 10) {
    suggestions.push(
      'Refrigerant leakage has major impact. Schedule AC leak checks and servicing.'
    );
  }

  return {
    periodLabel: 'All data',
    months: sortedMonths,
    breakdownBySource,
    suggestions,
  };
}
