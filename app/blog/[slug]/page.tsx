import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import BlogCTA from '@/components/blog/BlogCTA';
import BlogCoverImage from '@/components/blog/BlogCoverImage';
import { H2, H3, H4 } from '@/components/blog/HeadingWithAnchor';
import {
  getBlogPost,
  getAllBlogSlugs,
  getRelatedBlogs,
  extractHeadings,
  extractFAQs,
} from '@/lib/blog/utils';

const BASE_URL = 'https://greenio.co';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: post.canonicalUrl ?? `${BASE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: post.canonicalUrl ?? `${BASE_URL}/blog/${post.slug}`,
      siteName: 'Greenio',
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.date,
      images: [{ url: post.ogImage ?? `${BASE_URL}/og-blog.png` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    robots: { index: true, follow: true },
  };
}

const mdxComponents = {
  BlogCTA,
  h2: H2,
  h3: H3,
  h4: H4,
};

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const related = getRelatedBlogs(post.slug, post.country, post.level);
  const headings = extractHeadings(post.content);
  const faqs = extractFAQs(post.content);

  const postUrl = `${BASE_URL}/blog/${post.slug}`;

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const blogPostingSchema = {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Organization',
      name: 'Greenio',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Greenio',
      logo: `${BASE_URL}/logo.png`,
    },
    datePublished: post.date,
    dateModified: post.date,
    image: post.ogImage ?? `${BASE_URL}/og-blog.png`,
    keywords: post.keywords,
    url: postUrl,
    mainEntityOfPage: postUrl,
    articleSection: post.country,
    inLanguage: post.locale,
  };

  const breadcrumbSchema = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  };

  const organizationSchema = {
    '@type': 'Organization',
    name: 'Greenio',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    sameAs: ['https://linkedin.com/company/greenio'],
  };

  const graphItems: object[] = [blogPostingSchema, breadcrumbSchema, organizationSchema];

  if (faqs.length > 0) {
    graphItems.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  const jsonLd = { '@context': 'https://schema.org', '@graph': graphItems };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
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
      <div className="border-b border-slate-100 bg-slate-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 text-xs text-slate-500" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1">
              <li><Link href="/" className="hover:text-slate-700">Home</Link></li>
              <li aria-hidden="true">›</li>
              <li><Link href="/blog" className="hover:text-slate-700">Blog</Link></li>
              <li aria-hidden="true">›</li>
              <li className="text-slate-700 font-medium line-clamp-1 max-w-xs">{post.title}</li>
            </ol>
          </nav>

          {/* Title */}
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {post.title}
          </h1>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span aria-hidden="true">{post.flag}</span>
              <span>{post.country}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {new Date(post.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {post.readingTime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{post.readingTime}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>By Greenio</span>
            {post.levelLabel && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {post.levelLabel}
              </span>
            )}
            {post.regulation && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {post.regulation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ── */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[220px_1fr_220px] lg:gap-8">

          {/* ── LEFT: TABLE OF CONTENTS ── */}
          {headings.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Contents
                </p>
                <nav>
                  <ul className="space-y-1">
                    {headings.map(h => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className={`block rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-emerald-700 ${
                            h.depth === 3 ? 'pl-4' : ''
                          }`}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </aside>
          )}

          {/* ── CENTER: BLOG CONTENT ── */}
          <article className="min-w-0">
            <BlogCoverImage
              title={post.title}
              flag={post.flag}
              country={post.country}
              regulation={post.regulation}
              levelLabel={post.levelLabel}
              readingTime={post.readingTime}
            />
            <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-emerald-700 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:text-sm prose-img:rounded-xl">
              <MDXRemote source={post.content} components={mdxComponents} />
            </div>

            {/* Tags */}
            {post.keywords && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <div className="flex flex-wrap gap-2">
                  {post.keywords
                    .split(',')
                    .map(k => k.trim())
                    .filter(Boolean)
                    .map(kw => (
                      <span
                        key={kw}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {kw}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Bottom related articles */}
            {related.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  Related Articles
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {related.slice(0, 3).map(r => (
                    <Link
                      key={r.slug}
                      href={`/blog/${r.slug}`}
                      className="group rounded-xl border border-slate-200 p-4 transition-all hover:border-emerald-200 hover:shadow-sm"
                    >
                      <span className="mb-1 block text-lg">{r.flag}</span>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 leading-snug">
                        {r.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{r.country}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* ── RIGHT: RELATED SIDEBAR ── */}
          {related.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Related Articles
                </p>
                <ul className="space-y-3">
                  {related.slice(0, 5).map(r => (
                    <li key={r.slug}>
                      <Link
                        href={`/blog/${r.slug}`}
                        className="group block rounded-xl border border-slate-100 p-3 transition-all hover:border-emerald-200 hover:bg-emerald-50"
                      >
                        <span className="mb-1 block text-lg">{r.flag}</span>
                        <p className="text-xs font-medium text-slate-700 group-hover:text-emerald-700 leading-snug line-clamp-3">
                          {r.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{r.country}</p>
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Sidebar CTA */}
                <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <p className="text-xs font-semibold text-emerald-900">
                    🌿 Start carbon accounting free
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Greenio automates {post.regulation || 'carbon'} compliance.
                  </p>
                  <Link
                    href="/signup?ref=blog-sidebar"
                    className="mt-3 block text-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500"
                  >
                    Start Free →
                  </Link>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Greenio. All rights reserved. ·{' '}
          <Link href="/blog" className="hover:text-slate-700">
            Back to Blog
          </Link>
        </div>
      </footer>
    </>
  );
}
