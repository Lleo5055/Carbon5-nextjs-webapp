import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Greenio',
  description: 'Terms governing your use of the Greenio carbon accounting platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Greenio" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-lg font-semibold text-emerald-700">Greenio</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Effective date: 1 April 2025 &nbsp;|&nbsp; Last updated: 22 March 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Agreement to terms</h2>
            <p>
              By creating an account or using the Greenio platform ("<strong>Service</strong>"), you agree to be bound
              by these Terms of Service ("<strong>Terms</strong>"). If you are accepting on behalf of an organisation,
              you represent that you have authority to bind that organisation.
            </p>
            <p className="mt-3">
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Description of service</h2>
            <p>
              Greenio provides a software-as-a-service platform for greenhouse gas (GHG) emissions tracking,
              carbon accounting, and regulatory report preparation. Features include:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Monthly emissions data entry across Scope 1, 2, and 3 categories</li>
              <li>Automated CO2e calculations using published emission factors (DEFRA, CEA/BEE, IPCC AR6)</li>
              <li>BRSR (Business Responsibility and Sustainability Report) preparation tools</li>
              <li>CCTS (Carbon Credit Trading Scheme) verification package generation</li>
              <li>Leadership Snapshot PDF reports</li>
              <li>Bulk data import via CSV/XLSX and Tally integration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Account registration</h2>
            <p>You must:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Provide accurate and complete registration information</li>
              <li>Keep your password confidential and notify us immediately of any unauthorised access</li>
              <li>Be at least 18 years old or the age of majority in your jurisdiction</li>
              <li>Not share your account credentials with third parties</li>
            </ul>
            <p className="mt-4">
              You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Subscription plans and billing</h2>
            <p>
              Greenio offers Free, Growth, Pro, and Enterprise plans. Paid plans are billed monthly or annually
              in advance. Prices are displayed in INR for Indian accounts and in the applicable local currency
              for other regions, inclusive of applicable taxes.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>You may upgrade or downgrade your plan at any time; changes take effect at the next billing cycle</li>
              <li>Cancellations take effect at the end of the current paid period; no partial refunds are issued</li>
              <li>We reserve the right to change pricing with 30 days' written notice to existing subscribers</li>
              <li>Failed payments may result in suspension of paid features until resolved</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Submit false or misleading emissions data with intent to manipulate carbon reports or regulatory filings</li>
              <li>Attempt to reverse-engineer, decompile, or extract source code from the platform</li>
              <li>Use the platform to store or transmit malicious code</li>
              <li>Access or attempt to access other users' data</li>
              <li>Use automated scripts to scrape or overload the platform</li>
              <li>Resell or sublicense access to the platform without our written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your data</h2>
            <p>
              You retain ownership of all emissions data, organisation information, and other content you submit
              to the platform ("<strong>Your Data</strong>"). You grant Greenio a limited licence to process Your
              Data solely for the purpose of providing the Service.
            </p>
            <p className="mt-3">
              You are responsible for the accuracy and completeness of Your Data. Greenio calculates CO2e figures
              based on the inputs you provide; we are not liable for inaccuracies arising from incorrect input data.
            </p>
            <p className="mt-3">
              You may export Your Data at any time in CSV or JSON format. Upon account closure, we will make Your
              Data available for export for 30 days, after which it will be deleted subject to legal retention
              requirements (see our Privacy Policy).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Emission factor accuracy</h2>
            <p>
              Greenio uses published emission factors from authoritative sources (DEFRA, Central Electricity
              Authority of India, BEE, IPCC AR6). These factors are updated periodically. Calculated CO2e figures
              are estimates based on these published factors and are provided for informational and reporting
              purposes. They do not constitute a formal audit or verification.
            </p>
            <p className="mt-3">
              For regulatory submissions (BRSR, CCTS), you remain responsible for ensuring data accuracy and
              obtaining any required third-party verification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Intellectual property</h2>
            <p>
              The Greenio platform, including its software, design, methodology, and documentation, is owned by
              Greenio and protected by copyright and other intellectual property laws. These Terms do not grant
              you any ownership rights in the platform.
            </p>
            <p className="mt-3">
              The Greenio name, logo, and associated marks are trademarks of Greenio. You may not use them without
              prior written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Greenio's total liability for any claim arising out of or
              relating to these Terms or the Service shall not exceed the amount you paid to Greenio in the 12
              months preceding the claim.
            </p>
            <p className="mt-3">
              Greenio is not liable for indirect, incidental, consequential, or punitive damages, including loss
              of profits, data, or business opportunities, even if advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Disclaimer of warranties</h2>
            <p>
              The Service is provided "as is" and "as available". Greenio makes no warranty that the Service will
              be uninterrupted, error-free, or free of security vulnerabilities. We do not warrant that emission
              calculations will satisfy any specific regulatory requirement without independent verification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Termination</h2>
            <p>
              Either party may terminate these Terms at any time. We may suspend or terminate your account
              immediately if you breach these Terms, engage in fraudulent activity, or if required by law.
            </p>
            <p className="mt-3">
              Upon termination, your right to use the Service ceases. Sections 6 (Your Data export window),
              8 (IP), 9 (Liability), and 12 (Governing law) survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">12. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of India. Any dispute arising out of or relating to these
              Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved within
              30 days, disputes shall be subject to the exclusive jurisdiction of the courts of India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">13. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time. Where changes are material, we will notify you by
              email or in-platform notice at least 14 days before the change takes effect. Continued use of the
              Service after that date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">14. Contact</h2>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p><strong>Greenio</strong></p>
              <p>Email: <a href="mailto:hello@greenio.co" className="text-emerald-700 hover:underline">hello@greenio.co</a></p>
              <p>Website: <a href="https://greenio.co" className="text-emerald-700 hover:underline">greenio.co</a></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-slate-200 mt-16">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Greenio. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-800 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-800 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
