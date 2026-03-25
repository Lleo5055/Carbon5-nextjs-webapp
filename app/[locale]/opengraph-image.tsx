// app/[locale]/opengraph-image.tsx
// OG image styled to match the homepage hero:
// dark slate-900→emerald-950 gradient, white text, emerald-400 accents.

import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { locale: string };
}

const LOCALE_META: Record<string, {
  flag: string;
  badge: string;
  headline: string;
  highlight: string;
  sub: string;
  stat1: string;
  stat2: string;
  compliance: string;
}> = {
  en: {
    flag: '🇬🇧', badge: 'Built for UK businesses',
    headline: 'Audit-ready carbon accounting',
    highlight: 'done in minutes.',
    sub: 'DEFRA-aligned reports, automatic CO₂e calculations and Leadership Snapshots.',
    stat1: 'No consultants needed', stat2: 'Free to start',
    compliance: 'SECR',
  },
  ie: {
    flag: '🇮🇪', badge: 'Built for Irish businesses',
    headline: 'Carbon accounting for Irish SMEs,',
    highlight: 'CSRD-ready.',
    sub: 'Automatic CO₂e calculations, audit-grade reports and compliance exports.',
    stat1: 'No consultants needed', stat2: 'Free to start',
    compliance: 'CSRD',
  },
  de: {
    flag: '🇩🇪', badge: 'Für deutsche Unternehmen',
    headline: 'CO₂-Bilanz für KMU,',
    highlight: 'in Minuten fertig.',
    sub: 'CSRD-konforme Berichte, automatische CO₂e-Berechnungen und Prüfexporte.',
    stat1: 'Keine Berater nötig', stat2: 'Kostenlos starten',
    compliance: 'CSRD',
  },
  fr: {
    flag: '🇫🇷', badge: 'Pour les entreprises françaises',
    headline: 'Bilan carbone pour PME,',
    highlight: 'en quelques minutes.',
    sub: 'Rapports conformes CSRD, calculs CO₂e automatiques et exports audit.',
    stat1: 'Sans consultant', stat2: 'Gratuit pour commencer',
    compliance: 'CSRD',
  },
  it: {
    flag: '🇮🇹', badge: 'Per le aziende italiane',
    headline: 'Contabilità carbonio per PMI,',
    highlight: 'pronta in minuti.',
    sub: 'Report conformi CSRD, calcoli CO₂e automatici ed esportazioni audit.',
    stat1: 'Senza consulenti', stat2: 'Gratis per iniziare',
    compliance: 'CSRD',
  },
  es: {
    flag: '🇪🇸', badge: 'Para empresas españolas',
    headline: 'Contabilidad de carbono para PYMEs,',
    highlight: 'lista en minutos.',
    sub: 'Informes conformes CSRD, cálculos CO₂e automáticos y exportaciones.',
    stat1: 'Sin consultores', stat2: 'Gratis para empezar',
    compliance: 'CSRD',
  },
  nl: {
    flag: '🇳🇱', badge: 'Voor Nederlandse bedrijven',
    headline: 'CO₂-boekhouding voor MKB,',
    highlight: 'klaar in minuten.',
    sub: 'CSRD-conforme rapporten, automatische CO₂e-berekeningen en audit-exports.',
    stat1: 'Geen consultants nodig', stat2: 'Gratis beginnen',
    compliance: 'CSRD',
  },
  pl: {
    flag: '🇵🇱', badge: 'Dla polskich firm',
    headline: 'Emisje CO₂ dla MŚP,',
    highlight: 'gotowe w minuty.',
    sub: 'Raporty zgodne z CSRD, automatyczne obliczenia CO₂e i eksporty audytu.',
    stat1: 'Bez konsultantów', stat2: 'Bezpłatny start',
    compliance: 'CSRD',
  },
  sv: {
    flag: '🇸🇪', badge: 'För svenska företag',
    headline: 'Koldioxidredovisning för SMF,',
    highlight: 'klar på minuter.',
    sub: 'CSRD-anpassade rapporter, automatiska CO₂e-beräkningar och revisionsexporter.',
    stat1: 'Inga konsulter behövs', stat2: 'Gratis att börja',
    compliance: 'CSRD',
  },
  da: {
    flag: '🇩🇰', badge: 'Til danske virksomheder',
    headline: 'CO₂-regnskab til SMV,',
    highlight: 'klar på minutter.',
    sub: 'CSRD-tilpassede rapporter, automatiske CO₂e-beregninger og revisionseksporter.',
    stat1: 'Ingen konsulenter', stat2: 'Gratis at starte',
    compliance: 'CSRD',
  },
  pt: {
    flag: '🇵🇹', badge: 'Para empresas portuguesas',
    headline: 'Contabilidade de carbono para PMEs,',
    highlight: 'pronta em minutos.',
    sub: 'Relatórios conformes CSRD, cálculos CO₂e automáticos e exportações auditoria.',
    stat1: 'Sem consultores', stat2: 'Gratuito para começar',
    compliance: 'CSRD',
  },
  in: {
    flag: '🇮🇳', badge: 'Built for Indian businesses',
    headline: 'Carbon accounting & BRSR reporting',
    highlight: 'for India.',
    sub: 'CEA/BEE emission factors, BRSR-ready ESG reports and CCTS compliance tools.',
    stat1: 'India-specific EF (CEA/BEE)', stat2: 'Free to start',
    compliance: 'BRSR',
  },
};

