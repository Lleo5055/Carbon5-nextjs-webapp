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
    subtext:
      "Trasforma i tuoi dati sulle emissioni in bilanci di carbonio conformi alla CSRD e al GHG Protocol — con report di livello audit e Leadership Snapshot professionali.",
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
    sub: "La maggior parte delle PMI non ha un team di sostenibilità. Greenio ti fornisce un bilancio di carbonio chiaro e credibile senza complessità — per team operativi, finanziari e di compliance.",
    features: [
      {
        title: "Semplice per design",
        desc: "Niente fogli di calcolo complicati. Inserisci i consumi, scegli una categoria e lascia che la piattaforma calcoli il CO₂e con metodi standard europei.",
      },
      {
        title: "Output conformi CSRD",
        desc: "Genera bilanci di carbonio chiari per CDA, investitori e clienti. Perfetto per gare d'appalto, compliance e obiettivi net zero.",
      },
      {
        title: "Prezzi equi e trasparenti",
        desc: "Inizia gratis, passa al piano superiore quando la contabilità diventa regolare. Nessun contratto lungo, nessun upsell da consulente.",
      },
    ],
  },

  howItWorks: {
    heading: "Come funziona Greenio",
    sub: "Dalle bollette disordinate a un bilancio di carbonio pronto per l'audit — in tre semplici passi.",
    steps: [
      {
        title: "Inserisci i tuoi dati",
        desc: "Inizia con quello che hai — elettricità, gas, carburante e refrigeranti. Non servono dati perfetti; sono supportate anche le stime.",
      },
      {
        title: "Calcoliamo la tua impronta",
        desc: "Applichiamo i fattori di emissione europei e costruiamo il tuo bilancio per mese, fonte e hotspot — istantaneamente e in modo trasparente.",
      },
      {
        title: "Scarica e agisci",
        desc: "Esporta un PDF chiaro per il tuo CDA e inizia a puntare sulle principali fonti di emissione con raccomandazioni concrete.",
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
    sub: "Inizia gratis, passa al piano superiore solo quando la contabilità del carbonio diventa regolare. Nessun costo di setup, nessuna sorpresa.",
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
        price: "€11,99",
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
        price: "€29,99",
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
    sub: "Che tu stia iniziando o consolidando un impegno net zero, Greenio ti offre una base chiara e semplici passi successivi.",
    ctaPrimary: "Inizia gratis oggi",
    ctaEmail: "Scrivici",
    cardHeading: "Preferisci l'email?",
    cardDesc:
      "Condividi qualche riga sulla dimensione della tua azienda e perché stai esplorando la contabilità del carbonio. Risponderemo con i prossimi passi e, se utile, un link per una breve chiamata.",
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
    subtext: "Greenio si integra nella realtà quotidiana dei team impegnati — senza esperti di clima. Ecco come i nostri clienti lo usano oggi.",
    tag: "Primi clienti in logistica, servizi professionali e tech.",
  },

  switcher: {
    title: "Seleziona il tuo paese",
  },
};
