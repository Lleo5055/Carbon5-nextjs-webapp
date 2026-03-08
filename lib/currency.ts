// lib/currency.ts
//
// Feature 1.1 — INR currency end-to-end
//
// Returns the correct currency symbol, locale, and formatter for any
// supported country. India accounts use INR with Indian lakh/crore
// grouping (en-IN). UK/EU accounts are unchanged.
//
// Uses Intl.NumberFormat — no custom formatting logic.

export type CurrencyConfig = {
  code: string;    // ISO 4217 — 'GBP', 'INR', 'EUR', etc.
  locale: string;  // BCP 47 — 'en-GB', 'en-IN', 'de-DE', etc.
  symbol: string;  // Display symbol — '£', '₹', '€'
};

const CURRENCY_MAP: Record<string, CurrencyConfig> = {
  IN: { code: 'INR', locale: 'en-IN', symbol: '₹' },
  GB: { code: 'GBP', locale: 'en-GB', symbol: '£' },
  AT: { code: 'EUR', locale: 'de-AT', symbol: '€' },
  BE: { code: 'EUR', locale: 'fr-BE', symbol: '€' },
  DK: { code: 'DKK', locale: 'da-DK', symbol: 'kr' },
  FR: { code: 'EUR', locale: 'fr-FR', symbol: '€' },
  DE: { code: 'EUR', locale: 'de-DE', symbol: '€' },
  IE: { code: 'EUR', locale: 'en-IE', symbol: '€' },
  IT: { code: 'EUR', locale: 'it-IT', symbol: '€' },
  NL: { code: 'EUR', locale: 'nl-NL', symbol: '€' },
  PL: { code: 'PLN', locale: 'pl-PL', symbol: 'zł' },
  PT: { code: 'EUR', locale: 'pt-PT', symbol: '€' },
  ES: { code: 'EUR', locale: 'es-ES', symbol: '€' },
  SE: { code: 'SEK', locale: 'sv-SE', symbol: 'kr' },
};

/** Returns the currency configuration for a given ISO country code.
 *  Falls back to GBP/en-GB if the country is unrecognised. */
export function getCurrencyConfig(countryCode: string): CurrencyConfig {
  return CURRENCY_MAP[countryCode] ?? CURRENCY_MAP['GB'];
}

/**
 * Format a number as currency using the account's locale.
 * Produces Indian lakh/crore grouping automatically for en-IN.
 * e.g. formatCurrency(1234567, 'IN') → '₹12,34,567'
 */
export function formatCurrency(amount: number, countryCode: string): string {
  const { code, locale } = getCurrencyConfig(countryCode);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a plain number with locale-specific grouping (no currency symbol).
 * e.g. formatLocaleNumber(1234567, 'IN') → '12,34,567'
 *      formatLocaleNumber(1234567, 'GB') → '1,234,567'
 */
export function formatLocaleNumber(amount: number, countryCode: string): string {
  const { locale } = getCurrencyConfig(countryCode);
  return new Intl.NumberFormat(locale).format(amount);
}

/** Derive currency code from country code. Used when setting profile fields. */
export function currencyCodeForCountry(countryCode: string): string {
  return getCurrencyConfig(countryCode).code;
}

/** Derive locale from country code. Used when setting profile fields. */
export function localeForCountry(countryCode: string): string {
  return getCurrencyConfig(countryCode).locale;
}
