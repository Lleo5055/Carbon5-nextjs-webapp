import type { Translations } from './types';

export const nl: Translations = {
  lang: 'nl',

  nav: {
    product: 'Product',
    howItWorks: 'Hoe het werkt',
    pricing: 'Prijzen',
    contact: 'Contact',
    login: 'Inloggen',
    getStarted: 'Gratis starten',
  },

  hero: {
    badge: 'Gebouwd voor Europese mkb-bedrijven',
    headline: 'Auditklare koolstofboekhouding voor mkb,',
    headlineHighlight: 'in enkele minuten klaar.',
    subtext: 'CSRD-conforme koolstofrekeningen met rapporten op auditniveau en Leadership Snapshots. Zonder consultants, zonder complexiteit.',
    cta: 'Gratis starten – geen kaart vereist',
    stat1: 'Ontworpen voor mkb-bedrijven met 1–250 medewerkers',
    stat2: 'Eerste koolstofrekening in minder dan 30 minuten',
    efBadge: 'NL elektriciteitsnet: 0,338 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Emissies huidig jaar',
    subtitle: 'CO₂-overzicht · Europese entiteit',
    badgeLabel: 'Live bèta',
    totalCo2eLabel: 'Totaal CO₂e',
    totalCo2eChange: '–8,2% t.o.v. vorig jaar',
    electricityLabel: 'Elektriciteit',
    electricityNote: 'Grootste bron',
    reportsLabel: 'Rapporten',
    reportsNote: 'Dit jaar',
    trendLabel: 'Trend per maand',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Boardrapport met één klik',
    downloadSub: 'Exporteer een overzichtelijk PDF met uw laatste gegevens.',
    downloadBtn: 'PDF downloaden',
  },

  product: {
    heading: 'Gebouwd voor echte bedrijven, niet voor klimaatwetenschappers.',
    sub: 'Geen duurzaamheidsteam nodig. Duidelijke koolstofboekhouding voor operationele, financiële en compliance-teams.',
    features: [
      {
        title: 'Eenvoudig van opzet',
        desc: 'Geen ingewikkelde spreadsheets. Voer verbruik in, kies een categorie en laat het platform CO₂e berekenen met Europese standaardmethoden.',
      },
      {
        title: 'CSRD-conforme rapporten',
        desc: 'Overzichtelijke koolstofrekeningen voor raden van bestuur, investeerders en klanten. Ideaal voor aanbestedingen, naleving en netto-nuldoelstellingen.',
      },
      {
        title: 'Eerlijke, transparante prijzen',
        desc: 'Start gratis, upgrade wanneer de boekhouding regulier wordt. Geen lange contracten, geen adviesupsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'Hoe Greenio werkt',
    sub: 'Van rommelige rekeningen naar een auditklare koolstofrekening in drie stappen.',
    steps: [
      {
        title: 'Voer uw gegevens in',
        desc: 'Elektriciteit, gas, brandstof en koudemiddelen. Geen perfecte data nodig, schattingen worden ondersteund.',
      },
      {
        title: 'Wij berekenen uw voetafdruk',
        desc: 'Europese emissiefactoren. Uw koolstofrekening per maand, bron en hotspot, direct.',
      },
      {
        title: 'Download en onderneem actie',
        desc: 'Exporteer een PDF voor uw raad van bestuur en pak uw grootste emissiebronnen aan.',
      },
    ],
    benefits: [
      '30 minuten naar de eerste koolstofrekening',
      'CSRD-conforme rapporten',
      'Ontworpen voor niet-specialisten',
    ],
  },

  pricing: {
    heading: 'Eenvoudige, transparante prijzen',
    sub: 'Start gratis. Upgrade wanneer u er klaar voor bent. Geen kosten, geen contracten.',
    note: 'Alle plannen bieden toegang tot hetzelfde overzichtelijke, minimalistische dashboard.',
    cancelNote: 'Op elk moment opzeggen of van plan wisselen. Geen langetermijncontracten.',
    plans: {
      free: {
        name: 'Gratis',
        price: '€0',
        period: 'per maand',
        features: [
          'Onbeperkte gegevensinvoer',
          '1 koolstofrekening/rapport per jaar',
          'Kern-emissiedashboard',
        ],
        cta: 'Gratis starten',
      },
      growth: {
        name: 'Groei',
        price: '€14,99',
        period: 'per maand',
        features: [
          'Onbeperkte koolstofrekeningen/rapporten',
          'CSV / XLS-exports',
          'CSRD-rapportage',
          'E-mailondersteuning',
        ],
        cta: 'Kies Groei',
      },
      pro: {
        name: 'Pro',
        price: '€34,99',
        period: 'per maand',
        features: [
          'Alles van Groei',
          'Teamtoegang voor meerdere gebruikers',
          'Leadership Snapshot',
          'AI-aanbevelingen voor reductie',
          'Prioriteitsondersteuning',
        ],
        cta: 'Kies Pro',
        badge: 'Meest populair',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Neem contact',
        period: 'op maat',
        features: [
          'Alles van Pro',
          'Meerdere entiteiten & locaties',
          'Aangepaste onboarding & ondersteuning',
          'Dedicated accountmanager',
        ],
        cta: 'Neem contact op',
      },
    },
  },

  contact: {
    heading: 'Maak van koolstofboekhouding een kracht, geen last.',
    sub: 'Een duidelijke basis en eenvoudige volgende stappen voor echte Europese bedrijven.',
    ctaPrimary: 'Begin vandaag gratis',
    ctaEmail: 'Mail ons',
    cardHeading: 'Liever e-mailen?',
    cardDesc:
      'Deel de omvang van uw bedrijf en waarom u koolstofboekhouding verkent. We reageren met volgende stappen.',
    cardEmailLabel: 'E-mail:',
  },

  footer: {
    rights: 'Greenio. Alle rechten voorbehouden.',
    madeIn: 'Gemaakt in het Verenigd Koninkrijk',
    flag: '🇬🇧',
    privacy: 'Privacy',
    terms: 'Voorwaarden',
  },

  testimonials: {
    heading: 'Vertrouwd door operations- en financieteams in Europa.',
    subtext: 'Zo gebruiken onze klanten Greenio vandaag.',
    tag: 'Vroege klanten in logistiek, professionele dienstverlening en tech.',
  },

  switcher: {
    title: 'Selecteer uw land',
  },
};
