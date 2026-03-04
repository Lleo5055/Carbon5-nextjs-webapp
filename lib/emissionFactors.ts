// lib/emissionFactors.ts
//
// ─────────────────────────────────────────────────────────────────────────────
//  MULTI-COUNTRY EMISSION FACTORS
//  Supports: DE, FR, IT, ES, NL, PL, SE, BE, AT, IE, DK, PT, GB, IN
//
//  Factor sources (per country record):
//    Electricity : 2026 Eurostat / Grid Operator (GB: National Grid / BEIS;
//                  IN: CEA / IEA)
//    Natural gas : IPCC 2019 / National Calorific Value (GB: BEIS/DEFRA 2025;
//                  IN: IPCC 2019 / BEE India)
//    Fuels       : DEFRA 2025 (same for all countries)
//    Refrigerants: IPCC AR6 (global – same for all countries)
//
//  Units
//    electricity  → kg CO₂e / kWh
//    naturalGas   → kg CO₂e / m³
//    diesel       → kg CO₂e / litre
//    petrol       → kg CO₂e / litre
//    lpg          → kg CO₂e / kg
//    refrigerants → kg CO₂e / kg (= GWP, AR6)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedCountryCode =
  | 'DE' | 'FR' | 'IT' | 'ES' | 'NL' | 'PL' | 'SE'
  | 'BE' | 'AT' | 'IE' | 'DK' | 'PT' | 'GB' | 'IN';

export interface CountryEmissionFactors {
  /** kg CO₂e per kWh of grid electricity consumed */
  electricityKgPerKwh: number;
  /** kg CO₂e per m³ of natural gas */
  naturalGasKgPerM3: number;
  /** kg CO₂e per litre of diesel (avg bio-blend) */
  dieselKgPerLitre: number;
  /** kg CO₂e per litre of petrol (avg bio-blend) */
  petrolKgPerLitre: number;
  /** kg CO₂e per kg of LPG */
  lpgKgPerKg: number;
  /** Refrigerant GWPs (kg CO₂e / kg leaked) – IPCC AR6, global */
  refrigerants: {
    R410A: number;
    R134A: number;
    R407C: number;
    R404A: number;
    R32:   number;
    GENERIC_HFC: number;
  };
  /** Human-readable source note */
  factorVersion: string;
}

// ─── Country factor table ─────────────────────────────────────────────────────

// Refrigerant GWPs are identical for every country (IPCC AR6, global values).
const SHARED_REFRIGERANTS: CountryEmissionFactors['refrigerants'] = {
  R410A:       2088,
  R134A:       1430,
  R407C:       1774,
  R404A:       3922,
  R32:          675,
  GENERIC_HFC: 1650,
};

// Fuel factors are identical for every country (DEFRA 2025).
const SHARED_FUELS = {
  dieselKgPerLitre: 2.68,
  petrolKgPerLitre: 2.31,
  lpgKgPerKg:       1.50,
};

const EU_FACTOR_VERSION =
  'Electricity: 2026 Eurostat / Grid Operator | Gas: IPCC 2019 / National Calorific Value | Fuels: DEFRA 2025 | Refrigerants: IPCC AR6';

