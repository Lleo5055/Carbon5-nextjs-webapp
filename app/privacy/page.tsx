import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Greenio',
  description: 'How Greenio collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/">
            <img src="/logogreenio.svg" alt="Greenio" className="h-20 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Effective date: 1 April 2025 &nbsp;|&nbsp; Last updated: 22 March 2026</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Who we are</h2>
            <p>
              Greenio ("<strong>Greenio</strong>", "we", "our", or "us") operates the carbon accounting platform
              available at <strong>greenio.co</strong>. We help businesses track, report, and reduce their greenhouse
              gas emissions in accordance with applicable frameworks including GHG Protocol, BRSR, and India's Carbon
              Credit Trading Scheme (CCTS).
            </p>
            <p className="mt-3">
              For the purposes of India's Digital Personal Data Protection Act, 2023 (DPDPA) and applicable data
              protection laws, Greenio is the <strong>Data Fiduciary</strong> in respect of personal data processed
              through this platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Data we collect</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700 border-b border-slate-200">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700 border-b border-slate-200">Examples</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700 border-b border-slate-200">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-medium">Account data</td>
                    <td className="px-4 py-3">Name, work email, organisation name, country</td>
                    <td className="px-4 py-3">Authentication and account management</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">Emissions data</td>
                    <td className="px-4 py-3">Electricity consumption, fuel usage, refrigerant quantities, Scope 3 activities</td>
                    <td className="px-4 py-3">Core service: carbon accounting and reporting</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Organisation profile</td>
                    <td className="px-4 py-3">Industry sector, employee count, reporting period, currency preference</td>
                    <td className="px-4 py-3">Benchmarking and regulatory report generation (BRSR, CCTS)</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">Usage data</td>
                    <td className="px-4 py-3">Pages visited, features used, timestamps</td>
                    <td className="px-4 py-3">Product improvement and support</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Technical data</td>
                    <td className="px-4 py-3">IP address, browser type, device type</td>
                    <td className="px-4 py-3">Security and fraud prevention</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">We do <strong>not</strong> collect payment card details directly. Payments are processed by our payment provider and we receive only transaction references.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Providing, maintaining, and improving the Greenio platform</li>
              <li>Generating carbon accounting reports, PDFs, and BRSR/CCTS verification packages on your behalf</li>
              <li>Sending service-related communications (account alerts, billing receipts, data export notifications)</li>
              <li>Benchmarking your emissions against anonymised industry peers (no individual data is shared)</li>
              <li>Complying with applicable legal obligations, including tax and accounting regulations</li>
              <li>Preventing fraud and ensuring platform security</li>
            </ul>
            <p className="mt-4">We do <strong>not</strong> sell your personal data to third parties. We do not use your emissions data for advertising.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Legal basis for processing</h2>
            <p>We process your personal data on the following grounds:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Contract performance:</strong> processing necessary to deliver the service you subscribed to</li>
              <li><strong>Consent:</strong> for optional communications such as product updates and newsletters; you may withdraw consent at any time</li>
              <li><strong>Legitimate interests:</strong> platform security, fraud prevention, and anonymised analytics</li>
              <li><strong>Legal obligation:</strong> where required by applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data storage and security</h2>
            <p>
              Your data is stored on servers hosted by Supabase (PostgreSQL) in data centres located in India or the
              European Union. We use industry-standard encryption (TLS in transit, AES-256 at rest), row-level security
              policies to ensure strict data isolation between accounts, and role-based access controls for our team.
            </p>
            <p className="mt-3">
              We conduct regular security reviews. In the event of a data breach that is likely to result in risk to
              your rights, we will notify you and the relevant authority within the timeframes required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Data sharing</h2>
            <p>We share data only with:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Supabase:</strong> database and authentication infrastructure</li>
              <li><strong>Vercel:</strong> application hosting and edge delivery</li>
              <li><strong>Payment processors:</strong> for billing purposes only; no emission data is shared</li>
              <li><strong>Professional advisors:</strong> lawyers and accountants bound by confidentiality obligations</li>
              <li><strong>Regulatory authorities:</strong> where required by law (e.g., BEE, MoEFCC, SEBI)</li>
            </ul>
            <p className="mt-4">
              All sub-processors are bound by data processing agreements and are prohibited from using your data for
              their own purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Data retention</h2>
            <p>
              We retain your account and emissions data for as long as your account is active, plus 7 years after
              account closure (to comply with statutory record-keeping requirements relevant to carbon reporting and
              financial accounts). You may request earlier deletion subject to legal obligations; see Section 8.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Your rights</h2>
            <p>Under applicable law (including DPDPA 2023), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Access:</strong> request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> request correction of inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> request deletion of your data, subject to legal retention requirements</li>
              <li><strong>Data portability:</strong> receive your emissions data in a machine-readable format (CSV/JSON export is available directly in the platform)</li>
              <li><strong>Withdraw consent:</strong> where processing is based on consent, withdraw it at any time</li>
              <li><strong>Lodge a complaint:</strong> with the Data Protection Board of India or other competent supervisory authority</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email us at <a href="mailto:hello@greenio.co" className="text-emerald-700 hover:underline">hello@greenio.co</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Cookies</h2>
            <p>
              We use essential session cookies required for authentication. We do not use advertising cookies or
              cross-site tracking cookies. You can disable cookies in your browser settings, but this will prevent
              you from logging in to the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Where changes are material, we will notify you by email
              or in-platform notice at least 14 days before the change takes effect. Continued use of the platform
              after that date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Contact us</h2>
            <p>For privacy-related queries or to exercise your rights:</p>
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
