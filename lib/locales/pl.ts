import type { Translations } from './types';

export const pl: Translations = {
  lang: 'pl',

  nav: {
    product: 'Produkt',
    howItWorks: 'Jak to działa',
    pricing: 'Cennik',
    contact: 'Kontakt',
    login: 'Zaloguj się',
    getStarted: 'Zacznij za darmo',
  },

  hero: {
    badge: 'Oprogramowanie do rachunkowości węglowej CSRD dla polskich MŚP',
    headline: 'Oprogramowanie do śladu węglowego dla polskich MŚP,',
    headlineHighlight: 'zgodne z CSRD w kilka minut.',
    subtext: 'Polskie wskaźniki emisji, raporty CSRD gotowe do audytu i Leadership Snapshot. Bez konsultantów, bez złożoności.',
    cta: 'Zacznij za darmo – bez karty',
    stat1: 'Zaprojektowane dla MŚP zatrudniających 1–250 pracowników',
    stat2: 'Pierwszy bilans węglowy w mniej niż 30 minut',
    efBadge: 'Sieć PL: 0,746 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Emisje bieżącego roku',
    subtitle: 'Przegląd CO₂ · Podmiot europejski',
    badgeLabel: 'Wersja beta na żywo',
    totalCo2eLabel: 'Łączne CO₂e',
    totalCo2eChange: '–8,2% r/r',
    electricityLabel: 'Elektryczność',
    electricityNote: 'Główne źródło',
    reportsLabel: 'Raporty',
    reportsNote: 'W tym roku',
    trendLabel: 'Trend miesięczny',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Raport zarządczy jednym kliknięciem',
    downloadSub: 'Eksportuj przejrzysty PDF z najnowszymi danymi.',
    downloadBtn: 'Pobierz PDF',
  },

  product: {
    heading: 'Stworzony dla prawdziwych firm, nie dla ekspertów klimatycznych.',
    sub: 'Bez potrzeby zespołu ds. zrównoważonego rozwoju. Jasna rachunkowość węglowa dla zespołów operacyjnych, finansowych i compliance.',
    features: [
      {
        title: 'Prosta w obsłudze',
        desc: 'Żadnych skomplikowanych arkuszy kalkulacyjnych. Wprowadź zużycie, wybierz kategorię, platforma obliczy CO₂e według europejskich standardów.',
      },
      {
        title: 'Wyniki zgodne z CSRD',
        desc: 'Przejrzyste bilanse węglowe dla zarządów, inwestorów i klientów. Idealne do przetargów, zgodności z przepisami i celów neutralności klimatycznej.',
      },
      {
        title: 'Uczciwe, przejrzyste ceny',
        desc: 'Zacznij za darmo, przejdź na wyższy plan gdy rozliczanie stanie się regularne. Bez długich umów i bez sprzedaży konsultingowej.',
      },
    ],
  },

  howItWorks: {
    heading: 'Jak działa Greenio',
    sub: 'Od nieuporządkowanych rachunków do gotowego do audytu bilansu węglowego w trzech krokach.',
    steps: [
      {
        title: 'Wprowadź swoje dane',
        desc: 'Prąd, gaz, paliwo i czynniki chłodnicze. Idealne dane nie są potrzebne, szacunki akceptowane.',
      },
      {
        title: 'Obliczamy Twój ślad węglowy',
        desc: 'Europejskie wskaźniki emisji. Twój bilans według miesiąca, źródła i hotspotu, natychmiast.',
      },
      {
        title: 'Pobierz i działaj',
        desc: 'Eksportuj PDF dla zarządu i zacznij adresować największe źródła emisji.',
      },
    ],
    benefits: [
      '30 minut do pierwszego bilansu węglowego',
      'Wyniki zgodne z CSRD',
      'Zaprojektowane dla niespecjalistów',
    ],
  },

  pricing: {
    heading: 'Proste, przejrzyste ceny',
    sub: 'Zacznij za darmo. Przejdź wyżej gdy będziesz gotowy. Bez opłat i umów.',
    note: 'Wszystkie plany obejmują dostęp do tego samego czystego, minimalistycznego pulpitu nawigacyjnego.',
    cancelNote: 'Anuluj lub zmień plan w dowolnym momencie. Bez długoterminowych umów.',
    plans: {
      free: {
        name: 'Darmowy',
        price: '€0',
        period: 'miesięcznie',
        features: [
          'Nieograniczone wprowadzanie danych',
          '1 bilans węglowy/raport rocznie',
          'Główny panel emisji',
        ],
        cta: 'Zacznij z Darmowym',
      },
      growth: {
        name: 'Wzrost',
        price: '€14,99',
        period: 'miesięcznie',
        features: [
          'Nieograniczone bilanse/raporty',
          'Eksporty CSV / XLS',
          'Raportowanie CSRD',
          'Wsparcie e-mail',
        ],
        cta: 'Wybierz Wzrost',
      },
      pro: {
        name: 'Pro',
        price: '€34,99',
        period: 'miesięcznie',
        features: [
          'Wszystko z Wzrostu',
          'Dostęp zespołowy dla wielu użytkowników',
          'Leadership Snapshot',
          'Rekomendacje AI do redukcji emisji',
          'Wsparcie priorytetowe',
        ],
        cta: 'Wybierz Pro',
        badge: 'Najpopularniejszy',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Kontakt',
        period: 'indywidualny',
        features: [
          'Wszystko z Pro',
          'Wiele podmiotów i lokalizacji',
          'Indywidualny onboarding i wsparcie',
          'Dedykowany opiekun konta',
        ],
        cta: 'Skontaktuj się',
      },
    },
  },

  contact: {
    heading: 'Zamień rachunkowość węglową w atut, nie w obciążenie.',
    sub: 'Jasna podstawa i proste kolejne kroki dla prawdziwych europejskich firm.',
    ctaPrimary: 'Zacznij za darmo dziś',
    ctaEmail: 'Napisz do nas',
    cardHeading: 'Wolisz e-mail?',
    cardDesc:
      'Napisz kilka słów o swojej firmie i dlaczego interesuje Cię rachunkowość węglowa. Odpowiemy z kolejnymi krokami.',
    cardEmailLabel: 'Email:',
  },

  footer: {
    rights: 'Greenio. Wszelkie prawa zastrzeżone.',
    madeIn: 'Wyprodukowane w Wielkiej Brytanii',
    flag: '🇬🇧',
    privacy: 'Prywatność',
    terms: 'Warunki',
  },

  testimonials: {
    heading: 'Zaufanie europejskich zespołów operacyjnych i finansowych.',
    subtext: 'Jak nasi klienci korzystają z Greenio dziś.',
    tag: 'Pierwsi klienci z logistyki, usług profesjonalnych i technologii.',
  },

  switcher: {
    title: 'Wybierz swój kraj',
  },
};
