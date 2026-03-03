// lib/locales/index.ts
// Locale registry, detection, and translation lookup.

import type { Translations } from './types';
import { en } from './en';
import { ie } from './ie';
import { de } from './de';
import { fr } from './fr';
import { it } from './it';
import { es } from './es';
import { nl } from './nl';
import { pl } from './pl';
import { sv } from './sv';
import { da } from './da';
import { pt } from './pt';
import { india } from './in';

export type SupportedLocale =
  | 'en' | 'ie' | 'de' | 'fr' | 'it' | 'es'
  | 'nl' | 'pl' | 'sv' | 'da' | 'pt' | 'in';

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en', 'ie', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'sv', 'da', 'pt', 'in',
];

/** 14 countries shown in the globe switcher modal. */
export const SWITCHER_COUNTRIES = [
  { locale: 'en' as SupportedLocale, code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { locale: 'ie' as SupportedLocale, code: 'IE', name: 'Ireland',         flag: '🇮🇪' },
  { locale: 'de' as SupportedLocale, code: 'DE', name: 'Deutschland',     flag: '🇩🇪' },
  { locale: 'de' as SupportedLocale, code: 'AT', name: 'Österreich',      flag: '🇦🇹' },
  { locale: 'fr' as SupportedLocale, code: 'FR', name: 'France',          flag: '🇫🇷' },
  { locale: 'fr' as SupportedLocale, code: 'BE', name: 'Belgique',        flag: '🇧🇪' },
  { locale: 'it' as SupportedLocale, code: 'IT', name: 'Italia',          flag: '🇮🇹' },
  { locale: 'es' as SupportedLocale, code: 'ES', name: 'España',          flag: '🇪🇸' },
  { locale: 'nl' as SupportedLocale, code: 'NL', name: 'Nederland',       flag: '🇳🇱' },
  { locale: 'pl' as SupportedLocale, code: 'PL', name: 'Polska',          flag: '🇵🇱' },
  { locale: 'sv' as SupportedLocale, code: 'SE', name: 'Sverige',         flag: '🇸🇪' },
  { locale: 'da' as SupportedLocale, code: 'DK', name: 'Danmark',         flag: '🇩🇰' },
  { locale: 'pt' as SupportedLocale, code: 'PT', name: 'Portugal',        flag: '🇵🇹' },
  { locale: 'in' as SupportedLocale, code: 'IN', name: 'India',           flag: '🇮🇳' },
];

/** BCP 47 primary language tag → our locale slug. */
const LANG_TO_LOCALE: Record<string, SupportedLocale> = {
  en: 'en', 'en-GB': 'en', 'en-US': 'en', 'en-AU': 'en',
  'en-IE': 'ie',
  de: 'de', 'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  fr: 'fr', 'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr',
  it: 'it', 'it-IT': 'it',
  es: 'es', 'es-ES': 'es',
  nl: 'nl', 'nl-NL': 'nl', 'nl-BE': 'nl',
  pl: 'pl', 'pl-PL': 'pl',
  sv: 'sv', 'sv-SE': 'sv',
  da: 'da', 'da-DK': 'da',
  pt: 'pt', 'pt-PT': 'pt', 'pt-BR': 'pt',
  hi: 'in', 'hi-IN': 'in',
};

/**
 * Detects the best locale from the browser's navigator.language.
 * Falls back to 'en' if no match found.
 * Safe to call only on the client (typeof navigator !== 'undefined').
 */
export function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || 'en';
  return (
    LANG_TO_LOCALE[lang] ||
    LANG_TO_LOCALE[lang.split('-')[0]] ||
    'en'
  );
}

/** Returns the Translations object for the given locale slug. */
export function getTranslations(locale: string): Translations {
  switch (locale as SupportedLocale) {
    case 'ie': return ie;
    case 'de': return de;
    case 'fr': return fr;
    case 'it': return it;
    case 'es': return es;
    case 'nl': return nl;
    case 'pl': return pl;
    case 'sv': return sv;
    case 'da': return da;
    case 'pt': return pt;
    case 'in': return india;
    default:   return en;
  }
}

export type { Translations };
