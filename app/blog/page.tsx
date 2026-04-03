import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogMeta } from '@/lib/blog/utils';
import BlogListClient from './BlogListClient';

const BASE_URL = 'https://greenio.co';

export const metadata: Metadata = {
  title: 'Carbon Accounting Guides & Resources | Greenio Blog',
  description:
    'Practical guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries. Free resources for carbon accounting, ESG reporting and net zero.',
  keywords:
    'carbon accounting blog, BRSR guide, CCTS explained, SECR reporting, CSRD compliance, ESG reporting guide',
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: 'Carbon Accounting Guides & Resources | Greenio Blog',
    description:
      'Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries.',
    url: `${BASE_URL}/blog`,
    siteName: 'Greenio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carbon Accounting Guides & Resources | Greenio Blog',
    description:
      'Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries.',
  },
  robots: { index: true, follow: true },
};

const collectionPageSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Carbon Accounting Guides & Resources | Greenio Blog',
      description:
        'Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries.',
      url: `${BASE_URL}/blog`,
      publisher: {
        '@type': 'Organization',
        name: 'Greenio',
        url: BASE_URL,
        logo: `${BASE_URL}/logo.png`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: BASE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: `${BASE_URL}/blog`,
        },
      ],
    },
  ],
};

export default function BlogPage() {
  const posts = getAllBlogMeta();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logogreenio.svg" alt="Greenio" className="h-20 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <Link href="/blog" className="text-emerald-600 font-semibold">Blog</Link>
            <Link href="/en" className="transition-colors hover:text-slate-900">Home</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-500"
            >
              Start Free →
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-emerald-400/5" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-white/[0.03]" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1">
              <li><Link href="/" className="text-white/80 hover:text-white transition-colors">Home</Link></li>
              <li aria-hidden="true" className="text-white/40">›</li>
              <li className="text-white/50">Blog</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: title + subtitle + regulation pills */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Greenio Blog
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Carbon Accounting<br className="hidden sm:block" /> Guides &amp; Resources
              </h1>
              <p className="mt-4 max-w-xl text-base text-white/60">
                Practical guides on GHG Protocol, SECR, CSRD, BRSR, CCTS, UK ETS, EU ETS and CBAM compliance for businesses across 14 countries.
              </p>
              {/* Regulation pills */}
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { label: 'GHG Protocol', color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/20' },
                  { label: 'SECR', color: 'bg-blue-500/20 text-blue-300 border border-blue-400/20' },
                  { label: 'CSRD', color: 'bg-sky-500/20 text-sky-300 border border-sky-400/20' },
                  { label: 'BRSR', color: 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/20' },
                  { label: 'CCTS', color: 'bg-teal-500/20 text-teal-300 border border-teal-400/20' },
                  { label: 'UK ETS', color: 'bg-violet-500/20 text-violet-300 border border-violet-400/20' },
                  { label: 'EU ETS', color: 'bg-purple-500/20 text-purple-300 border border-purple-400/20' },
                  { label: 'CBAM', color: 'bg-rose-500/20 text-rose-300 border border-rose-400/20' },
                ].map(({ label, color }) => (
                  <span key={label} className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: stat cluster */}
            <div className="flex shrink-0 flex-col gap-4 sm:items-end">
              {[
                { value: '8', label: 'Regulations covered' },
                { value: '14', label: 'Countries' },
              ].map(({ value, label }) => (
                <div key={label} className="text-right">
                  <p className="text-3xl font-bold text-white">{value}</p>
                  <p className="text-xs text-white/40">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOG LIST (client, handles filters + search + pagination) ── */}
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <BlogListClient posts={posts} />
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Greenio. All rights reserved.
        </div>
      </footer>
    </>
  );
}
