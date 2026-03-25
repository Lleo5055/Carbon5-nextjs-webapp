import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/lib/locales/index';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localePages = SUPPORTED_LOCALES.map(locale => ({
    url: `${BASE_URL}/${locale}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: locale === 'en' ? 1.0 : 0.9,
  }));

  const staticPages = [
    { url: `${BASE_URL}/privacy`,  priority: 0.3 },
    { url: `${BASE_URL}/terms`,    priority: 0.3 },
    { url: `${BASE_URL}/login`,    priority: 0.5 },
    { url: `${BASE_URL}/signup`,   priority: 0.8 },
  ].map(p => ({
    ...p,
    lastModified: now,
    changeFrequency: 'monthly' as const,
  }));

  return [...localePages, ...staticPages];
}
