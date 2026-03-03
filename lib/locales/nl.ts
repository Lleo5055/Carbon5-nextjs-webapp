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
    subtext:
      'Zet uw emissiegegevens om in CSRD-conforme, GHG-Protocol-klare koolstofrekeningen — met rapporten op auditniveau en professionele Leadership Snapshots.',
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
    sub: 'De meeste mkb-bedrijven hebben geen duurzaamheidsteam. Greenio geeft u een duidelijke, geloofwaardige koolstofrekening zonder rompslomp — voor operationele, financiële en compliance-teams.',
    features: [
      {
        title: 'Eenvoudig van opzet',
        desc: 'Geen ingewikkelde spreadsheets. Voer verbruik of uitgaven in, kies een categorie en laat het platform CO₂e berekenen met Europese standaardmethoden.',
      },
      {
        title: 'CSRD-conforme rapporten',
        desc: 'Genereer overzichtelijke koolstofrekeningen voor raden van bestuur, investeerders en klanten. Ideaal voor aanbestedingen, naleving en netto-nuldoelstellingen.',
      },
      {
        title: 'Eerlijke, transparante prijzen',
        desc: 'Start gratis, upgrade wanneer de boekhouding regulier wordt. Geen lange contracten, geen adviesupsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'Hoe Greenio werkt',
    sub: 'Van rommelige rekeningen naar een auditklare koolstofrekening — in drie eenvoudige stappen.',
    steps: [
      {
        title: 'Voer uw gegevens in',
        desc: 'Begin met wat u heeft — elektriciteit, gas, brandstof en koudemiddelen. Geen perfecte gegevens nodig; schattingen worden ondersteund.',
      },
      {
        title: 'Wij berekenen uw voetafdruk',
        desc: 'We passen Europese emissiefactoren toe en bouwen uw koolstofrekening per maand, bron en hotspot — direct en transparant.',
      },
      {
        title: 'Download en onderneem actie',
        desc: 'Exporteer een overzichtelijk PDF voor uw raad van bestuur en begin uw grootste emissiebronnen aan te pakken met concrete aanbevelingen.',
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
    sub: 'Start gratis, upgrade pas wanneer koolstofboekhouding routine wordt. Geen installatiekosten, geen verrassingen.',
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
        price: '€11,99',
        period: 'per maand',
        features: [
          'Onbeperkte koolstofrekeningen/rapporten',
          'Prioriteitsondersteuning',
          'CSV / XLS-exports',
        ],
        cta: 'Kies Groei',
        badge: 'Meest populair',
      },
      pro: {
        name: 'Pro',
        price: '€29,99',
        period: 'per maand',
        features: [
          'Alles van Groei',
          'Teamtoegang (meerdere gebruikers)',
          'Leadership Snapshot',
          'AI-aanbevelingen voor reductie',
        ],
        cta: 'Kies Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Laten we praten',
        period: 'op maat',
        features: [
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
    sub: 'Of u nu net begint of uw netto-nulverplichting aanscherpt, Greenio geeft u een duidelijke basis en eenvoudige volgende stappen.',
    ctaPrimary: 'Begin vandaag gratis',
    ctaEmail: 'Mail ons',
    cardHeading: 'Liever e-mailen?',
    cardDesc:
      'Deel een paar regels over de omvang van uw bedrijf en waarom u koolstofboekhouding verkent. We reageren met volgende stappen en, indien handig, een link voor een kort kennismakingsgesprek.',
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
    subtext: 'Greenio past in de dagelijkse realiteit van drukke teams — geen klimaatconsultants nodig. Zo gebruiken onze klanten het platform vandaag.',
    tag: 'Vroege klanten in logistiek, professionele dienstverlening en tech.',
  },

  switcher: {
    title: 'Selecteer uw land',
  },
};
