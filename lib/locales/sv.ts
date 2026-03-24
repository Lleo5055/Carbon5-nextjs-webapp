import type { Translations } from './types';

export const sv: Translations = {
  lang: 'sv',

  nav: {
    product: 'Produkt',
    howItWorks: 'Hur det fungerar',
    pricing: 'Priser',
    contact: 'Kontakt',
    login: 'Logga in',
    getStarted: 'Kom igång gratis',
  },

  hero: {
    badge: 'Byggd för europeiska SMF',
    headline: 'Revisionsredo koldioxidredovisning för SMF,',
    headlineHighlight: 'klar på minuter.',
    subtext: 'CSRD-kompatibla koldioxidkonton med revisionsklara rapporter och Leadership Snapshots. Utan konsulter, utan komplexitet.',
    cta: 'Kom igång gratis – inget kort behövs',
    stat1: 'Designad för SMF med 1–250 anställda',
    stat2: 'Första koldioxidkontot på under 30 minuter',
    efBadge: 'SE elnät: 0,012 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Årets utsläpp',
    subtitle: 'CO₂-översikt · Europeisk enhet',
    badgeLabel: 'Live beta',
    totalCo2eLabel: 'Totalt CO₂e',
    totalCo2eChange: '–8,2% mot föregående år',
    electricityLabel: 'El',
    electricityNote: 'Största källa',
    reportsLabel: 'Rapporter',
    reportsNote: 'I år',
    trendLabel: 'Trend per månad',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Styrelserapport med ett klick',
    downloadSub: 'Exportera en ren PDF med dina senaste data.',
    downloadBtn: 'Ladda ner PDF',
  },

  product: {
    heading: 'Byggd för riktiga företag, inte klimatforskare.',
    sub: 'Inget hållbarhetsteam krävs. Tydlig koldioxidredovisning för drift-, ekonomi- och complianceteam.',
    features: [
      {
        title: 'Enkelt av design',
        desc: 'Inga krångliga kalkylblad. Ange förbrukning, välj kategori och låt plattformen beräkna CO₂e med europeiska standardmetoder.',
      },
      {
        title: 'CSRD-kompatibla resultat',
        desc: 'Rena koldioxidkonton för styrelser, investerare och kunder. Perfekt för upphandlingar, regelefterlevnad och netto-nollmål.',
      },
      {
        title: 'Rättvis, transparent prissättning',
        desc: 'Börja gratis, uppgradera när redovisningen blir rutinmässig. Inga långa kontrakt, inget konsultupselling.',
      },
    ],
  },

  howItWorks: {
    heading: 'Hur Greenio fungerar',
    sub: 'Från röriga räkningar till ett revisionsklart koldioxidkonto i tre steg.',
    steps: [
      {
        title: 'Lägg till dina data',
        desc: 'El, gas, bränsle och köldmedier. Inga perfekta data krävs, uppskattningar stöds.',
      },
      {
        title: 'Vi beräknar ditt fotavtryck',
        desc: 'Europeiska emissionsfaktorer. Ditt koldioxidkonto per månad, källa och hotspot, direkt.',
      },
      {
        title: 'Ladda ner och agera',
        desc: 'Exportera en PDF till din styrelse och adressera dina viktigaste utsläppskällor.',
      },
    ],
    benefits: [
      '30 minuter till första koldioxidkontot',
      'CSRD-kompatibla resultat',
      'Designad för icke-specialister',
    ],
  },

  pricing: {
    heading: 'Enkel, transparent prissättning',
    sub: 'Börja gratis. Uppgradera när du är redo. Inga avgifter, inga kontrakt.',
    note: 'Alla planer inkluderar tillgång till samma rena, minimalistiska instrumentpanel.',
    cancelNote: 'Avsluta eller byt plan när som helst. Inga långsiktiga avtal.',
    plans: {
      free: {
        name: 'Gratis',
        price: '0 kr',
        period: 'per månad',
        features: [
          'Obegränsad datainmatning',
          '1 koldioxidkonto/rapport per år',
          'Kärnemissionspanel',
        ],
        cta: 'Börja med Gratis',
      },
      growth: {
        name: 'Tillväxt',
        price: '169 kr',
        period: 'per månad',
        features: [
          'Obegränsade koldioxidkonton/rapporter',
          'CSV / XLS-exporter',
          'CSRD-rapportering',
          'E-postsupport',
        ],
        cta: 'Välj Tillväxt',
      },
      pro: {
        name: 'Pro',
        price: '399 kr',
        period: 'per månad',
        features: [
          'Allt i Tillväxt',
          'Teamåtkomst för flera användare',
          'Leadership Snapshot',
          'AI-rekommendationer för minskning',
          'Prioritetssupport',
        ],
        cta: 'Välj Pro',
        badge: 'Mest populär',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Kontakta oss',
        period: 'anpassad',
        features: [
          'Allt i Pro',
          'Flera enheter och platser',
          'Anpassad onboarding och support',
          'Dedikerad kundansvarig',
        ],
        cta: 'Kontakta oss',
      },
    },
  },

  contact: {
    heading: 'Gör koldioxidredovisning till en styrka, inte en börda.',
    sub: 'En tydlig bas och enkla nästa steg för riktiga europeiska företag.',
    ctaPrimary: 'Börja gratis idag',
    ctaEmail: 'Mejla oss',
    cardHeading: 'Föredrar du e-post?',
    cardDesc:
      'Dela din företagsstorlek och varför du utforskar koldioxidredovisning. Vi svarar med nästa steg.',
    cardEmailLabel: 'E-post:',
  },

  footer: {
    rights: 'Greenio. Alla rättigheter förbehållna.',
    madeIn: 'Tillverkad i Storbritannien',
    flag: '🇬🇧',
    privacy: 'Integritet',
    terms: 'Villkor',
  },

  testimonials: {
    heading: 'Förtroende från operations- och ekonomiteam i Europa.',
    subtext: 'Så här använder våra kunder Greenio idag.',
    tag: 'Tidiga kunder inom logistik, professionella tjänster och tech.',
  },

  switcher: {
    title: 'Välj ditt land',
  },
};
