import type { Translations } from './types';

export const da: Translations = {
  lang: 'da',

  nav: {
    product: 'Produkt',
    howItWorks: 'Sådan fungerer det',
    pricing: 'Priser',
    contact: 'Kontakt',
    login: 'Log ind',
    getStarted: 'Kom i gang gratis',
  },

  hero: {
    badge: "Bygget til europæiske SMV'er",
    headline: "Revisionsklart kulstofregnskab for SMV'er,",
    headlineHighlight: 'gjort på minutter.',
    subtext: 'CSRD-kompatible kulstofregnskaber med revisionsgodkendte rapporter og Leadership Snapshots. Uden konsulenter, uden kompleksitet.',
    cta: 'Kom i gang gratis – intet kort kræves',
    stat1: "Designet til SMV'er med 1–250 medarbejdere",
    stat2: 'Første kulstofregnskab på under 30 minutter',
    efBadge: 'DK elnet: 0,207 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Årets emissioner',
    subtitle: 'CO₂-oversigt · Europæisk enhed',
    badgeLabel: 'Live beta',
    totalCo2eLabel: 'Samlet CO₂e',
    totalCo2eChange: '–8,2% vs. sidste år',
    electricityLabel: 'El',
    electricityNote: 'Største kilde',
    reportsLabel: 'Rapporter',
    reportsNote: 'I år',
    trendLabel: 'Månedlig tendens',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Bestyrelsesrapport med ét klik',
    downloadSub: 'Eksportér en ren PDF med dine seneste data.',
    downloadBtn: 'Download PDF',
  },

  product: {
    heading: 'Bygget til rigtige virksomheder, ikke klimaeksperter.',
    sub: "Intet bæredygtighedsteam nødvendigt. Klart kulstofregnskab for drifts-, økonomi- og complianceteam.",
    features: [
      {
        title: 'Enkelt af design',
        desc: 'Ingen rodet regneark. Indtast forbrug, vælg en kategori, og lad platformen beregne CO₂e med europæiske standardmetoder.',
      },
      {
        title: 'CSRD-kompatible resultater',
        desc: 'Rene kulstofregnskaber til bestyrelser, investorer og kunder. Perfekt til udbud, overholdelse og netto-nulmål.',
      },
      {
        title: 'Fair, transparent prissætning',
        desc: 'Start gratis, opgrader når regnskabsføring bliver rutine. Ingen lange kontrakter, ingen konsulentopsalg.',
      },
    ],
  },

  howItWorks: {
    heading: 'Sådan fungerer Greenio',
    sub: 'Fra rodede regninger til et revisionsklart kulstofregnskab i tre trin.',
    steps: [
      {
        title: 'Tilføj dine data',
        desc: 'El, gas, brændstof og kølemidler. Ingen perfekte data kræves, estimater understøttes.',
      },
      {
        title: 'Vi beregner dit fodaftryk',
        desc: 'Europæiske emissionsfaktorer. Dit kulstofregnskab pr. måned, kilde og hotspot, øjeblikkeligt.',
      },
      {
        title: 'Download og handl',
        desc: 'Eksportér en PDF til din bestyrelse og adressér dine vigtigste emissionskilder.',
      },
    ],
    benefits: [
      '30 minutter til første kulstofregnskab',
      'CSRD-kompatible resultater',
      'Designet til ikke-specialister',
    ],
  },

  pricing: {
    heading: 'Enkel, transparent prissætning',
    sub: 'Start gratis. Opgrader når du er klar. Ingen gebyrer, ingen kontrakter.',
    note: 'Alle planer inkluderer adgang til det samme rene, minimalistiske dashboard.',
    cancelNote: 'Annullér eller skift plan til enhver tid. Ingen langsigtede kontrakter.',
    plans: {
      free: {
        name: 'Gratis',
        price: '0 kr.',
        period: 'pr. måned',
        features: [
          'Ubegrænset dataindtastning',
          '1 kulstofregnskab/rapport om året',
          'Kerneemissions-dashboard',
        ],
        cta: 'Start med Gratis',
      },
      growth: {
        name: 'Vækst',
        price: '109 kr.',
        period: 'pr. måned',
        features: [
          'Ubegrænsede kulstofregnskaber/rapporter',
          'Prioritetssupport',
          'CSV / XLS-eksporter',
        ],
        cta: 'Vælg Vækst',
        badge: 'Mest populær',
      },
      pro: {
        name: 'Pro',
        price: '259 kr.',
        period: 'pr. måned',
        features: [
          'Alt fra Vækst',
          'Teamadgang (flere brugere)',
          'Leadership Snapshot',
          'AI-anbefalinger til reduktion',
        ],
        cta: 'Vælg Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Lad os tale',
        period: 'tilpasset',
        features: [
          'Flere enheder og lokationer',
          'Tilpasset onboarding og support',
          'Dedikeret account manager',
        ],
        cta: 'Kontakt os',
      },
    },
  },

  contact: {
    heading: 'Gør kulstofregnskab til en styrke, ikke en byrde.',
    sub: 'Et klart udgangspunkt og enkle næste skridt for rigtige europæiske virksomheder.',
    ctaPrimary: 'Start gratis i dag',
    ctaEmail: 'Send os en mail',
    cardHeading: 'Foretrækker du e-mail?',
    cardDesc:
      'Del din virksomhedsstørrelse og hvorfor du undersøger kulstofregnskab. Vi svarer med næste skridt.',
    cardEmailLabel: 'E-mail:',
  },

  footer: {
    rights: 'Greenio. Alle rettigheder forbeholdes.',
    madeIn: 'Fremstillet i Det Forenede Kongerige',
    flag: '🇬🇧',
    privacy: 'Fortrolighed',
    terms: 'Vilkår',
  },

  testimonials: {
    heading: 'Tillid fra operations- og finansteam i Europa.',
    subtext: 'Sådan bruger vores kunder Greenio i dag.',
    tag: 'Tidlige kunder fra logistik, professionelle tjenester og tech.',
  },

  switcher: {
    title: 'Vælg dit land',
  },
};
