// middleware.ts  (repo root)
//
// 1. Geo-IP redirect: Indian visitors → /in
// 2. Locale redirect: / → /{locale} based on Accept-Language header (server-side,
//    eliminates the client-side spinner on greenio.co homepage)

import { NextRequest, NextResponse } from 'next/server';

const GEO_COOKIE = 'geo_override';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Only these paths are eligible for geo/locale redirect (marketing homepage).
const GEO_REDIRECT_ELIGIBLE = ['/', '/en', '/ie', '/de', '/fr', '/it', '/es', '/nl', '/pl', '/sv', '/da', '/pt'];

/** BCP-47 primary tag → locale slug (mirrors lib/locales/index.ts) */
const LANG_TO_LOCALE: Record<string, string> = {
  en: 'en', 'en-GB': 'en', 'en-US': 'en', 'en-AU': 'en',
  'en-IE': 'ie',
  de: 'de', 'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  fr: 'fr', 'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr',
  it: 'it', 'it-IT': 'it',
  es: 'es', 'es-ES': 'es',
  nl: 'nl', 'nl-NL': 'nl', 'nl-BE': 'nl',
  pl: 'pl', 'pl-PL': 'pl',
  sv: 'sv', 'sv-SE': 'sv',
  da: 'da', 'da-DK': 'da',
  pt: 'pt', 'pt-PT': 'pt', 'pt-BR': 'pt',
  hi: 'in', 'hi-IN': 'in',
};

/** Parse Accept-Language header and return best matching locale slug. */
function detectLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'en';
  // Parse "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7" → [{ lang, q }] sorted by q desc
  const tags = acceptLanguage
    .split(',')
    .map((entry) => {
      const [tag, q] = entry.trim().split(';q=');
      return { tag: tag.trim(), q: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const locale = LANG_TO_LOCALE[tag] ?? LANG_TO_LOCALE[tag.split('-')[0]];
    if (locale) return locale;
  }
  return 'en';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only act on marketing homepage paths; all app/auth/API routes bypass
  const isEligible = GEO_REDIRECT_ELIGIBLE.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (!isEligible) {
    return NextResponse.next();
  }

  // ── Override cookie: set when user navigates away from /in ─────────────────
  const referer = request.headers.get('referer') ?? '';
  const comingFromIn = referer.includes('/in') && !pathname.startsWith('/in');
  if (comingFromIn) {
    const response = NextResponse.next();
    response.cookies.set(GEO_COOKIE, 'manual', {
      maxAge: ONE_YEAR_SECONDS,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  if (pathname.startsWith('/in')) return NextResponse.next();

  if (request.cookies.get(GEO_COOKIE)?.value === 'manual') return NextResponse.next();

  // ── Country detection (Geo-IP) ─────────────────────────────────────────────
  const country =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    null;

  if (country === 'IN') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/in' + (pathname === '/' ? '' : pathname);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  // ── Locale redirect: / → /{locale} (server-side, eliminates homepage spinner)
  if (pathname === '/') {
    const locale = detectLocaleFromHeader(request.headers.get('accept-language'));
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/' + locale;
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
