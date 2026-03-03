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
    subtext:
      'Omdann dine emissionsdata til CSRD-kompatible kulstofregnskaber — med revisionsgodkendte rapporter og professionelle Leadership Snapshots.',
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
    sub: "De fleste SMV'er har ikke et bæredygtighedsteam. Greenio giver dig et klart, troværdigt kulstofregnskab uden kompleksitet — til drifts-, økonomi- og complianceteam.",
    features: [
      {
        title: 'Enkelt af design',
        desc: 'Ingen rodet regneark. Indtast forbrug, vælg en kategori, og lad platformen beregne CO₂e med europæiske standardmetoder.',
      },
      {
        title: 'CSRD-kompatible resultater',
        desc: 'Generer rene kulstofregnskaber til bestyrelser, investorer og kunder. Perfekt til udbud, overholdelse og netto-nulmål.',
      },
      {
        title: 'Fair, transparent prissætning',
        desc: 'Start gratis, opgrader når regnskabsføring bliver rutine. Ingen lange kontrakter, ingen konsulentopsalg.',
      },
    ],
  },

  howItWorks: {
    heading: 'Sådan fungerer Greenio',
    sub: 'Fra rodede regninger til et revisionsklart kulstofregnskab — i tre enkle trin.',
    steps: [
      {
        title: 'Tilføj dine data',
        desc: 'Start med det, du har — elektricitet, gas, brændstof og kølemidler. Ingen perfekte data kræves; estimater understøttes.',
      },
      {
        title: 'Vi beregner dit fodaftryk',
        desc: 'Vi anvender europæiske emissionsfaktorer og bygger dit kulstofregnskab pr. måned, kilde og hotspot — øjeblikkeligt og gennemsigtigt.',
      },
      {
        title: 'Download og handl',
        desc: 'Eksportér en klar PDF til din bestyrelse og begynd at adressere dine vigtigste emissionskilder med konkrete anbefalinger.',
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
    sub: 'Start gratis, opgrader kun når kulstofregnskab bliver rutine. Ingen opsætningsgebyrer, ingen overraskelser.',
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
        price: '89 kr.',
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
        price: '219 kr.',
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
    sub: 'Uanset om du lige er startet eller strammer et netto-nulengagement, giver Greenio dig et klart udgangspunkt og enkle næste skridt.',
    ctaPrimary: 'Start gratis i dag',
    ctaEmail: 'Send os en mail',
    cardHeading: 'Foretrækker du e-mail?',
    cardDesc:
      'Del et par linjer om din virksomhedsstørrelse og hvorfor du undersøger kulstofregnskab. Vi svarer med næste skridt og, hvis det hjælper, et link til et kort introduktionsopkald.',
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
    subtext: 'Greenio passer ind i hverdagen for travle teams — uden klimakonsulenter. Sådan bruger vores kunder platformen i dag.',
    tag: 'Tidlige kunder fra logistik, professionelle tjenester og tech.',
  },

  switcher: {
    title: 'Vælg dit land',
  },
};
