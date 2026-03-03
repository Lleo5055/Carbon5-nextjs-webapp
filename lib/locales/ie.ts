import type { Translations } from './types';

// Ireland locale — English language, EU regulatory context (CSRD),
// Euro pricing, and Ireland grid factor (0.301 kg CO₂e/kWh).
export const ie: Translations = {
  lang: 'en-IE',

  nav: {
    product: 'Product',
    howItWorks: 'How it works',
    pricing: 'Pricing',
    contact: 'Contact',
    login: 'Log in',
    getStarted: 'Get started free',
  },

  hero: {
    badge: 'Built for Irish businesses',
    headline: 'Audit-ready carbon accounting for Irish SMEs,',
    headlineHighlight: 'done in minutes.',
    subtext:
      'Turn your emission data into CSRD-aligned, GHG Protocol-ready carbon accounts with audit-grade reports and polished Leadership Snapshots in minutes.',
    cta: 'Start free – no card needed',
    stat1: 'Designed for 1–250 employee Irish companies',
    stat2: 'First carbon account in under 30 minutes',
    efBadge: 'Ireland grid: 0.301 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Current year emissions',
    subtitle: 'Carbon overview · Irish entity',
    badgeLabel: 'Live beta',
    totalCo2eLabel: 'Total CO₂e',
    totalCo2eChange: '–8.2% vs last year',
    electricityLabel: 'Electricity',
    electricityNote: 'Main hotspot',
    reportsLabel: 'Reports',
    reportsNote: 'This year',
    trendLabel: 'Trend by month',
    trendUnit: 'tCO₂e',
    downloadTitle: 'One-click board report',
    downloadSub: 'Export a clean PDF with your latest data.',
    downloadBtn: 'Download PDF',
  },

  product: {
    heading: 'Built for real businesses, not climate PhDs.',
    sub: "Most Irish SMEs don't have a sustainability team. Greenio gives you a clear, credible carbon account with the minimum amount of noise — built for operations, finance and compliance teams.",
    features: [
      {
        title: 'Simple by design',
        desc: 'No messy spreadsheets or confusing factors. Add usage or spend, choose a category, and let the platform calculate CO₂e with EU-standard methods.',
      },
      {
        title: 'CSRD-ready outputs',
        desc: 'Generate clean carbon accounts and summaries for boards, investors and customers. Perfect for tenders, CSRD compliance and net-zero goals.',
      },
      {
        title: 'Fair, transparent pricing',
        desc: 'Start free, upgrade when accounting becomes regular. No long contracts, no consultancy upsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'How Greenio works',
    sub: 'From messy bills to a clean, audit-ready carbon account — in three simple steps. Built for busy Irish operations and finance teams.',
    steps: [
      {
        title: 'Add your data',
        desc: 'Start with what you have — electricity, gas, fuel usage and refrigerants. No perfect data needed; estimates supported.',
      },
      {
        title: 'We calculate your footprint',
        desc: 'We apply EU-standard emission factors and build your carbon account by month, source and hotspot — instantly and transparently.',
      },
      {
        title: 'Download and act',
        desc: 'Export a clean, board-ready PDF and start targeting your highest-impact hotspots first with simple, actionable insights.',
      },
    ],
    benefits: [
      '30 minutes to first carbon account',
      'CSRD-ready outputs',
      'Designed for non-specialists',
    ],
  },

  pricing: {
    heading: 'Simple, transparent pricing',
    sub: 'Start free, upgrade only when your carbon accounting becomes routine. No setup fees, no long contracts, no surprises.',
    note: 'All plans include access to the same clean, minimal dashboard.',
    cancelNote: 'Cancel or switch plans any time. No long-term contracts.',
    plans: {
      free: {
        name: 'Free',
        price: '€0',
        period: 'per month',
        features: [
          'Unlimited data entry',
          '1 carbon account/report per year',
          'Core emissions dashboard',
        ],
        cta: 'Start with Free',
      },
      growth: {
        name: 'Growth',
        price: '€11.99',
        period: 'per month',
        features: [
          'Unlimited carbon accounts/reports',
          'Priority support',
          'CSV / XLS exports',
        ],
        cta: 'Choose Growth',
        badge: 'Most popular',
      },
      pro: {
        name: 'Pro',
        price: '€29.99',
        period: 'per month',
        features: [
          'Everything in Growth',
          'Team access (multi-user)',
          'Leadership Snapshot',
          'Early AI reduction insights',
        ],
        cta: 'Choose Pro',
      },
      enterprise: {
        name: 'Enterprise',
        price: "Let's talk",
        period: 'custom',
        features: [
          'Multiple entities & locations',
          'Custom onboarding & support',
          'Dedicated account manager',
        ],
        cta: 'Talk to us',
      },
    },
  },

  contact: {
    heading: 'Turn carbon accounting into a strength, not a burden.',
    sub: "Whether you're just starting or tightening a net-zero commitment, Greenio gives you a clear baseline and simple next steps — built for real Irish businesses.",
    ctaPrimary: 'Start free today',
    ctaEmail: 'Email us',
    cardHeading: 'Prefer email?',
    cardDesc:
      "Share a couple of lines about your company size and why you're exploring carbon accounting. We'll reply with next steps and, if helpful, a link for a short intro call.",
    cardEmailLabel: 'Email:',
  },

  footer: {
    rights: 'Greenio. All rights reserved.',
    madeIn: 'Made in the UK',
    flag: '🇮🇪',
    privacy: 'Privacy',
    terms: 'Terms',
  },

  testimonials: {
    heading: 'Trusted by Irish operations and finance teams.',
    subtext: "Greenio fits into the real world of busy Irish businesses — no sustainability expert needed. Here's how customers are using it today.",
    tag: 'Early customers from logistics, professional services and tech.',
  },

  switcher: {
    title: 'Select your country',
  },
};
