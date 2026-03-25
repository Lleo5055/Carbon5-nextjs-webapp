import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/billing', '/onboarding', '/profile', '/organisation', '/login', '/logout', '/signup', '/auth/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
