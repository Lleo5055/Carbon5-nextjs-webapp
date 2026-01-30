// Suggestion: Move to components folder for better organization
'use client';

import React, { useState } from 'react';

type Testimonial = {
  name: string;
  role: string;
  company: string;
  quote: string;
  avatarUrl: string;
};

const testimonials: Testimonial[] = [
  {
    name: 'Mark Wilson',
    role: 'Operations Director',
    company: 'Northvale Logistics',
    quote:
      'We pulled together a credible footprint in a single afternoon. No one on my team is a sustainability expert, and that’s the point — the product isn’t built for experts.',
    avatarUrl:
      'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Emma Clarke',
    role: 'Finance Manager',
    company: 'BrightPath Services',
    quote:
      'The board just wants a clear number, a simple trend and what we should do next. Carbon Central gives me all three without adding a new project to my week.',
    avatarUrl:
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Tom Harris',
    role: 'Managing Director',
    company: 'HarrisTech',
    quote:
      'We used our first report in a tender the same week. It’s now part of the pack we share with larger customers asking about emissions and net-zero plans.',
    avatarUrl:
      'https://images.pexels.com/photos/2380794/pexels-photo-2380794.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Lucy Bennett',
    role: 'Office Manager',
    company: 'Greenline Transport',
    quote:
      'I can log utility and fuel data in minutes. The dashboard makes it obvious where our biggest hotspots are, without drowning us in jargon.',
    avatarUrl:
      'https://images.pexels.com/photos/3760853/pexels-photo-3760853.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'James Porter',
    role: 'CFO',
    company: 'Oakwood Retail Group',
    quote:
      'For a mid-sized UK business, Carbon Central hits the sweet spot — serious enough for investors, simple enough that we don’t need consultants to run it.',
    avatarUrl:
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
];

export default function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = testimonials.length;

  const goTo = (index: number) => {
    if (index < 0) {
      setActiveIndex(total - 1);
    } else if (index >= total) {
      setActiveIndex(0);
    } else {
      setActiveIndex(index);
    }
  };

  const active = testimonials[activeIndex];

  return (
    <section className="border-b border-slate-200 bg-slate-50/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Trusted by UK operations and finance teams.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700">
              Carbon Central fits into the real world of busy teams, not climate
              consultants. Here’s how customers are using it today.
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            Early customers from logistics, professional services and tech.
          </p>
        </div>

        <div className="relative mx-auto max-w-3xl">
          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.10)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-shrink-0">
                <img
                  src={active.avatarUrl}
                  alt={`Portrait of ${active.name}`}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-100"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {active.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {active.role}, {active.company}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-800">
              “{active.quote}”
            </p>
          </div>

          {/* Arrows */}
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm transition-all hover:-translate-x-7 hover:text-slate-900 sm:flex"
            aria-label="Previous testimonial"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm transition-all hover:translate-x-7 hover:text-slate-900 sm:flex"
            aria-label="Next testimonial"
          >
            ›
          </button>

          {/* Dots */}
          <div className="mt-4 flex justify-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex
                    ? 'w-6 bg-emerald-600'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
