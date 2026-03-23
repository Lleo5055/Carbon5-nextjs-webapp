'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TestimonialsCarousel from '../TestimonialsCarousel';
import { getTranslations, SWITCHER_COUNTRIES } from '@/lib/locales/index';

interface Props {
  locale: string;
}

export default function LocaleHomePage({ locale }: Props) {
  const t = getTranslations(locale);
  const router = useRouter();
  const year = new Date().getFullYear();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ── COUNTRY SWITCHER MODAL ── */}
      {switcherOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
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
              >
                ✕
              </button>
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
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/logogreenio.svg" alt="Greenio" className="h-20 w-auto" />
          </div>

          <nav className="hidden items-center gap-8 text-xs font-medium text-slate-600 sm:flex">
            <a href="#product" className="transition-colors hover:text-slate-900">{t.nav.product}</a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900">{t.nav.howItWorks}</a>
            <a href="#pricing" className="transition-colors hover:text-slate-900">{t.nav.pricing}</a>
            <a href="#contact" className="transition-colors hover:text-slate-900">{t.nav.contact}</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Globe icon */}
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Change country"
              title="Change country"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>

            <Link
              href="/login"
              className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {t.nav.login}
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-200"
            >
              {t.nav.getStarted}
            </Link>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO ── */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 via-white to-slate-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">

            {/* Hero copy */}
            <div className="max-w-xl space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-700 shadow-sm">
                {t.hero.badge}
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
              </p>

              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                {t.hero.headline}{` `}
                <span className="text-emerald-800">{t.hero.headlineHighlight}</span>
              </h1>

              <p className="max-w-lg text-sm leading-relaxed text-slate-700">
                {t.hero.subtext}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-200"
                >
                  {t.hero.cta}
                </Link>
                {/* EF badge */}
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
                  {t.hero.efBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-[12px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{t.hero.stat1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{t.hero.stat2}</span>
                </div>
              </div>
            </div>

            {/* Hero preview card */}
            <div className="w-full max-w-md lg:max-w-lg">
              <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-800">{t.heroCard.title}</p>
                    <p className="text-xs text-slate-500">{t.heroCard.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    {t.heroCard.badgeLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">{t.heroCard.totalCo2eLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">126.40 t</p>
                    <p className="mt-1 text-[11px] text-emerald-700">{t.heroCard.totalCo2eChange}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">{t.heroCard.electricityLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">54%</p>
                    <p className="mt-1 text-[11px] text-slate-500">{t.heroCard.electricityNote}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">{t.heroCard.reportsLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">4</p>
                    <p className="mt-1 text-[11px] text-slate-500">{t.heroCard.reportsNote}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-slate-600">{t.heroCard.trendLabel}</p>
                    <span className="text-[10px] text-slate-600">{t.heroCard.trendUnit}</span>
                  </div>
                  <div className="mt-3 h-28 w-full">
                    <svg viewBox="0 0 100 40" className="h-full w-full text-emerald-700">
                      <line x1="0" y1="35" x2="100" y2="35" className="stroke-slate-200" strokeWidth="0.5" />
                      <line x1="0" y1="20" x2="100" y2="20" className="stroke-slate-200" strokeWidth="0.5" />
                      <line x1="0" y1="5"  x2="100" y2="5"  className="stroke-slate-200" strokeWidth="0.5" />
                      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                        points="0,30 12,26 25,28 37,20 50,18 62,15 75,12 88,14 100,10" />
                      {([[0,30],[12,26],[25,28],[37,20],[50,18],[62,15],[75,12],[88,14],[100,10]] as [number,number][]).map(([x,y],i) => (
                        <circle key={i} cx={x} cy={y} r={1.6} className="fill-emerald-500 stroke-white" strokeWidth="0.6" />
                      ))}
                    </svg>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-slate-800">{t.heroCard.downloadTitle}</p>
                    <p className="text-[10px] text-slate-500">{t.heroCard.downloadSub}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
                    {t.heroCard.downloadBtn}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRODUCT ── */}
        <section id="product" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">

              <div className="max-w-sm space-y-3">
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t.product.heading}</h2>
                <p className="text-sm leading-relaxed text-slate-700">{t.product.sub}</p>
              </div>

              <div className="grid flex-1 gap-4 md:grid-cols-3">
                {t.product.features.map((f, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-100/70 hover:shadow-md">
                    <p className="text-xs font-semibold text-emerald-700">{f.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-800">{f.desc}</p>
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
        />

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">

            <div className="mb-10 text-center">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t.howItWorks.heading}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-700">{t.howItWorks.sub}</p>
            </div>

            <div className="grid gap-10 md:grid-cols-3 md:items-start">

              {/* Step 1 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">1</span>
                  <p className="text-xs font-semibold text-slate-900">{t.howItWorks.steps[0].title}</p>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-700">{t.howItWorks.steps[0].desc}</p>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
                    <rect x="5" y="8" width="190" height="104" rx="12" fill="#ffffff" />
                    <rect x="12" y="20" width="72" height="80" rx="10" fill="#f1f5f9" />
                    <circle cx="48" cy="46" r="15" fill="#dcfce7" />
                    <rect x="47" y="40" width="2" height="10" rx="1" fill="#16a34a" />
                    <polygon points="48,36 43,42 53,42" fill="#16a34a" />
                    <rect x="28" y="70" width="40" height="6" rx="3" fill="#e2e8f0" />
                    <rect x="24" y="82" width="48" height="6" rx="3" fill="#e5e7eb" />
                    <rect x="92" y="20" width="96" height="80" rx="10" fill="#f8fafc" />
                    <rect x="100" y="26" width="80" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="100" y="42" width="50" height="8" rx="4" fill="#bfdbfe" />
                    <rect x="156" y="42" width="24" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="100" y="56" width="32" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="156" y="56" width="20" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="100" y="70" width="36" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="156" y="70" width="22" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="100" y="84" width="62" height="8" rx="4" fill="#e2e8f0" />
                    <rect x="156" y="84" width="18" height="8" rx="4" fill="#e2e8f0" />
                  </svg>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">2</span>
                  <p className="text-xs font-semibold text-slate-900">{t.howItWorks.steps[1].title}</p>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-700">{t.howItWorks.steps[1].desc}</p>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
                    <rect x="12" y="14" width="176" height="88" rx="12" fill="#ffffff" />
                    <rect x="22" y="24" width="156" height="68" rx="8" fill="#f8fafc" />
                    <line x1="86" y1="24" x2="86" y2="92" stroke="#e2e8f0" strokeWidth="1" />
                    <circle cx="58" cy="56" r="18" fill="#bbf7d0" />
                    <path d="M58 38 A18 18 0 0 1 73 64 L58 56 Z" fill="#22c55e" />
                    <rect x="42" y="76" width="32" height="6" rx="3" fill="#e2e8f0" />
                    <line x1="92" y1="80" x2="174" y2="80" stroke="#e2e8f0" strokeWidth="1" />
                    <line x1="92" y1="62" x2="174" y2="62" stroke="#e2e8f0" strokeWidth="1" />
                    <line x1="92" y1="44" x2="174" y2="44" stroke="#e2e8f0" strokeWidth="1" />
                    <polyline fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"
                      points="96,74 112,68 128,66 144,58 162,52 172,46" />
                    {[96,112,128,144,162,172].map((x,i) => (
                      <circle key={x} cx={x} cy={[74,68,66,58,52,46][i]} r={3} fill="#22c55e" stroke="#ffffff" strokeWidth={1} />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">3</span>
                  <p className="text-xs font-semibold text-slate-900">{t.howItWorks.steps[2].title}</p>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-700">{t.howItWorks.steps[2].desc}</p>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
                    <rect x="32" y="14" width="120" height="92" rx="10" fill="#ffffff" />
                    <rect x="44" y="22" width="80" height="10" rx="5" fill="#dbeafe" />
                    <circle cx="70" cy="54" r="18" fill="#bbf7d0" />
                    <path d="M70 36 A18 18 0 0 1 84 60 L70 54 Z" fill="#22c55e" />
                    <rect x="94" y="44" width="46" height="6" rx="3" fill="#e5e7eb" />
                    <rect x="94" y="56" width="52" height="6" rx="3" fill="#e5e7eb" />
                    <rect x="94" y="68" width="48" height="6" rx="3" fill="#e5e7eb" />
                    <rect x="94" y="80" width="40" height="6" rx="3" fill="#e5e7eb" />
                    <rect x="120" y="78" width="50" height="18" rx="9" fill="#22c55e" />
                    <rect x="122" y="80" width="46" height="14" rx="7" fill="#22c55e" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="mt-12 flex flex-wrap justify-center gap-6 text-[11px] text-slate-600">
              {t.howItWorks.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">

            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t.pricing.heading}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700">{t.pricing.sub}</p>
              </div>
              <p className="text-[11px] text-slate-500">{t.pricing.note}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">

              {/* Free */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">{t.pricing.plans.free.name}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{t.pricing.plans.free.price}</p>
                <p className="text-[11px] text-slate-500">{t.pricing.plans.free.period}</p>
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  {t.pricing.plans.free.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <div className="mt-5">
                  <Link href="/signup" className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400">
                    {t.pricing.plans.free.cta}
                  </Link>
                </div>
              </div>

              {/* Growth */}
              <div className="relative flex flex-col rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.25)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_38px_rgba(16,185,129,0.14)]">
                {t.pricing.plans.growth.badge && (
                  <span className="absolute -top-2 right-3 rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-semibold text-white">
                    {t.pricing.plans.growth.badge}
                  </span>
                )}
                <p className="text-[11px] font-semibold text-emerald-800">{t.pricing.plans.growth.name}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{t.pricing.plans.growth.price}</p>
                <p className="text-[11px] text-slate-600">{t.pricing.plans.growth.period}</p>
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  {t.pricing.plans.growth.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <div className="mt-5">
                  <Link href="/signup" className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-200">
                    {t.pricing.plans.growth.cta}
                  </Link>
                </div>
              </div>

              {/* Pro */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">{t.pricing.plans.pro.name}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{t.pricing.plans.pro.price}</p>
                <p className="text-[11px] text-slate-500">{t.pricing.plans.pro.period}</p>
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  {t.pricing.plans.pro.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <div className="mt-5">
                  <Link href="/signup" className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400">
                    {t.pricing.plans.pro.cta}
                  </Link>
                </div>
              </div>

              {/* Enterprise */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">{t.pricing.plans.enterprise.name}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{t.pricing.plans.enterprise.price}</p>
                <p className="text-[11px] text-slate-500">{t.pricing.plans.enterprise.period}</p>
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  {t.pricing.plans.enterprise.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <div className="mt-5">
                  <a href="#contact" className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400">
                    {t.pricing.plans.enterprise.cta}
                  </a>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">{t.pricing.cancelNote}</p>
          </div>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="border-t border-slate-200 bg-slate-50/80">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-8 md:grid-cols-[2fr,1.4fr] md:items-center">

              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t.contact.heading}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700">{t.contact.sub}</p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-200">
                    {t.contact.ctaPrimary}
                  </Link>
                  <a href="mailto:hello@greenio.co" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400">
                    {t.contact.ctaEmail}
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">{t.contact.cardHeading}</p>
                <p className="mt-2 leading-relaxed">{t.contact.cardDesc}</p>
                <p className="mt-3 text-slate-600">
                  {t.contact.cardEmailLabel}{' '}
                  <a href="mailto:hello@greenio.co" className="font-medium underline decoration-slate-400 underline-offset-2 hover:text-slate-900">
                    hello@greenio.co
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-[11px] text-slate-600 sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} {t.footer.rights}</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span>{t.footer.madeIn}</span>
              <span>{t.footer.flag}</span>
            </span>
            <a href="/privacy" className="transition-colors hover:text-slate-800">{t.footer.privacy}</a>
            <a href="/terms" className="transition-colors hover:text-slate-800">{t.footer.terms}</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
