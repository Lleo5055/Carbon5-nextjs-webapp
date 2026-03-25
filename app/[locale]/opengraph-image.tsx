// app/[locale]/opengraph-image.tsx
// OG image styled to match the homepage hero.
// No emoji flags (require emoji font), no CSS filter (Satori unsupported).

import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { locale: string };
}

const LOCALE_META: Record<string, {
  badge: string;
  headline: string;
  highlight: string;
  sub: string;
  stat1: string;
  stat2: string;
  compliance: string;
}> = {
  en: {
    badge: 'Built for UK businesses',
    headline: 'Audit-ready carbon accounting',
    highlight: 'done in minutes.',
    sub: 'DEFRA-aligned reports, automatic CO2e calculations and Leadership Snapshots.',
    stat1: 'No consultants needed', stat2: 'Free to start',
    compliance: 'SECR',
  },
  ie: {
    badge: 'Built for Irish businesses',
    headline: 'Carbon accounting for Irish SMEs,',
    highlight: 'CSRD-ready.',
    sub: 'Automatic CO2e calculations, audit-grade reports and compliance exports.',
    stat1: 'No consultants needed', stat2: 'Free to start',
    compliance: 'CSRD',
  },
  de: {
    badge: 'Fur deutsche Unternehmen',
    headline: 'CO2-Bilanz fur KMU,',
    highlight: 'in Minuten fertig.',
    sub: 'CSRD-konforme Berichte, automatische CO2e-Berechnungen und Prufexporte.',
    stat1: 'Keine Berater notig', stat2: 'Kostenlos starten',
    compliance: 'CSRD',
  },
  fr: {
    badge: 'Pour les entreprises francaises',
    headline: 'Bilan carbone pour PME,',
    highlight: 'en quelques minutes.',
    sub: 'Rapports conformes CSRD, calculs CO2e automatiques et exports audit.',
    stat1: 'Sans consultant', stat2: 'Gratuit pour commencer',
    compliance: 'CSRD',
  },
  it: {
    badge: 'Per le aziende italiane',
    headline: 'Contabilita carbonio per PMI,',
    highlight: 'pronta in minuti.',
    sub: 'Report conformi CSRD, calcoli CO2e automatici ed esportazioni audit.',
    stat1: 'Senza consulenti', stat2: 'Gratis per iniziare',
    compliance: 'CSRD',
  },
  es: {
    badge: 'Para empresas espanolas',
    headline: 'Contabilidad de carbono para PYMEs,',
    highlight: 'lista en minutos.',
    sub: 'Informes conformes CSRD, calculos CO2e automaticos y exportaciones.',
    stat1: 'Sin consultores', stat2: 'Gratis para empezar',
    compliance: 'CSRD',
  },
  nl: {
    badge: 'Voor Nederlandse bedrijven',
    headline: 'CO2-boekhouding voor MKB,',
    highlight: 'klaar in minuten.',
    sub: 'CSRD-conforme rapporten, automatische CO2e-berekeningen en audit-exports.',
    stat1: 'Geen consultants nodig', stat2: 'Gratis beginnen',
    compliance: 'CSRD',
  },
  pl: {
    badge: 'Dla polskich firm',
    headline: 'Emisje CO2 dla MSP,',
    highlight: 'gotowe w minuty.',
    sub: 'Raporty zgodne z CSRD, automatyczne obliczenia CO2e i eksporty audytu.',
    stat1: 'Bez konsultantow', stat2: 'Bezplatny start',
    compliance: 'CSRD',
  },
  sv: {
    badge: 'For svenska foretag',
    headline: 'Koldioxidredovisning for SMF,',
    highlight: 'klar pa minuter.',
    sub: 'CSRD-anpassade rapporter, automatiska CO2e-berakningar och revisionsexporter.',
    stat1: 'Inga konsulter behovs', stat2: 'Gratis att borja',
    compliance: 'CSRD',
  },
  da: {
    badge: 'Til danske virksomheder',
    headline: 'CO2-regnskab til SMV,',
    highlight: 'klar pa minutter.',
    sub: 'CSRD-tilpassede rapporter, automatiske CO2e-beregninger og revisionseksporter.',
    stat1: 'Ingen konsulenter', stat2: 'Gratis at starte',
    compliance: 'CSRD',
  },
  pt: {
    badge: 'Para empresas portuguesas',
    headline: 'Contabilidade de carbono para PMEs,',
    highlight: 'pronta em minutos.',
    sub: 'Relatorios conformes CSRD, calculos CO2e automaticos e exportacoes auditoria.',
    stat1: 'Sem consultores', stat2: 'Gratuito para comecar',
    compliance: 'CSRD',
  },
  in: {
    badge: 'Built for Indian businesses',
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
          background: 'linear-gradient(135deg, #0f172a 0%, #0f172a 55%, #052e16 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          display: 'flex',
        }} />

        {/* Emerald glow blob — radial gradient, no filter */}
        <div style={{
          position: 'absolute', top: -80, right: 180,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.04) 60%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%', padding: '52px 64px',
          justifyContent: 'space-between',
        }}>

          {/* Top row: wordmark + locale badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(52,211,153,0.3)',
              background: 'rgba(52,211,153,0.1)',
              borderRadius: 999, padding: '8px 18px',
            }}>
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

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
    { width: 1200, height: 630, fonts: [] }
  );
}
