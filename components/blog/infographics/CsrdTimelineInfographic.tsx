export default function CsrdTimelineInfographic() {
  const waves = [
    {
      wave: 'Wave 1',
      year: '2024',
      type: 'Large PIEs',
      detail: 'Listed, 500+ employees',
      deadline: '28 March 2025',
      fill: '#3b82f6',
      text: '#fff',
      urgent: false,
    },
    {
      wave: 'Wave 2',
      year: '2025',
      type: 'Other Large Companies',
      detail: '250+ employees or €40m+ turnover',
      deadline: '28 March 2026',
      fill: '#dc2626',
      text: '#fff',
      urgent: true,
    },
    {
      wave: 'Wave 3',
      year: '2026',
      type: 'Listed SMEs',
      detail: 'Opt-out available until Dec 2027',
      deadline: '28 March 2027*',
      fill: '#64748b',
      text: '#fff',
      urgent: false,
    },
  ];

  const boxW = 160;
  const boxH = 140;
  const gap = 30;
  const startX = 30;
  const y = 40;

  return (
    <figure className="not-prose my-8">
      <svg viewBox="0 0 580 230" className="w-full max-w-2xl mx-auto" aria-label="CSRD phased rollout timeline">
        {waves.map((w, i) => {
          const x = startX + i * (boxW + gap);
          const arrowX = x + boxW + 2;
          const arrowMidY = y + boxH / 2;

          return (
            <g key={w.wave}>
              {/* Box */}
              <rect x={x} y={y} width={boxW} height={boxH} rx="8" fill={w.fill} />
              {w.urgent && (
                <rect x={x - 3} y={y - 3} width={boxW + 6} height={boxH + 6} rx="10" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="6 3" />
              )}
              <text x={x + boxW / 2} y={y + 22} textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill={w.text} opacity={0.8}>{w.wave}</text>
              <text x={x + boxW / 2} y={y + 44} textAnchor="middle" fontSize="22" fontFamily="Arial, sans-serif" fill={w.text} fontWeight="700">{w.year}</text>
              <text x={x + boxW / 2} y={y + 66} textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill={w.text} fontWeight="600">{w.type}</text>
              <foreignObject x={x + 8} y={y + 72} width={boxW - 16} height={30}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: '1.3' }}>{w.detail}</div>
              </foreignObject>
              <text x={x + boxW / 2} y={y + boxH - 14} textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill={w.text} fontWeight="600">{w.deadline}</text>

              {/* Arrow between boxes */}
              {i < waves.length - 1 && (
                <g>
                  <line x1={arrowX} y1={arrowMidY} x2={arrowX + gap - 4} y2={arrowMidY} stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points={`${arrowX + gap - 4},${arrowMidY - 4} ${arrowX + gap + 2},${arrowMidY} ${arrowX + gap - 4},${arrowMidY + 4}`} fill="#94a3b8" />
                </g>
              )}
            </g>
          );
        })}

        {/* Urgent callout */}
<rect x="107" y="200" width="350" height="30" rx="4" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1" />

<text 
  x="280" 
  y="212" 
  fontSize="10" 
  fontFamily="Arial, sans-serif" 
  textAnchor="middle"
>
  <tspan fill="#dc2626" fontWeight="700">URGENT:</tspan>
  <tspan fill="#7f1d1d"> Wave 2 deadline is 28 March 2026.If your company has 250+ </tspan>
</text>

<text
  x="280"
  y="224"
  fontSize="10"
  fontFamily="Arial, sans-serif"
  fill="#7f1d1d"
  textAnchor="middle"
>employees or meets two size thresholds, act now.
</text>
      </svg>
      <figcaption className="text-center text-xs text-slate-500 mt-2">
        CSRD Phased Rollout 2024-2026 - *Listed SMEs can opt out until 31 December 2027
      </figcaption>
    </figure>
  );
}
