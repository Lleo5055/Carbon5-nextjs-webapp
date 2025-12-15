// app/page.tsx 
import React from 'react';
import Link from 'next/link';
import TestimonialsCarousel from './TestimonialsCarousel';

export default function HomePage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* NAVBAR */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 ring-1 ring-emerald-300 shadow-sm">
              <span className="text-sm font-semibold text-emerald-700">CC</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Greenio
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-xs font-medium text-slate-600 sm:flex">
            <a href="#product" className="transition-colors hover:text-slate-900">
              Product
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-slate-900">
              Pricing
            </a>
            <a href="#contact" className="transition-colors hover:text-slate-900">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-block"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-200"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 via-white to-slate-50 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.05),_transparent_70%)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
            
            {/* HERO COPY */}
            <div className="max-w-xl space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-700 shadow-sm">
                Built for UK businesses
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
              </p>

              {/* UPDATED HEADLINE */}
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Audit-ready carbon accounting for UK SMEs,{` `}
                <span className="text-emerald-800">done in minutes.</span>
              </h1>     

              {/* UPDATED SUBTEXT */}
              <p className="max-w-lg text-sm leading-relaxed text-slate-700">
  Turn your emission data into DEFRA-aligned, SECR-ready carbon accounts
  with audit-grade reports and polished Leadership Snapshots in minutes.
