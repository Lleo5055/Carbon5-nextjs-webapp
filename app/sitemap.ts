import type { MetadataRoute } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { SUPPORTED_LOCALES } from '@/lib/locales/index';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';

function getBlogEntries(): MetadataRoute.Sitemap {
  const blogDir = path.join(process.cwd(), 'content', 'blog');
  if (!fs.existsSync(blogDir)) return [];

  return fs
    .readdirSync(blogDir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => {
      const slug = f.replace(/\.mdx$/, '');
      const raw = fs.readFileSync(path.join(blogDir, f), 'utf-8');
      const { data } = matter(raw);
      return {
        url: `${BASE_URL}/blog/${slug}`,
        lastModified: data.date ? new Date(data.date as string) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      };
    });
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localePages = SUPPORTED_LOCALES.map(locale => ({
    url: `${BASE_URL}/${locale}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: locale === 'en' || locale === 'in' ? 1.0 : 0.9,
  }));

  const staticPages = [
    { url: `${BASE_URL}/privacy`,  priority: 0.3 },
    { url: `${BASE_URL}/terms`,    priority: 0.3 },
    { url: `${BASE_URL}/login`,    priority: 0.5 },
    { url: `${BASE_URL}/signup`,   priority: 0.8 },
    { url: `${BASE_URL}/blog`,     priority: 0.8 },
  ].map(p => ({
    ...p,
    lastModified: now,
    changeFrequency: 'monthly' as const,
  }));

  const blogPages = getBlogEntries();

  return [...localePages, ...staticPages, ...blogPages];
}
