import type { Translations } from './types';

export const de: Translations = {
  lang: 'de',

  nav: {
    product: 'Produkt',
    howItWorks: 'So funktioniert es',
    pricing: 'Preise',
    contact: 'Kontakt',
    login: 'Anmelden',
    getStarted: 'Kostenlos starten',
  },

  hero: {
    badge: 'Für europäische KMUs entwickelt',
    headline: 'Prüfungsreifes Carbon Accounting für KMUs,',
    headlineHighlight: 'in Minuten erledigt.',
    subtext: 'CSRD-konforme Klimabilanzen mit revisionssicheren Berichten und Leadership Snapshots. Ohne Berater, ohne Komplexität.',
    cta: 'Kostenlos starten – keine Karte nötig',
    stat1: 'Entwickelt für KMUs mit 1–250 Mitarbeitern',
    stat2: 'Erste Klimabilanz in unter 30 Minuten',
    efBadge: 'DE-Stromnetz: 0,366 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Emissionen des laufenden Jahres',
    subtitle: 'CO₂-Übersicht · EU-Unternehmen',
    badgeLabel: 'Live Beta',
    totalCo2eLabel: 'Gesamt CO₂e',
    totalCo2eChange: '–8,2 % vs. Vorjahr',
    electricityLabel: 'Strom',
    electricityNote: 'Hauptquelle',
    reportsLabel: 'Berichte',
    reportsNote: 'Dieses Jahr',
    trendLabel: 'Trend nach Monat',
    trendUnit: 'tCO₂e',
    downloadTitle: 'Bericht mit einem Klick',
    downloadSub: 'Sauberes PDF mit aktuellen Daten exportieren.',
    downloadBtn: 'PDF herunterladen',
  },

  product: {
    heading: 'Für echte Unternehmen gebaut, nicht für Klimaexperten.',
    sub: 'Kein Nachhaltigkeitsteam nötig. Klare, glaubwürdige Klimabilanz für Operations-, Finanz- und Compliance-Teams.',
    features: [
      {
        title: 'Einfach durch Design',
        desc: 'Keine unübersichtlichen Tabellen. Verbrauch eingeben, Kategorie wählen, CO₂e wird nach EU-Standard berechnet.',
      },
      {
        title: 'CSRD-konforme Ausgaben',
        desc: 'Saubere Klimabilanzen für Vorstände, Investoren und Kunden. Ideal für Ausschreibungen, Compliance und Netto-Null-Ziele.',
      },
      {
        title: 'Faire, transparente Preise',
        desc: 'Kostenlos starten, upgraden wenn das Accounting Routine wird. Keine langen Verträge, kein Berater-Upsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'So funktioniert Greenio',
    sub: 'Von unsortierten Rechnungen zur prüfungsreifen Klimabilanz in drei Schritten.',
    steps: [
      {
        title: 'Daten eingeben',
        desc: 'Strom, Gas, Kraftstoff und Kältemittel. Keine perfekten Daten nötig, Schätzungen akzeptiert.',
      },
      {
        title: 'Wir berechnen Ihren Fußabdruck',
        desc: 'EU-Emissionsfaktoren. Ihre Klimabilanz nach Monat, Quelle und Hotspot, sofort.',
      },
      {
        title: 'Herunterladen und handeln',
        desc: 'Vorstandstauglichen Bericht exportieren und wichtigste Emissionsquellen gezielt angehen.',
      },
    ],
    benefits: [
      '30 Minuten bis zur ersten Klimabilanz',
      'CSRD-konforme Ausgaben',
      'Designed für Nicht-Spezialisten',
    ],
  },

  pricing: {
    heading: 'Einfache, transparente Preise',
    sub: 'Kostenlos starten. Upgraden wenn bereit. Keine Einrichtungsgebühren, keine Verträge.',
    note: 'Alle Pläne bieten Zugang zum selben klaren, minimalen Dashboard.',
    cancelNote: 'Jederzeit kündigen oder den Plan wechseln. Keine Langzeitverträge.',
    plans: {
      free: {
        name: 'Free',
        price: '€0',
        period: 'pro Monat',
        features: [
          'Unbegrenzte Dateneingabe',
          '1 Klimabilanz/Bericht pro Jahr',
          'Kernemissions-Dashboard',
        ],
        cta: 'Mit Free starten',
      },
      growth: {
        name: 'Growth',
        price: '€14,99',
        period: 'pro Monat',
        features: [
          'Unbegrenzte Klimabilanzen/Berichte',
          'Prioritätssupport',
          'CSV / XLS Exporte',
        ],
        cta: 'Growth wählen',
        badge: 'Beliebteste Wahl',
      },
      pro: {
        name: 'Pro',
        price: '€34,99',
        period: 'pro Monat',
        features: [
          'Alles aus Growth',
          'Teamzugang (mehrere Nutzer)',
          'Leadership Snapshot',
          'KI-Reduktionsempfehlungen',
        ],
        cta: 'Pro wählen',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Sprechen wir',
        period: 'individuell',
        features: [
          'Mehrere Standorte & Einheiten',
          'Individuelles Onboarding & Support',
          'Dedicated Account Manager',
        ],
        cta: 'Kontakt aufnehmen',
      },
    },
  },

  contact: {
    heading: 'Machen Sie Carbon Accounting zur Stärke, nicht zur Last.',
    sub: 'Eine klare Ausgangsbasis und einfache nächste Schritte für echte Unternehmen.',
    ctaPrimary: 'Heute kostenlos starten',
    ctaEmail: 'E-Mail senden',
    cardHeading: 'Lieber per E-Mail?',
    cardDesc:
      'Beschreiben Sie kurz Ihre Unternehmensgröße und warum Sie Carbon Accounting erkunden. Wir antworten mit nächsten Schritten.',
    cardEmailLabel: 'E-Mail:',
  },

  footer: {
    rights: 'Greenio. Alle Rechte vorbehalten.',
    madeIn: 'Hergestellt im Vereinigten Königreich',
    flag: '🇬🇧',
    privacy: 'Datenschutz',
    terms: 'AGB',
  },

  testimonials: {
    heading: 'Vertrauen europäischer Operations- und Finanzteams.',
    subtext: 'Wie europäische Unternehmen Greenio heute nutzen.',
    tag: 'Frühe Kunden aus Logistik, Dienstleistungen und Technologie.',
  },

  switcher: {
    title: 'Land auswählen',
  },
};
