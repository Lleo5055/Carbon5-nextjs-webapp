import type { Translations } from './types';

// India locale -English language (English is an official language of India),
// with India-specific pricing (₹), regulatory context (BRSR/ESG/BEE),
// and emission factor (India grid: 0.820 kg CO₂e/kWh).
export const india: Translations = {
  lang: 'en',

  nav: {
    product: 'Product',
    howItWorks: 'How it works',
    pricing: 'Pricing',
    contact: 'Contact',
    login: 'Log in',
    getStarted: 'Get started free',
  },

  hero: {
    badge: 'Built for Indian MSMEs',
    headline: 'Audit-ready carbon accounting for Indian MSMEs,',
    headlineHighlight: 'done in minutes.',
    subtext: 'BRSR-aligned carbon accounts with audit-grade reports and Leadership Snapshots. No consultants, no complexity.',
    cta: 'Start free – no card needed',
    stat1: 'Designed for 1–250 employee Indian companies',
    stat2: 'First carbon account in under 30 minutes',
    efBadge: 'India grid: 0.820 kg CO₂e/kWh',
  },

  heroCard: {
    title: 'Current year emissions',
    subtitle: 'Carbon overview · India entity',
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
    sub: 'No sustainability team needed. Clear, credible carbon accounting for Indian operations, finance and compliance.',
    features: [
      {
        title: 'Simple by design',
        desc: 'No messy spreadsheets or confusing factors. Add usage or spend, choose a category, and let the platform calculate CO₂e using BEE-standard methods.',
      },
      {
        title: 'BRSR-ready outputs',
        desc: 'Generate clean carbon accounts and ESG summaries for boards, investors and customers. Perfect for tenders, BRSR compliance and net-zero goals.',
      },
      {
        title: 'Fair, transparent pricing',
        desc: 'Start free, upgrade when accounting becomes regular. No long contracts, no consultancy upsell.',
      },
    ],
  },

  howItWorks: {
    heading: 'How Greenio works',
    sub: 'From messy bills to a clean, audit-ready carbon account in three steps.',
    steps: [
      {
        title: 'Add your data',
        desc: 'Electricity, gas, fuel and refrigerants. No perfect data needed, estimates supported.',
      },
      {
        title: 'We calculate your footprint',
        desc: 'BEE-standard emission factors. Your carbon account by month, source and hotspot, instantly.',
      },
      {
        title: 'Download and act',
        desc: 'Export a board-ready report and target your highest-impact hotspots first.',
      },
    ],
    benefits: [
      '30 minutes to first carbon account',
      'BRSR & ESG-ready outputs',
      'Designed for non-specialists',
    ],
  },

  pricing: {
    heading: 'Simple, transparent pricing',
    sub: 'Start free. Upgrade when ready. No setup fees, no contracts.',
    note: 'All plans include access to the same clean, minimal dashboard.',
    cancelNote: 'Cancel or switch plans any time. No long-term contracts.',
    plans: {
      free: {
        name: 'Free',
        price: '₹0',
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
        price: '₹1,499',
        period: 'per month',
        features: [
          'Unlimited carbon accounts/reports',
          'CSV / XLS exports',
          'BRSR & ESG reporting',
          'Email support',
        ],
        cta: 'Choose Growth',
      },
      pro: {
        name: 'Pro',
        price: '₹3,499',
        period: 'per month',
        features: [
          'Everything in Growth',
          'Multi-user team access',
          'Leadership Snapshot',
          'CCTS compliance module',
          'Early AI reduction insights',
          'Priority support',
        ],
        cta: 'Choose Pro',
        badge: 'Most popular',
      },
      enterprise: {
        name: 'Enterprise',
        price: "Let's talk",
        period: 'custom',
        features: [
          'Everything in Pro',
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
    sub: 'A clear baseline and simple next steps, built for real Indian businesses.',
    ctaPrimary: 'Start free today',
    ctaEmail: 'Email us',
    cardHeading: 'Prefer email?',
    cardDesc:
      "Share a couple of lines about your company size and why you're exploring carbon accounting. We'll reply with next steps and, if helpful, a link for a short intro call.",
    cardEmailLabel: 'Email:',
  },

  footer: {
    rights: 'Greenio. All rights reserved.',
    madeIn: 'Made in India',
    flag: '🇮🇳',
    privacy: 'Privacy',
    terms: 'Terms',
  },

  testimonials: {
    heading: 'Trusted by Indian operations and finance teams.',
    subtext: "How Indian MSMEs are using Greenio today.",
    tag: 'Early customers from manufacturing, logistics and professional services.',
  },

  switcher: {
    title: 'Select your country',
  },
};
