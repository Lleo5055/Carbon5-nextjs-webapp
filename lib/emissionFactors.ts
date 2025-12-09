// lib/emissionFactors.ts

// -----------------------------
// Core emission factors (UK-aligned)
// -----------------------------
//
// These factors are set up for UK SMEs using reasonable
// UK-style values, rather than the earlier UAE placeholders.

// UK grid electricity – typical current reporting value
// is around 0.18–0.21 kgCO2e per kWh consumed.
// We use 0.20705 kg CO2e/kWh as a simple, defensible default.
export const EF_GRID_ELECTRICITY_KG_PER_KWH = 0.20705;

// More explicit fuel factors for UK use.
// These let you treat diesel, petrol and natural gas separately.

/// Diesel (average blend) – kgCO2e per litre
export const EF_DIESEL_AVG_BIO_BLEND_KG_PER_LITRE = 2.6;

/// Petrol (average blend) – kgCO2e per litre
export const EF_PETROL_AVG_BIO_BLEND_KG_PER_LITRE = 2.3;

/// Natural gas – kgCO2e per kWh (space heating, boilers, etc.)
export const EF_NATURAL_GAS_KG_PER_KWH = 0.184;

// Backwards-compatible generic road fuel factor.
// Anywhere old code still imports EF_GENERIC_ROAD_FUEL_KG_PER_LITRE
// will now be using a UK-reasonable average instead of UAE values.
export const EF_GENERIC_ROAD_FUEL_KG_PER_LITRE = 2.5;

// -----------------------------------------------------------------
// NEW: alias constants so older code imports keep working
// -----------------------------------------------------------------
export const EF_DIESEL_KG_PER_LITRE = EF_DIESEL_AVG_BIO_BLEND_KG_PER_LITRE;
export const EF_PETROL_KG_PER_LITRE = EF_PETROL_AVG_BIO_BLEND_KG_PER_LITRE;
// EF_NATURAL_GAS_KG_PER_KWH already matches the old name, so no alias needed
// -----------------------------------------------------------------

// -----------------------------
// Refrigerants – IPCC AR4 100-year GWPs
// (global, not country-specific)
// -----------------------------

export const REFRIGERANT_GWP: Record<string, number> = {
  R410A: 2088,
  R134A: 1430,
  R407C: 1774,
  R404A: 3922,
  GENERIC_HFC: 1300, // fallback for “unknown HFC”
};

// --------------------------------------------
// Backwards compatibility for HFC constant
// --------------------------------------------
//
// Older dashboard code expected this name, so we keep it wired into
// the GENERIC_HFC value to avoid breaking imports.
export const EF_GENERIC_HFC_REFRIGERANT_KG_PER_KG = REFRIGERANT_GWP.GENERIC_HFC;

// --------------------------------------------
// Utilities – Refrigerants
// --------------------------------------------

// Normalise dropdown value to a safe code for GWP lookup.
export function normaliseRefrigerantCode(value: string): string {
  if (!value) return 'GENERIC_HFC';

  const v = value.toUpperCase();
  if (v.startsWith('R410')) return 'R410A';
  if (v.startsWith('R134')) return 'R134A';
  if (v.startsWith('R407')) return 'R407C';
  if (v.startsWith('R404')) return 'R404A';

  return 'GENERIC_HFC';
}

// Calculate CO2e from kg of leaked refrigerant + gas code.
export function calcRefrigerantCo2e(
  kgLeak: number,
  refCodeRaw: string
): number {
  const code = normaliseRefrigerantCode(refCodeRaw);
  const gwp = REFRIGERANT_GWP[code] ?? REFRIGERANT_GWP.GENERIC_HFC;
  return kgLeak * gwp;
}

// Human-readable label for cards / PDFs.
export function getRefrigerantLabel(code: string | null): string {
  if (!code) return 'Not specified';

  const c = code.toUpperCase();
  switch (c) {
    case 'R410A':
      return 'R410A (split AC – common)';
    case 'R134A':
      return 'R134a (chillers / older systems)';
    case 'R407C':
      return 'R407C (comfort cooling)';
    case 'R404A':
      return 'R404A (cold rooms / refrigeration)';
    case 'GENERIC_HFC':
      return 'Generic HFC (not specified)';
    default:
      return code;
  }
}

// --------------------------------------------
// Utilities – Fuel (diesel / petrol / gas)
// --------------------------------------------

/**
 * Calculate CO2e (kg) from separate diesel, petrol and gas values.
 *
 * All params are optional; missing ones are treated as zero.
 * This is the helper you should use in the dashboard/emissions
 * code once your Supabase table has diesel_litres, petrol_litres
 * and gas_kwh columns.
 */
export function calcFuelCo2eKg(params: {
  dieselLitres?: number;
  petrolLitres?: number;
  gasKwh?: number;
}): number {
  const diesel = params.dieselLitres ?? 0;
  const petrol = params.petrolLitres ?? 0;
  const gas = params.gasKwh ?? 0;

  return (
    diesel * EF_DIESEL_AVG_BIO_BLEND_KG_PER_LITRE +
    petrol * EF_PETROL_AVG_BIO_BLEND_KG_PER_LITRE +
    gas * EF_NATURAL_GAS_KG_PER_KWH
  );
}
