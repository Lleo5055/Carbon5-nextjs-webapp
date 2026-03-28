interface Props {
  title: string;
  flag: string;
  country: string;
  regulation: string;
  levelLabel: string;
  readingTime?: string;
}

const REGULATION_THEME: Record<string, { gradient: string; badge: string }> = {
  BRSR: {
    gradient: 'from-indigo-950 via-indigo-900 to-blue-800',
    badge: 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30',
  },
  CCTS: {
    gradient: 'from-emerald-950 via-emerald-900 to-teal-800',
    badge: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30',
  },
  'BRSR, CCTS': {
    gradient: 'from-indigo-950 via-emerald-900 to-teal-800',
    badge: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30',
  },
  SECR: {
    gradient: 'from-slate-950 via-slate-900 to-blue-900',
    badge: 'bg-blue-500/30 text-blue-200 border border-blue-400/30',
  },
  CSRD: {
    gradient: 'from-blue-950 via-blue-900 to-indigo-900',
    badge: 'bg-blue-400/30 text-blue-200 border border-blue-400/30',
  },
  'GHG Protocol': {
    gradient: 'from-emerald-950 via-slate-900 to-emerald-900',
    badge: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30',
  },
};

const DEFAULT_THEME = {
  gradient: 'from-slate-950 via-slate-900 to-emerald-950',
  badge: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30',
};

export default function BlogCoverImage({
  title,
  flag,
  country,
  regulation,
  levelLabel,
  readingTime,
}: Props) {
  const theme = REGULATION_THEME[regulation] ?? DEFAULT_THEME;

  return (
    <div
      className={`relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} px-8 py-12 text-white shadow-xl`}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-80 w-80 rounded-full bg-white/5" />

      {/* Top row */}
      <div className="relative mb-6 flex flex-wrap items-center gap-2">
        <span className="text-3xl leading-none" aria-label={country}>
          {flag}
        </span>
        <span className="text-sm font-medium text-white/70">{country}</span>
        {regulation && (
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${theme.badge}`}>
            {regulation}
          </span>
        )}
        {levelLabel && (
          <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-white/80">
            {levelLabel}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="relative max-w-2xl text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
        {title}
      </h2>

      {/* Bottom row */}
      <div className="relative mt-6 flex items-center gap-4 text-sm text-white/60">
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          {readingTime ?? '5 min read'}
        </span>
        <span className="h-3.5 w-px bg-white/20" aria-hidden="true" />
        <span className="font-medium text-emerald-300">greenio.co</span>
      </div>
    </div>
  );
}