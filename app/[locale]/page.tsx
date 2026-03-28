// app/[locale]/page.tsx
// Server component — pre-renders all supported locale routes at build time.

import type { Metadata } from 'next';
import { SUPPORTED_LOCALES } from '@/lib/locales/index';
import LocaleHomePage from './LocaleHomePage';

interface Props {
  params: { locale: string };
}

const BASE_URL = 'https://greenio.co';

// ── Per-locale SEO metadata ───────────────────────────────────────────────────

const SEO: Record<string, {
  title: string;
  description: string;
  keywords: string;
  ogLocale: string;
  country: string;
  currency: string;
  faqs: { q: string; a: string }[];
}> = {
  en: {
    ogLocale: 'en_GB',
    country: 'United Kingdom',
    currency: 'GBP',
    title: 'SECR Carbon Accounting Software for UK SMEs | Greenio',
    description: 'Automate your SECR reporting and meet UK carbon disclosure requirements. GHG Protocol aligned, audit-grade carbon accounting for UK businesses. Free trial available.',
    keywords: 'SECR reporting software, carbon accounting UK SME, GHG reporting tool UK, streamlined energy carbon reporting, net zero software UK, carbon footprint UK business',
    faqs: [
      { q: 'What is SECR reporting?', a: 'Streamlined Energy and Carbon Reporting (SECR) is a UK government framework requiring large companies to disclose their energy use and carbon emissions in their annual reports, aligned with BEIS guidelines.' },
      { q: 'Who needs to comply with SECR?', a: 'UK quoted companies, large unquoted companies, and large LLPs meeting 2 of: 250+ employees, £36m+ turnover, or £18m+ balance sheet must comply with SECR.' },
      { q: 'How does Greenio help with SECR?', a: 'Greenio automates Scope 1 and 2 emissions calculations using BEIS-approved emission factors and generates audit-ready SECR reports in hours, not weeks.' },
    ],
  },
  ie: {
    ogLocale: 'en_IE',
    country: 'Ireland',
    currency: 'EUR',
    title: 'Carbon Accounting Software CSRD for Irish SMEs | Greenio',
    description: 'Greenio helps Irish businesses calculate Scope 1, 2 and 3 emissions and generate CSRD-compliant reports. Audit-grade accuracy, built for non-experts. Free trial.',
    keywords: 'carbon accounting software Ireland, CSRD reporting Ireland, GHG emissions tool Ireland, ESG reporting Irish SME, net zero Ireland business',
    faqs: [
      { q: 'What is CSRD?', a: 'The Corporate Sustainability Reporting Directive (CSRD) is an EU regulation requiring companies to report on their environmental and social impacts, including Scope 1, 2 and 3 greenhouse gas emissions.' },
      { q: 'When does CSRD apply to Irish SMEs?', a: 'CSRD applies to large Irish companies from 2025, and is expected to extend to listed SMEs from 2026. Voluntary adoption is encouraged now to build audit-ready data.' },
      { q: 'How does Greenio support Irish businesses?', a: 'Greenio provides Irish-specific emission factors (Ireland grid: 0.301 kg CO₂e/kWh), CSRD-aligned reporting, and audit-grade Scope 1, 2 and 3 calculations.' },
    ],
  },
  de: {
    ogLocale: 'de_DE',
    country: 'Germany',
    currency: 'EUR',
    title: 'CSRD-konforme CO2-Bilanzierung Software für deutsche Unternehmen | Greenio',
    description: 'Greenio hilft deutschen KMUs bei der CSRD-konformen CO2-Bilanzierung. Scope 1, 2 und 3 Emissionen automatisch berechnen und Berichte erstellen. Jetzt kostenlos testen.',
    keywords: 'CO2 Bilanzierung Software, CSRD Reporting Deutschland, Treibhausgasrechner KMU, Nachhaltigkeitsbericht Software, ESG Reporting Tool Deutschland',
    faqs: [
      { q: 'Was ist die CSRD?', a: 'Die Corporate Sustainability Reporting Directive (CSRD) ist eine EU-Verordnung, die Unternehmen zur Berichterstattung über Scope 1, 2 und 3 Treibhausgasemissionen verpflichtet.' },
      { q: 'Wann gilt die CSRD für deutsche KMUs?', a: 'Große Unternehmen müssen ab 2025 berichten, börsennotierte KMUs voraussichtlich ab 2026. Eine frühzeitige Umsetzung sichert prüfungssichere Daten.' },
      { q: 'Wie hilft Greenio deutschen Unternehmen?', a: 'Greenio berechnet automatisch CO2-Emissionen mit deutschen Emissionsfaktoren (DE-Stromnetz: 0,366 kg CO₂e/kWh) und erstellt CSRD-konforme Berichte.' },
    ],
  },
  fr: {
    ogLocale: 'fr_FR',
    country: 'France',
    currency: 'EUR',
    title: 'Logiciel Bilan Carbone CSRD pour PME françaises | Greenio',
    description: 'Greenio automatise votre bilan carbone et reporting CSRD. Calculez vos émissions Scope 1, 2 et 3 et générez des rapports audit. Essai gratuit pour les PME françaises.',
    keywords: 'logiciel bilan carbone, CSRD reporting France, comptabilité carbone PME, empreinte carbone entreprise, ESG reporting France',
    faqs: [
      { q: "Qu'est-ce que la CSRD ?", a: "La Corporate Sustainability Reporting Directive (CSRD) est une réglementation européenne qui oblige les entreprises à publier leurs émissions de Scope 1, 2 et 3." },
      { q: 'Quand la CSRD s\'applique-t-elle aux PME françaises ?', a: 'Les grandes entreprises doivent se conformer dès 2025. Les PME cotées sont concernées à partir de 2026. Une adoption anticipée garantit des données certifiables.' },
      { q: 'Comment Greenio aide les PME françaises ?', a: 'Greenio calcule automatiquement les émissions avec des facteurs d\'émission français (réseau FR : 0,056 kg CO₂e/kWh) et génère des rapports CSRD certifiables.' },
    ],
  },
  it: {
    ogLocale: 'it_IT',
    country: 'Italy',
    currency: 'EUR',
    title: 'Software di Contabilità del Carbonio CSRD per PMI italiane | Greenio',
    description: 'Greenio aiuta le PMI italiane a calcolare le emissioni Scope 1, 2 e 3 e a produrre report CSRD. Semplice, preciso e conforme. Prova gratuita disponibile.',
    keywords: 'software contabilità carbonio, CSRD reporting Italia, impronta carbonio azienda, emissioni gas serra PMI, ESG reporting Italia',
    faqs: [
      { q: 'Cos\'è la CSRD?', a: 'La Corporate Sustainability Reporting Directive (CSRD) è una normativa UE che obbliga le aziende a rendicontare le emissioni di Scope 1, 2 e 3.' },
      { q: 'Quando si applica la CSRD alle PMI italiane?', a: 'Le grandi aziende devono conformarsi dal 2025, le PMI quotate dal 2026. Un\'adozione anticipata garantisce dati certificabili.' },
      { q: 'Come aiuta Greenio le PMI italiane?', a: 'Greenio calcola automaticamente le emissioni con fattori italiani (rete IT: 0,239 kg CO₂e/kWh) e genera report CSRD pronti per l\'audit.' },
    ],
  },
  es: {
    ogLocale: 'es_ES',
    country: 'Spain',
    currency: 'EUR',
    title: 'Software de Contabilidad de Carbono CSRD para PYMEs españolas | Greenio',
    description: 'Greenio automatiza el cálculo de emisiones Scope 1, 2 y 3 y genera informes CSRD para empresas españolas. Fácil, preciso y conforme a la normativa. Prueba gratuita.',
    keywords: 'software huella de carbono, CSRD reporting España, contabilidad carbono PYME, emisiones GEI empresa, ESG reporting España',
    faqs: [
      { q: '¿Qué es la CSRD?', a: 'La Corporate Sustainability Reporting Directive (CSRD) es una normativa de la UE que exige a las empresas informar sobre sus emisiones de Scope 1, 2 y 3.' },
      { q: '¿Cuándo se aplica la CSRD a las PYMEs españolas?', a: 'Las grandes empresas deben cumplir desde 2025, las PYMEs cotizadas desde 2026. La adopción anticipada garantiza datos certificables.' },
      { q: '¿Cómo ayuda Greenio a las empresas españolas?', a: 'Greenio calcula automáticamente las emisiones con factores españoles (red ES: 0,231 kg CO₂e/kWh) y genera informes CSRD listos para auditoría.' },
    ],
  },
  nl: {
    ogLocale: 'nl_NL',
    country: 'Netherlands',
    currency: 'EUR',
    title: 'CO2-boekhouding Software CSRD voor Nederlandse MKB | Greenio',
    description: 'Greenio helpt Nederlandse MKB-bedrijven met CSRD-conforme CO2-rapportage. Automatisch Scope 1, 2 en 3 berekenen en auditkwaliteitsrapporten genereren.',
    keywords: 'CO2 boekhouding software, CSRD rapportage Nederland, koolstofvoetafdruk bedrijf, ESG reporting MKB, duurzaamheidsrapport software',
    faqs: [
      { q: 'Wat is de CSRD?', a: 'De Corporate Sustainability Reporting Directive (CSRD) is een EU-verordening die bedrijven verplicht te rapporteren over Scope 1, 2 en 3 broeikasgasemissies.' },
      { q: 'Wanneer geldt de CSRD voor Nederlandse MKB?', a: 'Grote bedrijven moeten vanaf 2025 voldoen, beursgenoteerde MKB-bedrijven naar verwachting vanaf 2026.' },
      { q: 'Hoe helpt Greenio Nederlandse bedrijven?', a: 'Greenio berekent automatisch emissies met Nederlandse emissiefactoren (NL elektriciteitsnet: 0,338 kg CO₂e/kWh) en genereert CSRD-conforme rapporten.' },
    ],
  },
  pl: {
    ogLocale: 'pl_PL',
    country: 'Poland',
    currency: 'EUR',
    title: 'Oprogramowanie do Rachunkowości Węglowej CSRD dla polskich MŚP | Greenio',
    description: 'Greenio pomaga polskim firmom obliczać emisje Scope 1, 2 i 3 oraz tworzyć raporty CSRD. Proste, dokładne i zgodne z przepisami. Bezpłatny okres próbny.',
    keywords: 'oprogramowanie ślad węglowy, CSRD raportowanie Polska, rachunkowość emisji GHG, ESG raportowanie MŚP, zrównoważony rozwój oprogramowanie',
    faqs: [
      { q: 'Czym jest CSRD?', a: 'Dyrektywa CSRD (Corporate Sustainability Reporting Directive) to unijne rozporządzenie zobowiązujące firmy do raportowania emisji Scope 1, 2 i 3.' },
      { q: 'Kiedy CSRD dotyczy polskich MŚP?', a: 'Duże firmy muszą stosować się od 2025, notowane MŚP od 2026. Wczesne wdrożenie gwarantuje dane gotowe do audytu.' },
      { q: 'Jak Greenio pomaga polskim firmom?', a: 'Greenio automatycznie oblicza emisje z polskimi wskaźnikami emisji (sieć PL: 0,746 kg CO₂e/kWh) i generuje raporty CSRD.' },
    ],
  },
  sv: {
    ogLocale: 'sv_SE',
    country: 'Sweden',
    currency: 'EUR',
    title: 'Koldioxidredovisning Programvara CSRD för svenska SMF | Greenio',
    description: 'Greenio hjälper svenska företag att beräkna Scope 1, 2 och 3-utsläpp och skapa CSRD-rapporter. Enkelt, exakt och regelrätt. Testa gratis idag.',
    keywords: 'koldioxidredovisning programvara, CSRD rapportering Sverige, klimatavtryck företag, ESG rapportering SMF, hållbarhetsrapport verktyg',
    faqs: [
      { q: 'Vad är CSRD?', a: 'Corporate Sustainability Reporting Directive (CSRD) är en EU-förordning som kräver att företag rapporterar Scope 1, 2 och 3-utsläpp av växthusgaser.' },
      { q: 'När gäller CSRD för svenska SMF?', a: 'Stora företag måste följa reglerna från 2025, noterade SMF förväntas från 2026. Tidig adoption säkerställer revisionsgodkända data.' },
      { q: 'Hur hjälper Greenio svenska företag?', a: 'Greenio beräknar automatiskt utsläpp med svenska emissionsfaktorer (SE elnät: 0,012 kg CO₂e/kWh) och skapar CSRD-rapporter.' },
    ],
  },
  da: {
    ogLocale: 'da_DK',
    country: 'Denmark',
    currency: 'EUR',
    title: "Kulstofregnskab Software CSRD for danske SMV'er | Greenio",
    description: 'Greenio hjælper danske virksomheder med at beregne Scope 1, 2 og 3-emissioner og udarbejde CSRD-rapporter. Enkel, præcis og lovmedholdelig. Gratis prøveperiode.',
    keywords: "kulstofregnskab software, CSRD rapportering Danmark, CO2 aftryk virksomhed, ESG rapportering SMV, bæredygtighedsrapport",
    faqs: [
      { q: 'Hvad er CSRD?', a: 'Corporate Sustainability Reporting Directive (CSRD) er en EU-forordning, der kræver, at virksomheder rapporterer Scope 1, 2 og 3 drivhusgasemissioner.' },
      { q: 'Hvornår gælder CSRD for danske SMV\'er?', a: 'Store virksomheder skal overholde fra 2025, børsnoterede SMV\'er fra 2026. Tidlig adoption sikrer revisionsgodkendte data.' },
      { q: 'Hvordan hjælper Greenio danske virksomheder?', a: 'Greenio beregner automatisk emissioner med danske emissionsfaktorer (DK elnet: 0,207 kg CO₂e/kWh) og genererer CSRD-rapporter.' },
    ],
  },
  pt: {
    ogLocale: 'pt_PT',
    country: 'Portugal',
    currency: 'EUR',
    title: 'Software de Contabilidade de Carbono CSRD para PMEs portuguesas | Greenio',
    description: 'Greenio automatiza o cálculo de emissões Scope 1, 2 e 3 e gera relatórios CSRD para empresas portuguesas. Simples, preciso e conforme. Teste gratuito.',
    keywords: 'software pegada de carbono, CSRD reporting Portugal, contabilidade carbono PME, emissões GEE empresa, ESG reporting Portugal',
    faqs: [
      { q: 'O que é a CSRD?', a: 'A Corporate Sustainability Reporting Directive (CSRD) é uma regulamentação da UE que exige que as empresas reportem emissões de Scope 1, 2 e 3.' },
      { q: 'Quando se aplica a CSRD às PMEs portuguesas?', a: 'Grandes empresas devem cumprir a partir de 2025, PMEs cotadas a partir de 2026. A adoção antecipada garante dados certificáveis.' },
      { q: 'Como o Greenio ajuda empresas portuguesas?', a: 'Greenio calcula automaticamente emissões com fatores portugueses (rede PT: 0,235 kg CO₂e/kWh) e gera relatórios CSRD prontos para auditoria.' },
    ],
  },
  in: {
    ogLocale: 'en_IN',
    country: 'India',
    currency: 'INR',
    title: 'BRSR & CCTS Carbon Accounting Software for Indian Companies | Greenio',
    description: 'Greenio helps Indian businesses automate BRSR reporting and CCTS compliance. Built for non-experts. Audit-grade carbon accounting for Scope 1, 2 & 3 emissions. Start free.',
    keywords: 'BRSR reporting software, CCTS compliance India, carbon accounting India, Scope 1 2 3 emissions India, SEBI ESG reporting, carbon credit trading scheme India, sustainability reporting India',
    faqs: [
      { q: 'What is BRSR reporting?', a: 'Business Responsibility and Sustainability Reporting (BRSR) is mandatory for SEBI\'s top 1000 listed companies in India. It requires disclosure of Scope 1, 2 and 3 greenhouse gas emissions.' },
      { q: 'How does CCTS work in India?', a: 'The Carbon Credit Trading Scheme (CCTS) is India\'s domestic carbon market under the Energy Conservation Act. It enables companies to earn and trade carbon credits for verified emission reductions.' },
      { q: 'Is BRSR mandatory?', a: 'Yes, BRSR is mandatory for the top 1000 listed companies by market capitalisation on BSE and NSE. Voluntary adoption is encouraged for all other businesses.' },
      { q: 'How does Greenio support BRSR compliance?', a: 'Greenio uses India-specific BEE and CEA emission factors (India grid: 0.820 kg CO₂e/kWh), calculates Scope 1, 2 and 3 emissions, and generates BRSR-ready reports.' },
    ],
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

function getJsonLd(locale: string) {
  const seo = SEO[locale] ?? SEO.en;
  const canonical = `${BASE_URL}/${locale}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Greenio',
        url: canonical,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: seo.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: seo.currency,
          availability: 'https://schema.org/InStock',
        },
        areaServed: { '@type': 'Country', name: seo.country },
        keywords: seo.keywords,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '47',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: seo.faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

export default function LocalePage({ params }: Props) {
  const jsonLd = getJsonLd(params.locale);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LocaleHomePage locale={params.locale} />
    </>
  );
}