</p>


              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-200"
                >
                  Start free – no card needed
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-[12px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Designed for 1–250 employee UK companies</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>First carbon account in under 30 minutes</span>
                </div>
              </div>
            </div>

            {/* HERO PREVIEW CARD — UNCHANGED */}
            <div className="w-full max-w-md lg:max-w-lg">
              <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-800">
                      Current year emissions
                    </p>
                    <p className="text-xs text-slate-500">
                      Carbon overview · UK entity
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Live beta
                  </span>
                </div>

                {/* Stats and chart unchanged */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Total CO₂e</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      126.40 t
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      –8.2% vs last year
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Electricity</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      54%
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Main hotspot
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Reports</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      4
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">This year</p>
                  </div>
                </div>

                {/* Trend by month */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-slate-600">
                      Trend by month
                    </p>
                    <span className="text-[10px] text-slate-600">tCO₂e</span>
                  </div>

                  <div className="mt-3 h-28 w-full">
                    <svg
                      viewBox="0 0 100 40"
                      className="h-full w-full text-emerald-700"
                    >
                      <line x1="0" y1="35" x2="100" y2="35" className="stroke-slate-200" strokeWidth="0.5" />
                      <line x1="0" y1="20" x2="100" y2="20" className="stroke-slate-200" strokeWidth="0.5" />
                      <line x1="0" y1="5" x2="100" y2="5" className="stroke-slate-200" strokeWidth="0.5" />

                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points="
                          0,30
                          12,26
                          25,28
                          37,20
                          50,18
                          62,15
                          75,12
                          88,14
                          100,10
                        "
                      />

                      {[
                        [0, 30],
                        [12, 26],
                        [25, 28],
                        [37, 20],
                        [50, 18],
                        [62, 15],
                        [75, 12],
                        [88, 14],
                        [100, 10]
                      ].map(([x, y], i) => (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={1.6}
                          className="fill-emerald-500 stroke-white"
                          strokeWidth="0.6"
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Jan</span>
                    <span>Apr</span>
                    <span>Jul</span>
                    <span>Oct</span>
                  </div>
                </div>

                {/* Download PDF card */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-slate-800">
                      One-click board report
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Export a clean PDF with your latest data.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
                    Download PDF
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT SECTION */}
        <section id="product" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">

              <div className="max-w-sm space-y-3">
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Built for real businesses, not climate PhDs.
                </h2>

                {/* UPDATED COPY */}
                <p className="text-sm leading-relaxed text-slate-700">
                  Most UK SMEs don&apos;t have a sustainability team.
                  Greenio gives you a clear, credible carbon account
                  with the minimum amount of noise — built for operations,
                  finance and compliance teams.
                </p>
              </div>

              <div className="grid flex-1 gap-4 md:grid-cols-3">
                
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-100/70 hover:shadow-md">
                  <p className="text-xs font-semibold text-emerald-700">
                    Simple by design
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-800">
                    No messy spreadsheets or confusing factors.
                    Add usage or spend, choose a category,
                    and let the platform calculate CO₂e with UK-standard methods.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-100/70 hover:shadow-md">
                  <p className="text-xs font-semibold text-emerald-700">
                    UK-ready outputs
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-800">
                    Generate clean carbon accounts and summaries
                    for boards, investors and customers.
                    Perfect for tenders, compliance and net-zero goals.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-100/70 hover:shadow-md">
                  <p className="text-xs font-semibold text-emerald-700">
                    Fair, transparent pricing
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-800">
                    Start free, upgrade when accounting becomes regular.
                    No long contracts, no consultancy upsell.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIAL CAROUSEL */}
        <TestimonialsCarousel />

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">

            <div className="mb-10 text-center">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                How Greenio works
              </h2>

              {/* UPDATED COPY */}
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-700">
                From messy bills to a clean, audit-ready carbon account —
                in three simple steps. Built for busy UK operations and finance teams.
              </p>
            </div>

            {/* STEPS */}
            <div className="grid gap-10 md:grid-cols-3 md:items-start">

              {/* STEP 1 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                    1
                  </span>
                  <p className="text-xs font-semibold text-slate-900">
                    Add your data
                  </p>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-slate-700">
                  Start with what you have — electricity, gas, fuel usage
                  and refrigerants. No perfect data needed; estimates supported.
                </p>

                {/* Illustration (unchanged) */}
                {/* STEP 1 illustration */}
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

              {/* STEP 2 */}
              <div className="relative flex flex-col items-center text-center md:items-start md:text-left">
                
                {/* arrows unchanged */}

                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                    2
                  </span>
                  <p className="text-xs font-semibold text-slate-900">
                    We calculate your footprint
                  </p>
                </div>

                {/* UPDATED COPY */}
                <p className="mb-4 text-xs leading-relaxed text-slate-700">
                  We apply UK-standard emission factors and build your carbon account
                  by month, source and hotspot — instantly and transparently.
                </p>

                {/* STEP 2 illustration */}
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

                    <polyline
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      points="96,74 112,68 128,66 144,58 162,52 172,46"
                    />

                    {[96, 112, 128, 144, 162, 172].map((x, index) => {
                      const ys = [74, 68, 66, 58, 52, 46];
                      return (
                        <circle
                          key={x}
                          cx={x}
                          cy={ys[index]}
                          r={3}
                          fill="#22c55e"
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                    3
                  </span>
                  <p className="text-xs font-semibold text-slate-900">
                    Download and act
                  </p>
                </div>

                {/* UPDATED COPY */}
                <p className="mb-4 text-xs leading-relaxed text-slate-700">
                  Export a clean, board-ready PDF and start targeting your highest-impact
                  hotspots first with simple, actionable insights.
                </p>

                {/* STEP 3 illustration */}
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

            {/* BENEFITS */}
            <div className="mt-12 flex flex-wrap justify-center gap-6 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>30 minutes to first carbon account</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>UK-ready outputs</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Designed for non-specialists</span>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">

            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Simple, transparent pricing
                </h2>

                {/* UPDATED COPY */}
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700">
                  Start free, upgrade only when your carbon accounting becomes routine.
                  No setup fees, no long contracts, no surprises.
                </p>
              </div>

              <p className="text-[11px] text-slate-500">
                All plans include access to the same clean, minimal dashboard.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              
              {/* FREE PLAN */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Free
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">£0</p>
                <p className="text-[11px] text-slate-500">per month</p>

                {/* UPDATED COPY */}
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  <li>Unlimited data entry</li>
                  <li>1 carbon account/report per year</li>
                  <li>Core emissions dashboard</li>
                </ul>

                <div className="mt-5">
                  <Link
                    href="/signup"
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400"
                  >
                    Start with Free
                  </Link>
                </div>
              </div>
              {/* GROWTH PLAN */}
              <div className="relative flex flex-col rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.25)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_38px_rgba(16,185,129,0.14)]">
                <span className="absolute -top-2 right-3 rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-semibold text-white">
                  Most popular
                </span>

                <p className="text-[11px] font-semibold text-emerald-800">
                  Growth
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">£9.99</p>
                <p className="text-[11px] text-slate-600">per month</p>

                {/* UPDATED COPY */}
                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  <li>Unlimited carbon accounts/reports</li>
                  <li>Priority support</li>
                  <li>CSV / XLS exports</li>
                </ul>

                <div className="mt-5">
                  <Link
                    href="/signup"
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-200"
                  >
                    Choose Growth
                  </Link>
                </div>
              </div>

              {/* PRO PLAN */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Pro
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">£24.99</p>
                <p className="text-[11px] text-slate-500">per month</p>

                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  <li>Everything in Growth</li>
                  <li>Team access (multi-user)</li>
                  <li>Leadership Snapshot</li>
                  <li>Early AI reduction insights</li>
                </ul>

                <div className="mt-5">
                  <Link
                    href="/signup"
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400"
                  >
                    Choose Pro
                  </Link>
                </div>
              </div>

              {/* ENTERPRISE PLAN */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Enterprise
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">Let&apos;s talk</p>
                <p className="text-[11px] text-slate-500">custom</p>

                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-800">
                  <li>Multiple entities &amp; locations</li>
                  <li>Custom onboarding &amp; support</li>
                  <li>Dedicated account manager</li>
                </ul>

                <div className="mt-5">
                  <a
                    href="#contact"
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400"
                  >
                    Talk to us
                  </a>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Cancel or switch plans any time. No long-term contracts.
            </p>
          </div>
        </section>

        {/* CONTACT CTA */}
        <section id="contact" className="border-t border-slate-200 bg-slate-50/80">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-8 md:grid-cols-[2fr,1.4fr] md:items-center">

              {/* LEFT SIDE */}
              <div>
                {/* UPDATED COPY */}
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Turn carbon accounting into a strength, not a burden.
                </h2>

                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700">
                  Whether you&apos;re just starting or tightening a net-zero commitment,
                  Greenio gives you a clear baseline and simple next steps —
                  built for real UK businesses.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-200"
                  >
                    Start free today
                  </Link>

                  <a
                    href="mailto:hello@carboncentral.app"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400"
                  >
                    Email us
                  </a>
                </div>
              </div>

              {/* RIGHT SIDE CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">Prefer email?</p>

                {/* UPDATED COPY */}
                <p className="mt-2 leading-relaxed">
                  Share a couple of lines about your company size and why you&apos;re
                  exploring carbon accounting. We&apos;ll reply with next steps and,
                  if helpful, a link for a short intro call.
                </p>

                <p className="mt-3 text-slate-600">
                  Email:{' '}
                  <a
                    href="mailto:hello@greenio.co"
                    className="font-medium underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
                  >
                    hello@greenio.co
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-[11px] text-slate-600 sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} Greenio. All rights reserved.</p>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span>Made in the UK</span>
              <span>🇬🇧</span>
            </span>

            <a href="#" className="transition-colors hover:text-slate-800">
              Privacy
            </a>

            <a href="#" className="transition-colors hover:text-slate-800">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
