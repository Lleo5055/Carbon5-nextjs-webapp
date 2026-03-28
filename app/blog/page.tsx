import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogMeta } from '@/lib/blog/utils';
import BlogListClient from './BlogListClient';

const BASE_URL = 'https://greenio.co';

export const metadata: Metadata = {
  title: 'Carbon Accounting Insights | Greenio Blog',
  description:
    'Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries. Free resources for carbon accounting, ESG reporting and net zero.',
  keywords:
    'carbon accounting blog, BRSR guide, CCTS explained, SECR reporting, CSRD compliance, ESG reporting guide',
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: 'Carbon Accounting Insights | Greenio Blog',
    description:
      'Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses across 14 countries.',
    url: `${BASE_URL}/blog`,
    siteName: 'Greenio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carbon Accounting Insights | Greenio Blog',
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
      name: 'Carbon Accounting Insights | Greenio Blog',
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
      <div className="border-b border-slate-100 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 text-xs text-slate-500" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1">
              <li><Link href="/" className="hover:text-slate-700">Home</Link></li>
              <li aria-hidden="true">›</li>
              <li className="text-slate-700 font-medium">Blog</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Carbon Accounting Insights
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Expert guides on BRSR, CCTS, SECR and CSRD compliance for businesses
            across 14 countries.
          </p>
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
