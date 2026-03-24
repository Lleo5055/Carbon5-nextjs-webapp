import type { Translations } from './types';

export const fr: Translations = {
  lang: "fr",

  nav: {
    product: "Produit",
    howItWorks: "Comment ça marche",
    pricing: "Tarifs",
    contact: "Contact",
    login: "Se connecter",
    getStarted: "Commencer gratuitement",
  },

  hero: {
    badge: "Conçu pour les PME européennes",
    headline: "Comptabilité carbone prête à l'audit pour les PME,",
    headlineHighlight: "en quelques minutes.",
    subtext: "Bilans carbone conformes au BEGES et à la CSRD, avec rapports audit et Leadership Snapshots. Sans consultants, sans complexité.",
    cta: "Commencer gratuitement – sans carte",
    stat1: "Conçu pour les PME de 1 à 250 employés",
    stat2: "Premier bilan carbone en moins de 30 minutes",
    efBadge: "Réseau FR : 0,056 kg CO₂e/kWh",
  },

  heroCard: {
    title: "Émissions de l'année en cours",
    subtitle: "Bilan CO₂ · Entité européenne",
    badgeLabel: "Bêta live",
    totalCo2eLabel: "Total CO₂e",
    totalCo2eChange: "–8,2 % vs année précédente",
    electricityLabel: "Électricité",
    electricityNote: "Principal poste",
    reportsLabel: "Rapports",
    reportsNote: "Cette année",
    trendLabel: "Tendance mensuelle",
    trendUnit: "tCO₂e",
    downloadTitle: "Rapport board en un clic",
    downloadSub: "Exportez un PDF propre avec vos dernières données.",
    downloadBtn: "Télécharger le PDF",
  },

  product: {
    heading: "Conçu pour les vraies entreprises, pas pour les experts climat.",
    sub: "Pas d'équipe développement durable nécessaire. Comptabilité carbone claire pour opérations, finance et conformité.",
    features: [
      {
        title: "Simple par conception",
        desc: "Pas de tableurs complexes. Saisissez vos consommations, choisissez une catégorie, et la plateforme calcule le CO₂e selon les méthodes européennes.",
      },
      {
        title: "Sorties conformes CSRD",
        desc: "Bilans carbone propres pour vos conseils d'administration, investisseurs et clients. Idéal pour les appels d'offres et objectifs net zéro.",
      },
      {
        title: "Tarification juste et transparente",
        desc: "Démarrez gratuitement, passez à la formule supérieure quand la comptabilité devient régulière. Sans contrats longs ni upsell consultant.",
      },
    ],
  },

  howItWorks: {
    heading: "Comment fonctionne Greenio",
    sub: "De vos factures à un bilan carbone prêt à l'audit en trois étapes.",
    steps: [
      {
        title: "Saisissez vos données",
        desc: "Électricité, gaz, carburant et fluides frigorigènes. Pas de données parfaites nécessaires, les estimations sont acceptées.",
      },
      {
        title: "Nous calculons votre empreinte",
        desc: "Facteurs d'émission européens. Votre bilan par mois, source et poste clé, instantanément.",
      },
      {
        title: "Téléchargez et agissez",
        desc: "Exportez un PDF pour votre conseil d'administration et ciblez vos principales sources d'émissions.",
      },
    ],
    benefits: [
      "30 minutes pour le premier bilan carbone",
      "Sorties conformes CSRD & BEGES",
      "Conçu pour les non-spécialistes",
    ],
  },

  pricing: {
    heading: "Tarification simple et transparente",
    sub: "Démarrez gratuitement. Évoluez quand vous êtes prêt. Sans frais ni engagement.",
    note: "Tous les plans incluent l'accès au même tableau de bord épuré.",
    cancelNote: "Résiliez ou changez de plan à tout moment. Sans engagement long terme.",
    plans: {
      free: {
        name: "Gratuit",
        price: "€0",
        period: "par mois",
        features: [
          "Saisie de données illimitée",
          "1 bilan/rapport carbone par an",
          "Tableau de bord des émissions",
        ],
        cta: "Démarrer gratuitement",
      },
      growth: {
        name: "Croissance",
        price: "€14,99",
        period: "par mois",
        features: [
          "Bilans/rapports illimités",
          "Exports CSV / XLS",
          "Reporting CSRD",
          "Support par email",
        ],
        cta: "Choisir Croissance",
      },
      pro: {
        name: "Pro",
        price: "€34,99",
        period: "par mois",
        features: [
          "Tout de Croissance",
          "Accès équipe multi-utilisateur",
          "Leadership Snapshot",
          "Recommandations IA de réduction",
          "Support prioritaire",
        ],
        cta: "Choisir Pro",
        badge: "Plus populaire",
      },
      enterprise: {
        name: "Entreprise",
        price: "Parlons-en",
        period: "sur mesure",
        features: [
          "Tout du Pro",
          "Plusieurs entités & sites",
          "Onboarding & support personnalisés",
          "Chargé de compte dédié",
        ],
        cta: "Nous contacter",
      },
    },
  },

  contact: {
    heading: "Faites de la comptabilité carbone un atout, pas une contrainte.",
    sub: "Une base claire et des étapes simples pour les entreprises européennes.",
    ctaPrimary: "Démarrer gratuitement aujourd'hui",
    ctaEmail: "Nous écrire",
    cardHeading: "Vous préférez l'email ?",
    cardDesc:
      "Partagez quelques lignes sur votre entreprise et pourquoi vous explorez la comptabilité carbone. Nous répondrons avec les prochaines étapes.",
    cardEmailLabel: "Email :",
  },

  footer: {
    rights: "Greenio. Tous droits réservés.",
    madeIn: "Fabriqué au Royaume-Uni",
    flag: "🇬🇧",
    privacy: "Confidentialité",
    terms: "CGU",
  },

  testimonials: {
    heading: "La confiance des équipes opérations et finance en Europe.",
    subtext: "Comment nos clients utilisent Greenio aujourd'hui.",
    tag: "Premiers clients en logistique, services professionnels et tech.",
  },

  switcher: {
    title: "Choisir votre pays",
  },
};
