// lib/factors.ts
//
// Builds a FactorSet for any supported country directly from the
// in-memory COUNTRY_EMISSION_FACTORS table in emissionFactors.ts.
//
// This replaces the old loadUKFactors() which hit the emission_factors
// Supabase table. That table is no longer needed for factor lookups.

import {
  getCountryFactors,
  type SupportedCountryCode,
} from './emissionFactors';

// ─── Type ─────────────────────────────────────────────────────────────────────

export type FactorSet = {
  version: string;
  electricity: number;
  diesel: number;
  petrol: number;
  gas: number;
  lpg: number;
  refrigerants: Record<string, number>;
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns a FactorSet for the given ISO country code.
 *
 * Synchronous — no DB call needed. Falls back to GB if the country
 * code is unrecognised (getCountryFactors handles the warning).
 *
 * @example
 *   const factors = getFactorsForCountry('DE');
 *   const result  = calculateCo2e(input, factors);
 */
export function getFactorsForCountry(countryCode: string): FactorSet {
  const ef = getCountryFactors(countryCode);

  return {
    version:      ef.factorVersion,
    electricity:  ef.electricityKgPerKwh,
    diesel:       ef.dieselKgPerLitre,
    petrol:       ef.petrolKgPerLitre,
    // gas is stored as kgCO2e/m³ in emissionFactors.ts.
    // calculateCo2e() receives gasKwh, so we convert here:
    // 1 kWh of natural gas ≈ 0.0344 m³ → factor per kWh = factor per m³ × 0.0344
    gas:          ef.naturalGasKgPerM3 * 0.0344,
    lpg:          ef.lpgKgPerLitre,
    refrigerants: { ...ef.refrigerants },
  };
}

// ─── Backwards compatibility ──────────────────────────────────────────────────

/**
 * @deprecated Use getFactorsForCountry('GB') instead.
 * Kept so any existing call-sites don't break immediately.
 * Returns a resolved Promise to match the old async signature.
 */
export async function loadUKFactors(): Promise<FactorSet> {
  console.warn(
    '[factors] loadUKFactors() is deprecated. Use getFactorsForCountry(countryCode) instead.'
  );
  return getFactorsForCountry('GB');
}