export default function BrsrPyramidInfographic() {
  return (
    <figure className="not-prose my-8">
      <svg
        viewBox="0 0 560 370"
        className="w-full max-w-2xl mx-auto"
        aria-label="BRSR compliance pyramid showing three tiers"
      >
        <defs>
          <clipPath id="pyr">
            <polygon points="280,28 40,272 520,272" />
          </clipPath>
        </defs>

        {/* Base fill — dark green for Top 150 */}
        <polygon points="280,28 40,272 520,272" fill="#15803d" />

        {/* Medium green covers y=125→272, clipped to pyramid — Top 1000 */}
        <rect x="0" y="125" width="560" height="147" fill="#22c55e" clipPath="url(#pyr)" />

        {/* Slate grey covers y=205→272, clipped to pyramid — All Others */}
        <rect x="0" y="205" width="560" height="67" fill="#e2e8f0" clipPath="url(#pyr)" />

        {/* Labels */}
        <text x="280" y="84" textAnchor="middle" fontSize="14" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="700">Top 150</text>
        <text x="280" y="102" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#bbf7d0">BRSR Core + Assurance</text>

        <text x="280" y="162" textAnchor="middle" fontSize="13" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="700">Top 1000 Listed Companies</text>
        <text x="280" y="179" textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill="#dcfce7">Mandatory BRSR Filing (FY 2022-23+)</text>

        <text x="280" y="240" textAnchor="middle" fontSize="14" fontFamily="Arial, sans-serif" fill="#475569" fontWeight="700">All Others</text>
        <text x="280" y="257" textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill="#64748b">Voluntary BRSR Adoption</text>

        {/* Legend */}
        <rect x="60" y="288" width="14" height="14" fill="#15803d" rx="2" />
        <text x="82" y="299" fontSize="11" fontFamily="Arial, sans-serif" fill="#475569">Top 150 - BRSR Core + mandatory third-party assurance required</text>

        <rect x="60" y="310" width="14" height="14" fill="#22c55e" rx="2" />
        <text x="82" y="321" fontSize="11" fontFamily="Arial, sans-serif" fill="#475569">Top 1000 - Full BRSR mandatory filing with annual report</text>

        <rect x="60" y="332" width="14" height="14" fill="#e2e8f0" rx="2" />
        <text x="82" y="343" fontSize="11" fontFamily="Arial, sans-serif" fill="#475569">All others - Voluntary BRSR adoption</text>
      </svg>
      <figcaption className="text-center text-xs text-slate-500 mt-2">
        BRSR Compliance Pyramid 2026 - Top 150: BRSR Core with third-party assurance | Top 1000: Mandatory BRSR filing | Others: Voluntary
      </figcaption>
    </figure>
  );
}
