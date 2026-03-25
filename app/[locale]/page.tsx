// app/[locale]/page.tsx
// Server component — pre-renders all supported locale routes at build time.

import type { Metadata } from 'next';
import { SUPPORTED_LOCALES } from '@/lib/locales/index';
import LocaleHomePage from './LocaleHomePage';

interface Props {
  params: { locale: string };
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';

// ── Per-locale SEO metadata ───────────────────────────────────────────────────

const SEO: Record<string, { title: string; description: string; keywords: string; ogLocale: string }> = {
  en: {
    ogLocale: 'en_GB',
    title: 'Carbon Accounting Software for UK SMEs | Greenio',
    description: 'Greenio helps UK small businesses track, report and reduce their carbon footprint. SECR-aligned reporting, automatic CO2e calculations and Leadership Snapshot PDF. Free to start.',
    keywords: 'carbon accounting software UK, SECR reporting tool, SME carbon footprint tracker, carbon accounting UK SME, CO2 tracking software',
  },
  ie: {
    ogLocale: 'en_IE',
    title: 'Carbon Accounting Software for Irish SMEs | Greenio',
    description: 'Track your business carbon footprint and meet CSRD requirements with Greenio. Simple CO2e reporting built for Irish SMEs. Free to start.',
    keywords: 'carbon accounting Ireland, CSRD reporting software Ireland, SME carbon footprint Ireland, CO2 tracking Ireland',
  },
  de: {
    ogLocale: 'de_DE',
    title: 'CO2-Bilanz Software fuer KMU | Greenio',
    description: 'Greenio hilft kleinen und mittleren Unternehmen in Deutschland, ihren CO2-Fussabdruck zu erfassen und CSRD-konforme Berichte zu erstellen. Kostenlos starten.',
    keywords: 'CO2 Bilanz Software Deutschland, Klimabilanz KMU, CSRD Berichterstattung Software, Treibhausgas Rechner Deutschland',
  },
  fr: {
    ogLocale: 'fr_FR',
    title: 'Logiciel de Bilan Carbone pour PME | Greenio',
    description: "Calculez et reduisez l'empreinte carbone de votre entreprise avec Greenio. Reporting CSRD simplifie pour les PME francaises. Gratuit pour commencer.",
    keywords: 'logiciel bilan carbone PME France, reporting CSRD France, empreinte carbone entreprise, calcul CO2 entreprise France',
  },
  it: {
    ogLocale: 'it_IT',
    title: 'Software per la Contabilita del Carbonio per PMI | Greenio',
    description: "Greenio aiuta le PMI italiane a calcolare e rendicontare le emissioni di CO2. Conformita CSRD semplificata. Inizia gratuitamente.",
    keywords: 'software contabilita carbonio PMI Italia, rendicontazione CSRD Italia, impronta carbonio azienda, CO2 calcolo impresa Italia',
  },
  es: {
    ogLocale: 'es_ES',
    title: 'Software de Contabilidad de Carbono para PYMEs | Greenio',
    description: 'Greenio ayuda a las pequenas empresas espanolas a medir y reportar su huella de carbono. Informes CSRD simplificados. Empieza gratis.',
    keywords: 'software contabilidad carbono PYME Espana, reporting CSRD Espana, huella de carbono empresa, calculo CO2 empresa Espana',
  },
  nl: {
    ogLocale: 'nl_NL',
    title: 'CO2-boekhouding Software voor MKB | Greenio',
    description: 'Greenio helpt Nederlandse MKB-bedrijven hun CO2-uitstoot bij te houden en CSRD-rapporten te genereren. Gratis beginnen.',
    keywords: 'CO2 boekhouding software Nederland, CSRD rapportage MKB, koolstofvoetafdruk bedrijf, CO2 berekening MKB Nederland',
  },
  pl: {
    ogLocale: 'pl_PL',
    title: 'Oprogramowanie do Sledzenia Emisji CO2 dla MSP | Greenio',
    description: 'Greenio pomaga polskim malym i srednim przedsiebiorstwom sledzic emisje CO2 i spelniac wymogi CSRD. Zacznij bezplatnie.',
    keywords: 'oprogramowanie emisje CO2 MSP Polska, raportowanie CSRD Polska, slad weglowy firmy, obliczanie CO2 firma Polska',
  },
  sv: {
    ogLocale: 'sv_SE',
    title: 'Koldioxidredovisning for Svenska SMF | Greenio',
    description: 'Greenio hjalper svenska smaforetag att spara och rapportera sina koldioxidutslapp. CSRD-anpassad rapportering. Gratis att borja.',
    keywords: 'koldioxidredovisning Sverige, CSRD rapportering SMF, koldioxidavtryck foretag Sverige, CO2 berakning foretag',
  },
  da: {
    ogLocale: 'da_DK',
    title: 'CO2-regnskab Software til Danske SMV | Greenio',
    description: 'Greenio hjaelper danske sma og mellemstore virksomheder med at spore og rapportere CO2-udledninger. CSRD-tilpasset. Gratis at starte.',
    keywords: 'CO2 regnskab software Danmark, CSRD rapportering SMV, kulstofaftryk virksomhed Danmark, CO2 beregning firma',
  },
  pt: {
    ogLocale: 'pt_PT',
    title: 'Software de Contabilidade de Carbono para PMEs | Greenio',
    description: 'Greenio ajuda as PMEs portuguesas a calcular e reportar a sua pegada de carbono. Relatorios CSRD simplificados. Comece gratuitamente.',
    keywords: 'software contabilidade carbono PME Portugal, relatorio CSRD Portugal, pegada de carbono empresa, calculo CO2 empresa Portugal',
  },
  in: {
    ogLocale: 'en_IN',
    title: 'Carbon Accounting & BRSR Reporting Software for India | Greenio',
    description: 'Greenio helps Indian businesses track Scope 1, 2 & 3 emissions and generate BRSR-ready ESG reports. India-specific CEA/BEE emission factors. Free to start.',
    keywords: 'BRSR reporting software India, carbon accounting India, ESG software India, CCTS compliance India, carbon footprint tracker India, Scope 3 emissions India',
  },
};

// BCP-47 hreflang map for all locales
const HREFLANG: Record<string, string> = {
  'en-GB':     `${BASE_URL}/en`,
  'en-IE':     `${BASE_URL}/ie`,
  'de':        `${BASE_URL}/de`,
  'fr':        `${BASE_URL}/fr`,
  'it':        `${BASE_URL}/it`,
  'es':        `${BASE_URL}/es`,
  'nl':        `${BASE_URL}/nl`,
  'pl':        `${BASE_URL}/pl`,
  'sv':        `${BASE_URL}/sv`,
  'da':        `${BASE_URL}/da`,
  'pt':        `${BASE_URL}/pt`,
  'en-IN':     `${BASE_URL}/in`,
  'x-default': `${BASE_URL}/en`,
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seo = SEO[params.locale] ?? SEO.en;
  const canonical = `${BASE_URL}/${params.locale}`;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical,
      languages: HREFLANG,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: 'Greenio',
      type: 'website',
      locale: seo.ogLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
    robots: { index: true, follow: true },
  };
}

export default function LocalePage({ params }: Props) {
  return <LocaleHomePage locale={params.locale} />;
}