export const COUNTRY_EMISSION_FACTORS: Record<SupportedCountryCode, CountryEmissionFactors> = {

  DE: {
    electricityKgPerKwh: 0.366,
    naturalGasKgPerM3:   2.00,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  FR: {
    electricityKgPerKwh: 0.056,
    naturalGasKgPerM3:   2.03,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  IT: {
    electricityKgPerKwh: 0.239,
    naturalGasKgPerM3:   2.05,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  ES: {
    electricityKgPerKwh: 0.231,
    naturalGasKgPerM3:   1.98,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  NL: {
    electricityKgPerKwh: 0.338,
    naturalGasKgPerM3:   1.95,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  PL: {
    electricityKgPerKwh: 0.746,
    naturalGasKgPerM3:   2.02,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  SE: {
    electricityKgPerKwh: 0.012,
    naturalGasKgPerM3:   1.99,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  BE: {
    electricityKgPerKwh: 0.180,
    naturalGasKgPerM3:   2.01,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  AT: {
    electricityKgPerKwh: 0.188,
    naturalGasKgPerM3:   2.00,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  IE: {
    electricityKgPerKwh: 0.301,
    naturalGasKgPerM3:   1.97,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  DK: {
    electricityKgPerKwh: 0.207,
    naturalGasKgPerM3:   2.01,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  PT: {
    electricityKgPerKwh: 0.235,
    naturalGasKgPerM3:   1.96,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion: EU_FACTOR_VERSION,
  },

  GB: {
    electricityKgPerKwh: 0.213,
    naturalGasKgPerM3:   2.00,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion:
      'Electricity: 2026 National Grid / BEIS | Gas: BEIS/DEFRA 2025 | Fuels: DEFRA 2025 | Refrigerants: IPCC AR6',
  },

  IN: {
    electricityKgPerKwh: 0.820,
    naturalGasKgPerM3:   2.03,
    ...SHARED_FUELS,
    refrigerants: SHARED_REFRIGERANTS,
    factorVersion:
      'Electricity: 2026 CEA / IEA | Gas: IPCC 2019 / BEE India | Fuels: DEFRA 2025 | Refrigerants: IPCC AR6',
  },
};

// ─── Country lookup helper ────────────────────────────────────────────────────

/**
 * Returns the emission factors for a given country code.
 * Falls back to GB if the code is unrecognised, and logs a warning.
 *
 * @example
 *   const ef = getCountryFactors('DE');
 *   const co2e = kwh * ef.electricityKgPerKwh;
 */
export function getCountryFactors(countryCode: string): CountryEmissionFactors {
  const code = countryCode.toUpperCase() as SupportedCountryCode;

  if (code in COUNTRY_EMISSION_FACTORS) {
    return COUNTRY_EMISSION_FACTORS[code];
  }

  console.warn(
    `[emissionFactors] Unknown country code "${countryCode}". Falling back to GB factors.`
  );
  return COUNTRY_EMISSION_FACTORS['GB'];
}

// ─── Calculation helpers (country-aware) ─────────────────────────────────────

/**
 * Calculate electricity CO₂e (kg) using the country's grid factor.
 */
export function calcElectricityCo2eKg(kwh: number, countryCode: string): number {
  return kwh * getCountryFactors(countryCode).electricityKgPerKwh;
}

/**
 * Calculate natural gas CO₂e (kg) from cubic metres consumed.
 */
export function calcNaturalGasCo2eKg(m3: number, countryCode: string): number {
  return m3 * getCountryFactors(countryCode).naturalGasKgPerM3;
}

/**
 * Calculate CO₂e (kg) from separate diesel, petrol and gas values.
 * Gas can be supplied as kWh (legacy) or m³ (preferred).
 *
 * All params optional; missing values are treated as zero.
 */
export function calcFuelCo2eKg(
  params: {
    dieselLitres?: number;
    petrolLitres?: number;
    /** Natural gas in kWh – legacy path, converted internally at 0.0344 m³/kWh */
    gasKwh?: number;
    /** Natural gas in m³ – preferred */
    gasM3?: number;
  },
  countryCode = 'GB'
): number {
  const ef      = getCountryFactors(countryCode);
  const diesel  = params.dieselLitres ?? 0;
  const petrol  = params.petrolLitres ?? 0;

  // Support both gas units: m³ is preferred; kWh is kept for backwards compat.
  // Conversion: 1 kWh ≈ 0.0924 m³ (natural gas gross CV ≈ 10.83 kWh/m³, UK/EU average).
  const gasM3   = params.gasM3 ?? (params.gasKwh ?? 0) * 0.0924;

  return (
    diesel * ef.dieselKgPerLitre +
    petrol * ef.petrolKgPerLitre +
    gasM3  * ef.naturalGasKgPerM3
  );
}

/**
 * Calculate CO₂e from kg of leaked refrigerant.
 * Refrigerant GWPs are global (IPCC AR6) so no country code needed.
 */
export function calcRefrigerantCo2e(kgLeak: number, refCodeRaw: string): number {
  const code = normaliseRefrigerantCode(refCodeRaw);
  // Use GB factors arbitrarily – refrigerants are country-independent
  const gwp = COUNTRY_EMISSION_FACTORS['GB'].refrigerants[
    code as keyof CountryEmissionFactors['refrigerants']
  ] ?? SHARED_REFRIGERANTS.GENERIC_HFC;
  return kgLeak * gwp;
}

// ─── Refrigerant helpers ──────────────────────────────────────────────────────

export function normaliseRefrigerantCode(value: string): string {
  if (!value) return 'GENERIC_HFC';
  const v = value.toUpperCase();
  if (v.startsWith('R410')) return 'R410A';
  if (v.startsWith('R134')) return 'R134A';
  if (v.startsWith('R407')) return 'R407C';
  if (v.startsWith('R404')) return 'R404A';
  if (v.startsWith('R32'))  return 'R32';
  return 'GENERIC_HFC';
}

export function getRefrigerantLabel(code: string | null): string {
  if (!code) return 'Not specified';
  switch (code.toUpperCase()) {
    case 'R410A':       return 'R410A (split AC – common)';
    case 'R134A':       return 'R134a (chillers / older systems)';
    case 'R407C':       return 'R407C (comfort cooling)';
    case 'R404A':       return 'R404A (cold rooms / refrigeration)';
    case 'R32':         return 'R32 (air-conditioning & heat pumps)';
    case 'GENERIC_HFC': return 'Generic HFC (not specified)';
    default:            return code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  BACKWARDS COMPATIBILITY SHIM
//
//  All constants and function signatures that existed before the multi-country
//  refactor continue to work unchanged. No call-sites need to be updated
//  unless you want to pass a country code.
// ─────────────────────────────────────────────────────────────────────────────

const _GB = COUNTRY_EMISSION_FACTORS['GB'];

/** @deprecated Use getCountryFactors('GB').electricityKgPerKwh */
export const EF_GRID_ELECTRICITY_KG_PER_KWH        = _GB.electricityKgPerKwh;

/** @deprecated Use getCountryFactors(country).dieselKgPerLitre */
export const EF_DIESEL_AVG_BIO_BLEND_KG_PER_LITRE  = _GB.dieselKgPerLitre;
export const EF_DIESEL_KG_PER_LITRE                = _GB.dieselKgPerLitre;

/** @deprecated Use getCountryFactors(country).petrolKgPerLitre */
export const EF_PETROL_AVG_BIO_BLEND_KG_PER_LITRE  = _GB.petrolKgPerLitre;
export const EF_PETROL_KG_PER_LITRE                = _GB.petrolKgPerLitre;

/** @deprecated Use calcNaturalGasCo2eKg(m3, country) */
export const EF_NATURAL_GAS_KG_PER_KWH             = 0.184; // kept at original kWh-based value

/** @deprecated Use getCountryFactors(country).dieselKgPerLitre */
export const EF_GENERIC_ROAD_FUEL_KG_PER_LITRE     = 2.5;

/** @deprecated Use COUNTRY_EMISSION_FACTORS[country].refrigerants */
export const REFRIGERANT_GWP: Record<string, number> = { ...SHARED_REFRIGERANTS };

/** @deprecated Use COUNTRY_EMISSION_FACTORS[country].refrigerants.GENERIC_HFC */
export const EF_GENERIC_HFC_REFRIGERANT_KG_PER_KG  = SHARED_REFRIGERANTS.GENERIC_HFC;