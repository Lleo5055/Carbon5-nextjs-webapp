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
    subtext:
      'Wandeln Sie Ihre Emissionsdaten in CSRD-konforme, GHG-Protokoll-kompatible Klimabilanzen um — mit revisionssicheren Berichten und professionellen Leadership-Snapshots.',
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
    sub: 'Die meisten KMUs haben kein Nachhaltigkeitsteam. Greenio liefert Ihnen eine klare, glaubwürdige Klimabilanz ohne Komplexität — für Operations-, Finanz- und Compliance-Teams.',
    features: [
      {
        title: 'Einfach durch Design',
        desc: 'Keine unübersichtlichen Tabellen. Verbrauch oder Ausgaben eingeben, Kategorie wählen — die Plattform berechnet CO₂e nach EU-Standard.',
      },
      {
        title: 'CSRD-konforme Ausgaben',
        desc: 'Erstellen Sie saubere Klimabilanzen für Vorstände, Investoren und Kunden. Ideal für Ausschreibungen, Compliance und Netto-Null-Ziele.',
      },
      {
        title: 'Faire, transparente Preise',
        desc: 'Kostenlos starten, upgraden wenn das Accounting Routine wird. Keine langen Verträge, kein Berater-Upsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'So funktioniert Greenio',
    sub: 'Von unsortierten Rechnungen zu einer prüfungsreifen Klimabilanz — in drei einfachen Schritten.',
    steps: [
      {
        title: 'Daten eingeben',
        desc: 'Beginnen Sie mit dem, was Sie haben — Strom, Gas, Kraftstoff und Kältemittel. Keine perfekten Daten nötig; Schätzungen werden unterstützt.',
      },
      {
        title: 'Wir berechnen Ihren Fußabdruck',
        desc: 'Wir wenden EU-Standardemissionsfaktoren an und erstellen Ihre Klimabilanz nach Monat, Quelle und Hotspot — sofort und transparent.',
      },
      {
        title: 'Herunterladen und handeln',
        desc: 'Exportieren Sie ein klares, vorstandstaugliches PDF und beginnen Sie, Ihre wichtigsten Emissionsquellen mit umsetzbaren Empfehlungen anzugehen.',
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
    sub: 'Kostenlos starten, nur upgraden wenn Carbon Accounting Routine wird. Keine Einrichtungsgebühren, keine Überraschungen.',
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
        price: '€11,99',
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
        price: '€29,99',
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
    sub: 'Ob Sie gerade erst anfangen oder Ihre Netto-Null-Strategie verfeinern — Greenio gibt Ihnen eine klare Ausgangsbasis und einfache nächste Schritte.',
    ctaPrimary: 'Heute kostenlos starten',
    ctaEmail: 'E-Mail senden',
    cardHeading: 'Lieber per E-Mail?',
    cardDesc:
      'Beschreiben Sie kurz Ihre Unternehmensgröße und warum Sie Carbon Accounting erkunden. Wir antworten mit nächsten Schritten und, falls hilfreich, einem Link für ein kurzes Erstgespräch.',
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
    subtext: 'Greenio passt in den Arbeitsalltag beschäftigter Teams — kein Klimaberater nötig. So nutzen unsere Kunden die Plattform heute.',
    tag: 'Frühe Kunden aus Logistik, Dienstleistungen und Technologie.',
  },

  switcher: {
    title: 'Land auswählen',
  },
};
