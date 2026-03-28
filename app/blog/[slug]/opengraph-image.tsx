import { ImageResponse } from 'next/og';
import { getBlogPost } from '@/lib/blog/utils';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const REGULATION_BG: Record<string, string> = {
  BRSR:            'linear-gradient(135deg, #1e1b4b 0%, #1e3a5f 100%)',
  CCTS:            'linear-gradient(135deg, #022c22 0%, #134e4a 100%)',
  'BRSR, CCTS':    'linear-gradient(135deg, #1e1b4b 0%, #134e4a 100%)',
  SECR:            'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  CSRD:            'linear-gradient(135deg, #172554 0%, #1e1b4b 100%)',
  'GHG Protocol':  'linear-gradient(135deg, #022c22 0%, #0f172a 100%)',
};

const DEFAULT_BG = 'linear-gradient(135deg, #0f172a 0%, #022c22 100%)';

interface Props {
  params: { slug: string };
}

export default function OgImage({ params }: Props) {
  const post = getBlogPost(params.slug);

  const title = post?.title ?? 'Carbon Accounting Insights';
  const country = post?.country ?? 'Global';
  const flag = post?.flag ?? '🌍';
  const regulation = post?.regulation ?? '';
  const levelLabel = post?.levelLabel ?? '';
  const bg = REGULATION_BG[regulation] ?? DEFAULT_BG;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          background: bg,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative circle top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        {/* Decorative circle bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-120px',
            left: '-60px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }}
        />

        {/* Top section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Flag + country + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '48px', lineHeight: 1 }}>{flag}</span>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '22px', fontWeight: 500 }}>
              {country}
            </span>
            {regulation && (
              <div
                style={{
                  background: 'rgba(52,211,153,0.2)',
                  border: '1px solid rgba(52,211,153,0.4)',
                  borderRadius: '100px',
                  padding: '6px 18px',
                  color: '#6ee7b7',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                {regulation}
              </div>
            )}
            {levelLabel && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '100px',
                  padding: '6px 18px',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '16px',
                  fontWeight: 500,
                }}
              >
                {levelLabel}
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              color: '#ffffff',
              fontSize: title.length > 60 ? '42px' : '52px',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.5px',
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom: Greenio branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #34d399, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.9)',
                }}
              />
            </div>
            <span style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700 }}>Greenio</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '20px' }}>greenio.co/blog</span>
        </div>
      </div>
    ),
    { ...size },
  );
}