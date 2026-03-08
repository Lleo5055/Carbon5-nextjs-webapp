// middleware.ts  (repo root)
//
// Feature 1.4 — Geo-IP redirect to greenio.co/in
//
// Detects Indian visitors via Vercel/Cloudflare IP-country headers and
// redirects them to the /in route automatically, unless:
//   - The request path already starts with /in
//   - The geo_override=manual cookie is set (user manually navigated away)
//
// Override cookie: set on any navigation FROM /in to / with max-age 1 year.
//
// DO NOT BUILD: this middleware never re-redirects a user who has the cookie,
// regardless of their IP.

import { NextRequest, NextResponse } from 'next/server';

const GEO_COOKIE = 'geo_override';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Paths that should never be redirected (auth, API, static)
const BYPASS_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon',
  '/login',
  '/signup',
  '/logout',
  '/auth/',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never redirect API routes, Next.js internals, or auth pages
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Override cookie: set when user navigates away from /in ─────────────────
  // If the referer is /in and the destination is not /in, plant the cookie.
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

  // ── Already on /in — nothing to do ─────────────────────────────────────────
  if (pathname.startsWith('/in')) {
    return NextResponse.next();
  }

  // ── Override cookie present — respect user choice ──────────────────────────
  if (request.cookies.get(GEO_COOKIE)?.value === 'manual') {
    return NextResponse.next();
  }

  // ── Country detection ──────────────────────────────────────────────────────
  // Vercel sets x-vercel-ip-country; Cloudflare sets cf-ipcountry.
  const country =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    null;

  if (country === 'IN') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/in' + (pathname === '/' ? '' : pathname);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
