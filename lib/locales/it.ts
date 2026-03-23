import type { Translations } from './types';

export const it: Translations = {
  lang: "it",

  nav: {
    product: "Prodotto",
    howItWorks: "Come funziona",
    pricing: "Prezzi",
    contact: "Contatti",
    login: "Accedi",
    getStarted: "Inizia gratuitamente",
  },

  hero: {
    badge: "Pensato per le PMI europee",
    headline: "Contabilità carbonio pronta per l'audit per le PMI,",
    headlineHighlight: "in pochi minuti.",
    subtext: "Bilanci di carbonio conformi alla CSRD con report di audit e Leadership Snapshot. Senza consulenti, senza complessità.",
    cta: "Inizia gratis – nessuna carta richiesta",
    stat1: "Progettato per PMI da 1 a 250 dipendenti",
    stat2: "Primo bilancio di carbonio in meno di 30 minuti",
    efBadge: "Rete IT: 0,239 kg CO₂e/kWh",
  },

  heroCard: {
    title: "Emissioni anno corrente",
    subtitle: "Panoramica CO₂ · Entità europea",
    badgeLabel: "Beta live",
    totalCo2eLabel: "Totale CO₂e",
    totalCo2eChange: "–8,2% vs anno precedente",
    electricityLabel: "Elettricità",
    electricityNote: "Principale fonte",
    reportsLabel: "Report",
    reportsNote: "Quest'anno",
    trendLabel: "Andamento mensile",
    trendUnit: "tCO₂e",
    downloadTitle: "Report per il CDA in un clic",
    downloadSub: "Esporta un PDF chiaro con i tuoi ultimi dati.",
    downloadBtn: "Scarica PDF",
  },

  product: {
    heading: "Costruito per le vere imprese, non per gli esperti di clima.",
    sub: "Nessun team di sostenibilità necessario. Contabilità carbonio chiara per team operativi, finanziari e di compliance.",
    features: [
      {
        title: "Semplice per design",
        desc: "Niente fogli di calcolo complicati. Inserisci i consumi, scegli una categoria e lascia che la piattaforma calcoli il CO₂e con metodi standard europei.",
      },
      {
        title: "Output conformi CSRD",
        desc: "Bilanci di carbonio chiari per CDA, investitori e clienti. Perfetto per gare d'appalto, compliance e obiettivi net zero.",
      },
      {
        title: "Prezzi equi e trasparenti",
        desc: "Inizia gratis, passa al piano superiore quando la contabilità diventa regolare. Nessun contratto lungo, nessun upsell da consulente.",
      },
    ],
  },

  howItWorks: {
    heading: "Come funziona Greenio",
    sub: "Dalle bollette al bilancio carbonio pronto per l'audit in tre passi.",
    steps: [
      {
        title: "Inserisci i tuoi dati",
        desc: "Elettricità, gas, carburante e refrigeranti. Dati perfetti non necessari, le stime sono accettate.",
      },
      {
        title: "Calcoliamo la tua impronta",
        desc: "Fattori di emissione europei. Il tuo bilancio per mese, fonte e hotspot, istantaneamente.",
      },
      {
        title: "Scarica e agisci",
        desc: "Esporta un PDF per il tuo CDA e punta sulle principali fonti di emissione.",
      },
    ],
    benefits: [
      "30 minuti per il primo bilancio di carbonio",
      "Output conformi CSRD",
      "Progettato per i non specialisti",
    ],
  },

  pricing: {
    heading: "Prezzi semplici e trasparenti",
    sub: "Inizia gratis. Passa al piano superiore quando sei pronto. Nessuna tariffa, nessun contratto.",
    note: "Tutti i piani includono accesso allo stesso dashboard pulito e minimalista.",
    cancelNote: "Disdici o cambia piano in qualsiasi momento. Nessun contratto a lungo termine.",
    plans: {
      free: {
        name: "Gratuito",
        price: "€0",
        period: "al mese",
        features: [
          "Inserimento dati illimitato",
          "1 bilancio/report per anno",
          "Dashboard emissioni principale",
        ],
        cta: "Inizia con il Gratuito",
      },
      growth: {
        name: "Crescita",
        price: "€14,99",
        period: "al mese",
        features: [
          "Bilanci/report illimitati",
          "Supporto prioritario",
          "Esportazioni CSV / XLS",
        ],
        cta: "Scegli Crescita",
        badge: "Più popolare",
      },
      pro: {
        name: "Pro",
        price: "€34,99",
        period: "al mese",
        features: [
          "Tutto di Crescita",
          "Accesso team (multi-utente)",
          "Leadership Snapshot",
          "Raccomandazioni AI di riduzione",
        ],
        cta: "Scegli Pro",
      },
      enterprise: {
        name: "Enterprise",
        price: "Parliamone",
        period: "personalizzato",
        features: [
          "Più entità e sedi",
          "Onboarding e supporto personalizzati",
          "Account manager dedicato",
        ],
        cta: "Contattaci",
      },
    },
  },

  contact: {
    heading: "Trasforma la contabilità del carbonio in un punto di forza.",
    sub: "Una base chiara e semplici passi successivi per le imprese europee.",
    ctaPrimary: "Inizia gratis oggi",
    ctaEmail: "Scrivici",
    cardHeading: "Preferisci l'email?",
    cardDesc:
      "Condividi la dimensione della tua azienda e perché esplori la contabilità del carbonio. Risponderemo con i prossimi passi.",
    cardEmailLabel: "Email:",
  },

  footer: {
    rights: "Greenio. Tutti i diritti riservati.",
    madeIn: "Prodotto nel Regno Unito",
    flag: "🇬🇧",
    privacy: "Privacy",
    terms: "Termini",
  },

  testimonials: {
    heading: "La fiducia dei team operativi e finanziari in Europa.",
    subtext: "Come i nostri clienti usano Greenio oggi.",
    tag: "Primi clienti in logistica, servizi professionali e tech.",
  },

  switcher: {
    title: "Seleziona il tuo paese",
  },
};