export default function Image({ params }: Props) {
  const m = LOCALE_META[params.locale] ?? LOCALE_META.en;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          // Match homepage: bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950
          background: 'linear-gradient(135deg, #0f172a 0%, #0f172a 55%, #052e16 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Grid texture — matches homepage */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          display: 'flex',
        }} />

        {/* Emerald glow blob — top right, matches homepage */}
        <div style={{
          position: 'absolute', top: -80, right: 180,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)',
          filter: 'blur(80px)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%', padding: '52px 64px',
          justifyContent: 'space-between',
        }}>

          {/* Top row: wordmark + compliance badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Wordmark — simple leaf + Greenio text, matches nav style */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #059669, #34d399)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M17 8C8 10 5.9 16.17 3.82 19.1c.95.83 2.14 1.4 3.48 1.4 3 0 6.5-2 7.5-6 .5-2-1-3-2-3s-2 1-2 2 1 2 2 2c2.67 0 4-1.67 4-5"
                    stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 34, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
                Greenio
              </span>
            </div>

            {/* Locale badge — matches hero badge style */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(52,211,153,0.3)',
              background: 'rgba(52,211,153,0.1)',
              borderRadius: 999, padding: '8px 18px',
            }}>
              <span style={{ fontSize: 20 }}>{m.flag}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {m.badge}
              </span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'flex' }} />
            </div>
          </div>

          {/* Main hero copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h1 style={{
              margin: 0, fontSize: 60, fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-1.5px', color: 'white',
            }}>
              {m.headline}{' '}
              <span style={{ color: '#34d399' }}>{m.highlight}</span>
            </h1>
            <p style={{
              margin: 0, fontSize: 20, lineHeight: 1.5,
              color: '#94a3b8', maxWidth: 760,
            }}>
              {m.sub}
            </p>
          </div>

          {/* Bottom row: stats + compliance tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Stats — match hero stat dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'flex' }} />
                <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>{m.stat1}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#475569', display: 'flex' }} />
                <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>{m.stat2}</span>
              </div>
            </div>

            {/* Compliance + domain */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(52,211,153,0.15)',
                border: '1px solid rgba(52,211,153,0.3)',
                borderRadius: 999, padding: '7px 16px',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'flex' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>{m.compliance}-ready</span>
              </div>
              <span style={{ fontSize: 16, color: '#475569', fontWeight: 600 }}>greenio.co</span>
            </div>
          </div>

        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}