import Link from 'next/link';

interface BlogCTAProps {
  country: string;
  locale: string;
  regulation: string;
}

const CTA_COPY: Record<string, { headline: string; subtext: string }> = {
  BRSR: {
    headline: 'Automate your BRSR reporting with Greenio',
    subtext:
      "India's only platform for BRSR and CCTS compliance. Built for non-experts.",
  },
  CCTS: {
    headline: 'Ready to earn carbon credits under CCTS?',
    subtext:
      'Greenio tracks your emissions and generates CCTS-ready verification packages.',
  },
  SECR: {
    headline: 'Simplify your SECR reporting with Greenio',
    subtext:
      'Audit-grade carbon accounting for UK businesses. BEIS-aligned emission factors.',
  },
  CSRD: {
    headline: 'Get CSRD-ready with Greenio',
    subtext:
      'Automated Scope 1, 2 and 3 reporting for European businesses. Audit-grade accuracy.',
  },
  'GHG Protocol': {
    headline: 'Start your carbon accounting journey with Greenio',
    subtext:
      'GHG Protocol-aligned carbon accounting for businesses in 14 countries. Free to start.',
  },
};

export default function BlogCTA({ country, locale, regulation }: BlogCTAProps) {
  const copy = CTA_COPY[regulation] ?? CTA_COPY['GHG Protocol'];
  const signupHref = locale && locale !== 'en'
    ? `/signup?ref=blog&country=${encodeURIComponent(country)}`
    : '/signup?ref=blog';

  return (
    <div className="not-prose my-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🌿</span>
          <div>
            <p className="font-semibold text-emerald-900">{copy.headline}</p>
            <p className="mt-1 text-sm text-emerald-700">{copy.subtext}</p>
          </div>
        </div>
        <Link
          href={signupHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-500"
        >
          Start Free →
        </Link>
      </div>
    </div>
  );
}
