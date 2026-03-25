'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TestimonialsCarousel from '../TestimonialsCarousel';
import { getTranslations, SWITCHER_COUNTRIES } from '@/lib/locales/index';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  locale: string;
}

export default function LocaleHomePage({ locale }: Props) {
  const t = getTranslations(locale);
  const router = useRouter();
  const year = new Date().getFullYear();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenio.co';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Greenio',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${BASE_URL}/${locale}`,
    description: t.hero.subtext,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: locale === 'in' ? 'INR' : locale === 'en' ? 'GBP' : 'EUR',
    },
    provider: {
      '@type': 'Organization',
      name: 'Greenio',
      url: BASE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── COUNTRY SWITCHER MODAL ── */}
      {switcherOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSwitcherOpen(false)}
        >
          <div
            className="relative w-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900">{t.switcher.title}</p>
              <button
                onClick={() => setSwitcherOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SWITCHER_COUNTRIES.map(country => (
                <button
                  key={country.code}
                  onClick={() => { router.push('/' + country.locale); setSwitcherOpen(false); }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="text-base leading-none">{country.flag}</span>
                  <span>{country.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/logogreenio.svg" alt="Greenio" className="h-20 w-auto" />
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
            <a href="#product" className="transition-colors hover:text-slate-900">{t.nav.product}</a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900">{t.nav.howItWorks}</a>
            <a href={isLoggedIn ? '/billing' : '#pricing'} className="transition-colors hover:text-slate-900">{t.nav.pricing}</a>
            <a href="#contact" className="transition-colors hover:text-slate-900">{t.nav.contact}</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Change country"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
            <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:bg-emerald-500"
            >
              {t.nav.getStarted}
            </Link>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950">
          {/* subtle grid texture */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
          {/* glow blob */}
          <div className="pointer-events-none absolute -top-32 right-1/4 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />

          <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-28">

            {/* Hero copy */}
            <div className="max-w-2xl space-y-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                {t.hero.badge}
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </p>

              <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl">
                {t.hero.headline}{` `}
                <span className="text-emerald-400">{t.hero.headlineHighlight}</span>
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-slate-300">
                {t.hero.subtext}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/50 transition-all hover:-translate-y-0.5 hover:bg-emerald-400"
                >
                  {t.hero.cta}
                </Link>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300">
                  {t.hero.efBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{t.hero.stat1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span>{t.hero.stat2}</span>
                </div>
              </div>
            </div>

            {/* Hero dashboard card — dark themed */}
            <div className="w-full max-w-md shrink-0 lg:max-w-lg">
              <div className="relative rounded-2xl border border-white/10 bg-slate-800/80 p-5 shadow-[0_0_80px_rgba(16,185,129,0.12),0_32px_64px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-transform hover:-translate-y-1">
                <div className="mb-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{t.heroCard.title}</p>
                    <p className="text-xs text-slate-400">{t.heroCard.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                    {t.heroCard.badgeLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t.heroCard.totalCo2eLabel, val: '126.40 t', sub: t.heroCard.totalCo2eChange, subColor: 'text-emerald-400' },
                    { label: t.heroCard.electricityLabel, val: '54%', sub: t.heroCard.electricityNote, subColor: 'text-slate-400' },
                    { label: t.heroCard.reportsLabel, val: '4', sub: t.heroCard.reportsNote, subColor: 'text-slate-400' },
                  ].map((card, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-slate-700/50 p-3">
                      <p className="text-[10px] text-slate-400">{card.label}</p>
                      <p className="mt-1 text-sm font-bold text-white">{card.val}</p>
                      <p className={`mt-1 text-[10px] ${card.subColor}`}>{card.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/8 bg-slate-700/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">{t.heroCard.trendLabel}</p>
                    <span className="text-[10px] text-slate-500">{t.heroCard.trendUnit}</span>
                  </div>
                  <div className="mt-3 h-24 w-full">
                    <svg viewBox="0 0 100 40" className="h-full w-full">
                      <line x1="0" y1="35" x2="100" y2="35" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                      <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                      <line x1="0" y1="5"  x2="100" y2="5"  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                      {/* Gradient fill under line */}
                      <defs>
                        <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points="0,30 12,26 25,28 37,20 50,18 62,15 75,12 88,14 100,10 100,40 0,40"
                        fill="url(#heroChartFill)"
                      />
                      <polyline fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        points="0,30 12,26 25,28 37,20 50,18 62,15 75,12 88,14 100,10" />
                      {([[0,30],[12,26],[25,28],[37,20],[50,18],[62,15],[75,12],[88,14],[100,10]] as [number,number][]).map(([x,y],i) => (
                        <circle key={i} cx={x} cy={y} r={1.8} fill="#10b981" stroke="#1e293b" strokeWidth="1" />
                      ))}
                    </svg>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-slate-700/50 px-3 py-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">{t.heroCard.downloadTitle}</p>
                    <p className="text-[10px] text-slate-400">{t.heroCard.downloadSub}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                    {t.heroCard.downloadBtn}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ── */}
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {(locale === 'in' ? [
                { icon: 'layers',   text: 'Scope 1, 2 & 3 tracking' },
                { icon: 'shield',   text: 'GHG Protocol aligned' },
                { icon: 'badge',    text: 'BRSR & CCTS ready' },
                { icon: 'leaf',     text: 'CEA/BEE emission factors' },
                { icon: 'file-check', text: 'Audit-ready PDF reports' },
              ] : locale === 'en' ? [
                { icon: 'layers',   text: 'Scope 1, 2 & 3 tracking' },
                { icon: 'shield',   text: 'GHG Protocol aligned' },
                { icon: 'badge',    text: 'SECR ready' },
                { icon: 'leaf',     text: 'DEFRA emission factors' },
                { icon: 'file-check', text: 'Audit-ready PDF reports' },
              ] : [
                { icon: 'layers',   text: 'Scope 1, 2 & 3 tracking' },
                { icon: 'shield',   text: 'GHG Protocol aligned' },
                { icon: 'badge',    text: 'CSRD ready' },
                { icon: 'leaf',     text: 'EU emission factors' },
                { icon: 'file-check', text: 'Audit-ready PDF reports' },
              ]).map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {item.icon === 'layers'     && <><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>}
                    {item.icon === 'shield'     && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
                    {item.icon === 'badge'      && <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"/><path d="m9 12 2 2 4-4"/></>}
                    {item.icon === 'leaf'       && <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></>}
                    {item.icon === 'file-check' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></>}
                  </svg>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRODUCT / FEATURES — dark section ── */}
        <section id="product" className="bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">

            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">{t.product.heading}</p>
              {(() => {
                const [first, ...rest] = t.product.sub.split('. ');
                return (
                  <>
                    <p className="mb-1 text-lg font-medium text-slate-400">{first}.</p>
                    <h2 className="text-4xl font-bold text-white">{rest.join('. ')}</h2>
                  </>
                );
              })()}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {t.product.features.map((f, i) => (
                <div
                  key={i}
                  className="group rounded-2xl border border-white/8 bg-white/5 p-6 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5"
                >
                  <div className="mb-4 h-1 w-8 rounded-full bg-emerald-500 transition-all group-hover:w-12" />
                  <p className="mb-3 text-base font-semibold text-white">{f.title}</p>
                  <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">

            <div className="mb-14 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600">{t.howItWorks.heading}</p>
              <h2 className="text-4xl font-bold text-slate-900">{t.howItWorks.sub}</h2>
            </div>

            <div className="grid gap-12 md:grid-cols-3">
              {t.howItWorks.steps.map((step, i) => (
                <div key={i} className="flex flex-col">
                  <div className="mb-5 flex items-center gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-200">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-slate-600">{step.desc}</p>
                  {/* Step illustration */}
                  <div className="mt-auto overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
                    {i === 0 && (
                      <div className="space-y-3">
                        <div className="h-8 rounded-lg bg-white border border-slate-200 flex items-center px-3 gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-400" />
                          <div className="h-2 w-24 rounded bg-slate-200" />
                          <div className="ml-auto h-2 w-12 rounded bg-slate-100" />
                        </div>
                        {['Electricity', 'Diesel', 'Gas', 'Refrigerant'].map((label, j) => (
                          <div key={j} className="flex items-center gap-3 rounded-lg bg-white border border-slate-100 px-3 py-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[11px] text-slate-600">{label}</span>
                            <div className="ml-auto h-2 rounded bg-slate-100" style={{ width: `${[40,28,20,16][j]}px` }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {i === 1 && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {['Scope 1', 'Scope 2', 'Scope 3'].map((s, j) => (
                            <div key={j} className={`flex-1 rounded-lg p-2 text-center text-[10px] font-semibold ${j === 0 ? 'bg-orange-100 text-orange-700' : j === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {s}
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 p-3 h-20 flex items-end gap-1 px-4">
                          {[60,45,70,55,80,65,90].map((h, j) => (
                            <div key={j} className="flex-1 rounded-t-sm bg-emerald-400/60" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                        <div className="h-2 w-3/4 rounded bg-slate-200" />
                      </div>
                    )}
                    {i === 2 && (
                      <div className="space-y-3">
                        <div className="rounded-xl bg-white border border-slate-100 p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[8px] text-center leading-tight px-0.5">Emission Report</div>
                          <div className="space-y-1.5 flex-1">
                            <div className="h-2 w-28 rounded bg-slate-200" />
                            <div className="h-2 w-20 rounded bg-slate-100" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-semibold">Download</div>
                        </div>
                        {locale === 'in' && (
                          <div className="rounded-xl bg-white border border-slate-100 p-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[8px] text-center leading-tight px-0.5">CCTS Verify</div>
                            <div className="space-y-1.5 flex-1">
                              <div className="h-2 w-24 rounded bg-slate-200" />
                              <div className="h-2 w-16 rounded bg-slate-100" />
                            </div>
                            <div className="h-6 w-16 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white font-semibold">Download</div>
                          </div>
                        )}
                        <div className="rounded-xl bg-white border border-slate-100 p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-[8px] text-center leading-tight px-0.5">Snapshot</div>
                          <div className="space-y-1.5 flex-1">
                            <div className="h-2 w-24 rounded bg-slate-200" />
                            <div className="h-2 w-16 rounded bg-slate-100" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-purple-500 flex items-center justify-center text-[9px] text-white font-semibold">Download</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 border-t border-slate-100 pt-12">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {t.howItWorks.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        {i === 0 && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                        {i === 1 && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
                        {i === 2 && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
                      </svg>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-slate-700">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <TestimonialsCarousel
          heading={t.testimonials.heading}
          subtext={t.testimonials.subtext}
          tag={t.testimonials.tag}
          locale={locale}
        />

        {/* ── PRICING ── */}
        <section id="pricing" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">

            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600">{t.pricing.heading}</p>
              <h2 className="text-4xl font-bold text-slate-900">{t.pricing.sub}</h2>
              <p className="mt-3 text-sm text-slate-500">{t.pricing.note}</p>
            </div>

            <div className="grid gap-5 md:grid-cols-4">

              {/* Free */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.pricing.plans.free.name}</p>
                <div className="mt-4 mb-1">
                  <span className="text-4xl font-bold text-slate-900">{t.pricing.plans.free.price}</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">{t.pricing.plans.free.period}</p>
                <ul className="flex-1 space-y-3">
                  {t.pricing.plans.free.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={isLoggedIn ? '/billing' : '/signup'} className="mt-8 inline-flex w-full items-center justify-center rounded-full border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  {t.pricing.plans.free.cta}
                </Link>
              </div>

              {/* Growth */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.pricing.plans.growth.name}</p>
                <div className="mt-4 mb-1">
                  <span className="text-4xl font-bold text-slate-900">{t.pricing.plans.growth.price}</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">{t.pricing.plans.growth.period}</p>
                <ul className="flex-1 space-y-3">
                  {t.pricing.plans.growth.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={isLoggedIn ? '/billing' : '/signup'} className="mt-8 inline-flex w-full items-center justify-center rounded-full border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  {t.pricing.plans.growth.cta}
                </Link>
              </div>

              {/* Pro — highlighted */}
              <div className="relative flex flex-col rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-xl shadow-emerald-100">
                {t.pricing.plans.pro.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                    {t.pricing.plans.pro.badge}
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{t.pricing.plans.pro.name}</p>
                <div className="mt-4 mb-1">
                  <span className="text-4xl font-bold text-slate-900">{t.pricing.plans.pro.price}</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">{t.pricing.plans.pro.period}</p>
                <ul className="flex-1 space-y-3">
                  {t.pricing.plans.pro.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={isLoggedIn ? '/billing' : '/signup'} className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:bg-emerald-500">
                  {t.pricing.plans.pro.cta}
                </Link>
              </div>

              {/* Enterprise */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.pricing.plans.enterprise.name}</p>
                <div className="mt-4 mb-1">
                  <span className={`font-bold text-slate-900 ${t.pricing.plans.enterprise.price.length > 10 ? 'text-2xl' : 'text-4xl'}`}>{t.pricing.plans.enterprise.price}</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">{t.pricing.plans.enterprise.period}</p>
                <ul className="flex-1 space-y-3">
                  {t.pricing.plans.enterprise.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={isLoggedIn ? '/billing' : '#contact'} className="mt-8 inline-flex w-full items-center justify-center rounded-full border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  {t.pricing.plans.enterprise.cta}
                </Link>
              </div>

            </div>
            <p className="mt-5 text-center text-xs text-slate-400">{t.pricing.cancelNote}</p>
          </div>
        </section>

        {/* ── CONTACT / CTA BAND ── */}
        <section id="contact" className="bg-emerald-900">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="grid gap-10 md:grid-cols-[1.6fr,1fr] md:items-center">

              <div>
                <h2 className="text-4xl font-bold text-white">{t.contact.heading}</h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-emerald-200">{t.contact.sub}</p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-bold text-emerald-900 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
                  >
                    {t.contact.ctaPrimary}
                  </Link>
                  <a
                    href="mailto:hello@greenio.co"
                    className="inline-flex items-center justify-center rounded-full border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10"
                  >
                    {t.contact.ctaEmail}
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <p className="font-semibold text-white">{t.contact.cardHeading}</p>
                <p className="mt-3 text-sm leading-relaxed text-emerald-200">{t.contact.cardDesc}</p>
                <p className="mt-4 text-sm text-emerald-300">
                  {t.contact.cardEmailLabel}{' '}
                  <a href="mailto:hello@greenio.co" className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">
                    hello@greenio.co
                  </a>
                </p>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} {t.footer.rights}</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1">
              <span>{t.footer.madeIn}</span>
              <span>{t.footer.flag}</span>
            </span>
            <a href="/privacy" className="transition-colors hover:text-slate-300">{t.footer.privacy}</a>
            <a href="/terms" className="transition-colors hover:text-slate-300">{t.footer.terms}</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
