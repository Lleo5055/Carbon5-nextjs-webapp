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
    badge: 'Stworzone dla europejskich MŚP',
    headline: 'Gotowa do audytu rachunkowość węglowa dla MŚP,',
    headlineHighlight: 'gotowa w kilka minut.',
    subtext:
      'Przekształć dane emisyjne w rachunki węglowe zgodne z CSRD i GHG Protocol — z raportami na poziomie audytu i profesjonalnymi Leadership Snapshot.',
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
    sub: 'Większość MŚP nie ma zespołu ds. zrównoważonego rozwoju. Greenio zapewnia jasny, wiarygodny bilans węglowy bez zbędnej złożoności — dla zespołów operacyjnych, finansowych i compliance.',
    features: [
      {
        title: 'Prosta w obsłudze',
        desc: 'Żadnych skomplikowanych arkuszy kalkulacyjnych. Wprowadź zużycie, wybierz kategorię — platforma obliczy CO₂e według europejskich standardów.',
      },
      {
        title: 'Wyniki zgodne z CSRD',
        desc: 'Generuj przejrzyste bilanse węglowe dla zarządów, inwestorów i klientów. Idealne do przetargów, zgodności z przepisami i celów neutralności klimatycznej.',
      },
      {
        title: 'Uczciwe, przejrzyste ceny',
        desc: 'Zacznij za darmo, przejdź na wyższy plan gdy rozliczanie stanie się regularne. Bez długich umów i bez sprzedaży konsultingowej.',
      },
    ],
  },

  howItWorks: {
    heading: 'Jak działa Greenio',
    sub: 'Od nieuporządkowanych rachunków do gotowego do audytu bilansu węglowego — w trzech prostych krokach.',
    steps: [
      {
        title: 'Wprowadź swoje dane',
        desc: 'Zacznij od tego, co masz — prąd, gaz, paliwo i czynniki chłodnicze. Nie potrzebujesz idealnych danych; szacunki są akceptowane.',
      },
      {
        title: 'Obliczamy Twój ślad węglowy',
        desc: 'Stosujemy europejskie wskaźniki emisji i budujemy Twój bilans według miesiąca, źródła i hotspotu — natychmiast i przejrzyście.',
      },
      {
        title: 'Pobierz i działaj',
        desc: 'Eksportuj przejrzysty PDF dla zarządu i zacznij adresować największe źródła emisji za pomocą konkretnych rekomendacji.',
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
    sub: 'Zacznij za darmo, przejdź na wyższy plan tylko gdy rachunkowość węglowa stanie się rutyną. Bez opłat konfiguracyjnych, bez niespodzianek.',
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
        price: '€11,99',
        period: 'miesięcznie',
        features: [
          'Nieograniczone bilanse/raporty',
          'Wsparcie priorytetowe',
          'Eksporty CSV / XLS',
        ],
        cta: 'Wybierz Wzrost',
        badge: 'Najpopularniejszy',
      },
      pro: {
        name: 'Pro',
        price: '€29,99',
        period: 'miesięcznie',
        features: [
          'Wszystko z Wzrostu',
          'Dostęp zespołowy (wielu użytkowników)',
          'Leadership Snapshot',
          'Rekomendacje AI do redukcji emisji',
        ],
        cta: 'Wybierz Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Porozmawiajmy',
        period: 'indywidualny',
        features: [
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
    sub: 'Niezależnie od tego, czy dopiero zaczynasz, czy uszczegółowiasz zobowiązanie do neutralności klimatycznej, Greenio daje Ci jasną podstawę i proste kolejne kroki.',
    ctaPrimary: 'Zacznij za darmo dziś',
    ctaEmail: 'Napisz do nas',
    cardHeading: 'Wolisz e-mail?',
    cardDesc:
      'Napisz kilka słów o swojej firmie i dlaczego interesuje Cię rachunkowość węglowa. Odpowiemy z kolejnymi krokami i, jeśli pomocne, linkiem do krótkiej rozmowy.',
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
    subtext: 'Greenio wpisuje się w codzienną rzeczywistość zapracowanych zespołów — bez potrzeby ekspertów klimatycznych. Oto jak nasi klienci korzystają z platformy dziś.',
    tag: 'Pierwsi klienci z logistyki, usług profesjonalnych i technologii.',
  },

  switcher: {
    title: 'Wybierz swój kraj',
  },
};
