// lib/locales/types.ts
// Shared Translations type used by every locale file.

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  badge?: string;
}

export interface Translations {
  /** BCP 47 language tag for <html lang="..."> */
  lang: string;

  nav: {
    product: string;
    howItWorks: string;
    pricing: string;
    contact: string;
    login: string;
    getStarted: string;
  };

  hero: {
    badge: string;
    headline: string;
    headlineHighlight: string;
    subtext: string;
    cta: string;
    stat1: string;
    stat2: string;
    /** e.g. "UK grid: 0.213 kg CO₂e/kWh" */
    efBadge: string;
  };

  heroCard: {
    title: string;
    subtitle: string;
    badgeLabel: string;
    totalCo2eLabel: string;
    totalCo2eChange: string;
    electricityLabel: string;
    electricityNote: string;
    reportsLabel: string;
    reportsNote: string;
    trendLabel: string;
    trendUnit: string;
    downloadTitle: string;
    downloadSub: string;
    downloadBtn: string;
  };

  product: {
    heading: string;
    sub: string;
    features: [
      { title: string; desc: string },
      { title: string; desc: string },
      { title: string; desc: string },
    ];
  };

  howItWorks: {
    heading: string;
    sub: string;
    steps: [
      { title: string; desc: string },
      { title: string; desc: string },
      { title: string; desc: string },
    ];
    benefits: [string, string, string];
  };

  pricing: {
    heading: string;
    sub: string;
    note: string;
    cancelNote: string;
    plans: {
      free: PricingPlan;
      growth: PricingPlan;
      pro: PricingPlan;
      enterprise: PricingPlan;
    };
  };

  contact: {
    heading: string;
    sub: string;
    ctaPrimary: string;
    ctaEmail: string;
    cardHeading: string;
    cardDesc: string;
    cardEmailLabel: string;
  };

  footer: {
    rights: string;
    madeIn: string;
    flag: string;
    privacy: string;
    terms: string;
  };

  testimonials: {
    heading: string;
    subtext: string;
    tag: string;
  };

  switcher: {
    title: string;
  };
}
