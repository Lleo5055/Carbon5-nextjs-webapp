// lib/prepareAiData.ts

export function prepareAiData(months: any[]) {
  if (!Array.isArray(months)) return [];

  // Sort by month label (YYYY-MM or similar)
  const sorted = [...months].sort((a, b) =>
    String(a.monthLabel).localeCompare(String(b.monthLabel))
  );

  // Normalised structure sent to AI
  return sorted.map((m) => ({
    month: m.monthLabel,
    totalCo2e: m.totalCo2eKg ?? 0,
    electricity: m.electricityKwh ?? 0,
    fuel: m.fuelLitres ?? 0,
    refrigerants: m.refrigerantKg ?? 0,

    // UK extended fields
    diesel: m.dieselLitres ?? 0,
    petrol: m.petrolLitres ?? 0,
    gas: m.gasKwh ?? 0,
  }));
}
