// app/[locale]/opengraph-image.tsx
// Generates a locale-specific OG image via next/og ImageResponse.
// Served automatically at /<locale>/opengraph-image by Next.js.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { locale: string };
}

const LOCALE_META: Record<string, { headline: string; sub: string; flag: string; compliance: string }> = {
  en: { flag: '🇬🇧', headline: 'Carbon Accounting for UK SMEs',        sub: 'SECR-aligned • Audit-ready • Free to start',    compliance: 'SECR' },
  ie: { flag: '🇮🇪', headline: 'Carbon Accounting for Irish SMEs',     sub: 'CSRD-aligned • Audit-ready • Free to start',   compliance: 'CSRD' },
  de: { flag: '🇩🇪', headline: 'CO₂-Bilanz Software für KMU',          sub: 'CSRD-konform • Prüfbereit • Kostenlos starten', compliance: 'CSRD' },
  fr: { flag: '🇫🇷', headline: 'Bilan Carbone pour PME',               sub: 'Conforme CSRD • Prêt pour audit • Gratuit',     compliance: 'CSRD' },
  it: { flag: '🇮🇹', headline: 'Contabilità Carbonio per PMI',         sub: 'Conforme CSRD • Pronto per audit • Gratuito',   compliance: 'CSRD' },
  es: { flag: '🇪🇸', headline: 'Contabilidad de Carbono para PYMEs',   sub: 'Conforme CSRD • Listo para auditoría • Gratis', compliance: 'CSRD' },
  nl: { flag: '🇳🇱', headline: 'CO₂-boekhouding voor MKB',             sub: 'CSRD-conform • Auditklaar • Gratis beginnen',   compliance: 'CSRD' },
  pl: { flag: '🇵🇱', headline: 'Emisje CO₂ dla MŚP',                  sub: 'Zgodny z CSRD • Gotowy do audytu • Bezpłatny', compliance: 'CSRD' },
  sv: { flag: '🇸🇪', headline: 'Koldioxidredovisning för SMF',         sub: 'CSRD-anpassad • Revisionsredo • Gratis',        compliance: 'CSRD' },
  da: { flag: '🇩🇰', headline: 'CO₂-regnskab til SMV',                 sub: 'CSRD-tilpasset • Revisionsklart • Gratis',      compliance: 'CSRD' },
  pt: { flag: '🇵🇹', headline: 'Contabilidade de Carbono para PMEs',   sub: 'Conforme CSRD • Pronto para auditoria • Grátis', compliance: 'CSRD' },
  in: { flag: '🇮🇳', headline: 'Carbon Accounting & BRSR for India',   sub: 'BRSR-ready • CEA/BEE factors • Free to start',  compliance: 'BRSR' },
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
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(16,185,129,0.06)', display: 'flex' }} />

        {/* Top bar */}
        <div style={{ display: 'flex', width: '100%', height: 6, background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '52px 72px', justifyContent: 'space-between' }}>

          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Leaf icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #059669, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M17 8C8 10 5.9 16.17 3.82 19.1c.95.83 2.14 1.4 3.48 1.4 3 0 6.5-2 7.5-6 .5-2-1-3-2-3s-2 1-2 2 1 2 2 2c2.67 0 4-1.67 4-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#064e3b', letterSpacing: '-0.5px' }}>Greenio</span>
            {/* Compliance badge */}
            <div style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              background: '#ecfdf5', border: '2px solid #a7f3d0',
              borderRadius: 999, padding: '6px 16px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'flex' }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>{m.compliance}-ready</span>
            </div>
          </div>

          {/* Main headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 22 }}>{m.flag}</span>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carbon Accounting Software</span>
            </div>
            <h1 style={{
              fontSize: 58, fontWeight: 800, color: '#111827',
              lineHeight: 1.1, margin: 0,
              letterSpacing: '-1px',
            }}>
              {m.headline}
            </h1>
            <p style={{ fontSize: 24, color: '#4b5563', margin: 0, fontWeight: 500 }}>
              {m.sub}
            </p>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {['Scope 1', 'Scope 2', 'Scope 3'].map(s => (
                <div key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white', border: '1.5px solid #d1fae5',
                  borderRadius: 999, padding: '8px 18px',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'flex' }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#065f46' }}>{s}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#9ca3af' }}>greenio.co</span>
          </div>

        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}