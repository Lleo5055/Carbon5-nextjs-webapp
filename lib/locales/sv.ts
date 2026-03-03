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
    subtext:
      'Omvandla dina utsläppsdata till CSRD-kompatibla koldioxidkonton — med revisionsklara rapporter och professionella Leadership Snapshots.',
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
    sub: 'De flesta SMF saknar ett hållbarhetsteam. Greenio ger dig ett tydligt, trovärdigt koldioxidkonto utan onödig komplexitet — för drift-, ekonomi- och complianceteam.',
    features: [
      {
        title: 'Enkelt av design',
        desc: 'Inga krångliga kalkylblad. Ange förbrukning, välj kategori och låt plattformen beräkna CO₂e med europeiska standardmetoder.',
      },
      {
        title: 'CSRD-kompatibla resultat',
        desc: 'Generera rena koldioxidkonton för styrelser, investerare och kunder. Perfekt för upphandlingar, regelefterlevnad och netto-nollmål.',
      },
      {
        title: 'Rättvis, transparent prissättning',
        desc: 'Börja gratis, uppgradera när redovisningen blir rutinmässig. Inga långa kontrakt, inget konsultupselling.',
      },
    ],
  },

  howItWorks: {
    heading: 'Hur Greenio fungerar',
    sub: 'Från röriga räkningar till ett revisionsklart koldioxidkonto — i tre enkla steg.',
    steps: [
      {
        title: 'Lägg till dina data',
        desc: 'Börja med vad du har — el, gas, bränsle och köldmedier. Inga perfekta data krävs; uppskattningar stöds.',
      },
      {
        title: 'Vi beräknar ditt fotavtryck',
        desc: 'Vi tillämpar europeiska emissionsfaktorer och bygger ditt koldioxidkonto per månad, källa och hotspot — direkt och transparent.',
      },
      {
        title: 'Ladda ner och agera',
        desc: 'Exportera en tydlig PDF till din styrelse och börja adressera dina viktigaste utsläppskällor med konkreta rekommendationer.',
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
    sub: 'Börja gratis, uppgradera bara när koldioxidredovisningen blir rutin. Inga installationsavgifter, inga överraskningar.',
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
        price: '109 kr',
        period: 'per månad',
        features: [
          'Obegränsade koldioxidkonton/rapporter',
          'Prioritetssupport',
          'CSV / XLS-exporter',
        ],
        cta: 'Välj Tillväxt',
        badge: 'Mest populär',
      },
      pro: {
        name: 'Pro',
        price: '269 kr',
        period: 'per månad',
        features: [
          'Allt i Tillväxt',
          'Teamåtkomst (flera användare)',
          'Leadership Snapshot',
          'AI-rekommendationer för minskning',
        ],
        cta: 'Välj Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Låt oss prata',
        period: 'anpassad',
        features: [
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
    sub: 'Oavsett om du precis börjar eller förfinar ett netto-nollåtagande, ger Greenio dig en tydlig bas och enkla nästa steg.',
    ctaPrimary: 'Börja gratis idag',
    ctaEmail: 'Mejla oss',
    cardHeading: 'Föredrar du e-post?',
    cardDesc:
      'Dela några rader om din företagsstorlek och varför du utforskar koldioxidredovisning. Vi svarar med nästa steg och, om det är till hjälp, en länk för ett kort inledande samtal.',
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
    subtext: 'Greenio passar in i vardagen för välbefolkade team — utan klimatexperter. Så här använder våra kunder plattformen idag.',
    tag: 'Tidiga kunder inom logistik, professionella tjänster och tech.',
  },

  switcher: {
    title: 'Välj ditt land',
  },
};
