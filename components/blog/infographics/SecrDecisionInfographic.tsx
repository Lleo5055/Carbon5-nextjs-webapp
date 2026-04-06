export default function SecrDecisionInfographic() {
  return (
    <figure className="not-prose my-8">
      <svg viewBox="0 0 560 380" className="w-full max-w-2xl mx-auto" aria-label="SECR qualification decision flowchart">
        {/* Start node */}
        <rect x="170" y="10" width="220" height="35" rx="20" fill="#0f172a" />
        <text x="280" y="35" textAnchor="middle" fontSize="13" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="700">Is your company UK-registered?</text>

        {/* Arrow down */}
        <line x1="280" y1="50" x2="280" y2="75" stroke="#64748b" strokeWidth="1.5" />
        <polygon points="275,73 285,73 280,80" fill="#64748b" />

        {/* No branch left */}
        <line x1="280" y1="60" x2="100" y2="60" stroke="#64748b" strokeWidth="1.5" />
        <line x1="100" y1="60" x2="100" y2="130" stroke="#64748b" strokeWidth="1.5" />
        <polygon points="95,128 105,128 100,135" fill="#64748b" />
        <text x="185" y="55" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">No</text>

        {/* No result */}
        <rect x="30" y="135" width="140" height="36" rx="6" fill="#e2e8f0" />
        <text x="100" y="150" textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill="#475569" fontWeight="600">Not in scope</text>
        <text x="100" y="165" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#64748b">SECR does not apply</text>

        {/* Yes label */}
        <text x="295" y="70" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">Yes</text>

        {/* Q2 node */}
        <rect x="155" y="80" width="250" height="40" rx="20" fill="#0f172a" />
        <text x="280" y="100" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="600">Quoted on London Stock</text>
        <text x="280" y="114" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="600">Exchange (LSE / AIM)?</text>

        {/* Arrow down from Q2 */}
        <line x1="280" y1="120" x2="280" y2="145" stroke="#64748b" strokeWidth="1.5" />
        <polygon points="275,143 285,143 280,150" fill="#64748b" />
        <text x="295" y="140" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">Yes</text>

        {/* SECR applies - quoted */}
        <rect x="175" y="150" width="210" height="44" rx="8" fill="#15803d" />
        <text x="280" y="170" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="700">SECR Applies</text>
        <text x="280" y="186" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#bbf7d0">Quoted company - full SECR report</text>

        {/* No branch from Q2 - large unquoted */}
<line x1="405" y1="100" x2="480" y2="100" stroke="#64748b" strokeWidth="1.5" />
<line x1="480" y1="100" x2="480" y2="237" stroke="#64748b" strokeWidth="1.5" />
<line x1="480" y1="237" x2="405" y2="237" stroke="#64748b" strokeWidth="1.5" />
<text x="437" y="95" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">No</text>

        {/* Q3 node */}
        <rect x="155" y="210" width="250" height="55" rx="20" fill="#0f172a" />
        <text x="280" y="231" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="600">250+ employees</text>
        <text x="280" y="246" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="600">OR £36m+ turnover</text>
        <text x="280" y="259" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="600">OR £18m+ balance sheet?</text>

        

        {/* Arrow down from Q3 */}
        <line x1="280" y1="265" x2="280" y2="290" stroke="#64748b" strokeWidth="1.5" />
        <polygon points="275,288 285,288 280,295" fill="#64748b" />
        <text x="295" y="284" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">Yes</text>

        {/* SECR applies - large unquoted */}
        <rect x="175" y="295" width="210" height="44" rx="8" fill="#15803d" />
        <text x="280" y="315" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff" fontWeight="700">SECR Applies</text>
        <text x="280" y="331" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#bbf7d0">Large unquoted - SECR report required</text>

        {/* No from Q3 */}
        <line x1="155" y1="237" x2="75" y2="237" stroke="#64748b" strokeWidth="1.5" />
        <line x1="75" y1="237" x2="75" y2="310" stroke="#64748b" strokeWidth="1.5" />
        <polygon points="70,308 80,308 75,315" fill="#64748b" />
        <text x="110" y="232" fontSize="10" fontFamily="Arial, sans-serif" fill="#94a3b8">No</text>

        {/* Not in scope 2 */}
        <rect x="10" y="315" width="130" height="36" rx="6" fill="#e2e8f0" />
        <text x="75" y="330" textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill="#475569" fontWeight="600">Not in scope</text>
        <text x="75" y="345" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fill="#64748b">Small company exemption</text>

        {/* Note at bottom */}
        <rect x="155" y="348" width="250" height="22" rx="4" fill="#fef9c3" stroke="#fde68a" strokeWidth="1" />
        <text x="280" y="363" textAnchor="middle" fontSize="9.5" fontFamily="Arial, sans-serif" fill="#92400e">Must meet 2 of 3 size tests for 2 consecutive years</text>
      </svg>
      <figcaption className="text-center text-xs text-slate-500 mt-2">
        SECR Qualification Flowchart - Quoted companies always qualify; large unquoted companies qualify if they meet 2 of 3 size thresholds
      </figcaption>
    </figure>
  );
}
