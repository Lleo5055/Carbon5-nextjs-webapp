import Link from 'next/link';

export const metadata = {
  title: 'Importing from Tally — Greenio Help',
  description: 'How to export your Day Book from Tally and import it into Greenio to auto-fill your monthly emissions.',
};

const STEP_SOURCES = [
  { what: 'Diesel', examples: 'Diesel, HSD, High Speed Diesel, Vehicle Fuel' },
  { what: 'Petrol', examples: 'Petrol, MS Fuel, Motor Spirit' },
  { what: 'LPG', examples: 'LPG, LPG Cylinders, Gas Cylinders' },
  { what: 'CNG', examples: 'CNG, Compressed Natural Gas' },
  { what: 'Natural Gas / PNG', examples: 'PNG, Natural Gas, Piped Gas' },
  { what: 'Electricity', examples: 'Electricity, Power, BESCOM, MSEDCL, TATA Power, TNEB' },
  { what: 'Refrigerant', examples: 'Refrigerant, AC Gas, R410A, Refrigerant Top-up' },
];

const EXAMPLE_MAPPINGS = [
  { ledger: 'Diesel Purchases', source: 'Diesel' },
  { ledger: 'Electricity - MSEDCL', source: 'Electricity' },
  { ledger: 'LPG Cylinders', source: 'LPG' },
  { ledger: 'AC Maintenance', source: 'Skip — not an emission source' },
  { ledger: 'Office Supplies', source: 'Skip — not an emission source' },
];

const QUANTITY_UNITS = [
  { source: 'Electricity', unit: 'kWh', note: 'from your electricity bill' },
  { source: 'Diesel / Petrol', unit: 'litres', note: 'from your fuel invoice' },
  { source: 'LPG', unit: 'kg', note: '1 standard cylinder = 14.2 kg' },
  { source: 'CNG', unit: 'kg', note: 'from CNG invoice' },
  { source: 'Natural Gas', unit: 'kWh', note: 'from gas bill' },
  { source: 'Refrigerant', unit: 'kg', note: 'amount topped up' },
];

const FAQS = [
  {
    q: 'My company uses a different ledger name for diesel — will it work?',
    a: 'Yes. In Step 3 you map any ledger name to any emission source. Greenio doesn\'t care what you call it in Tally.',
  },
  {
    q: 'We have multiple Tally companies (different plants or offices). Can I import each separately?',
    a: 'Yes. Export the Day Book from each Tally company separately and import each into Greenio for the relevant month.',
  },
  {
    q: 'I made a mistake in my ledger mapping. Can I fix it?',
    a: 'Yes. The next time you import, simply change the mapping for that ledger. Greenio saves the new mapping going forward.',
  },
  {
    q: 'What if a ledger has both fuel and non-fuel purchases mixed?',
    a: 'Map it to the emission source and enter the correct quantity manually. Greenio uses the quantity you enter, not the Tally cost amount.',
  },
  {
    q: 'Does Greenio store my Tally data?',
    a: 'No. The uploaded file is parsed and discarded immediately. Only your confirmed emission entries are saved.',
  },
  {
    q: 'I use TallyPrime 4.0 on cloud. Is there a faster way?',
    a: 'Not yet — the export/upload flow works for all versions including cloud. Direct cloud sync is coming in a future update.',
  },
];

function StepCircle({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

export default function TallyImportHelpPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Back link */}
        <div>
          <Link
            href="/dashboard/emissions"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
              <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
            </svg>
            Back to Add Emissions
          </Link>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">Help</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Importing from Tally</h1>
          <p className="text-sm text-slate-600 mt-1.5">
            How to export your Day Book from Tally and import it into Greenio to auto-fill your monthly emissions.
          </p>
        </div>

        {/* Section 1 — What gets imported */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">What gets imported</h2>
            <p className="text-xs text-slate-500 mt-0.5">Greenio recognises these emission sources from your Tally ledger names.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-3 text-left font-semibold text-slate-600 w-40">What</th>
                  <th className="p-3 text-left font-semibold text-slate-600">Examples of ledger names in Tally</th>
                </tr>
              </thead>
              <tbody>
                {STEP_SOURCES.map((row, i) => (
                  <tr key={row.what} className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                    <td className="p-3 font-medium text-slate-800">{row.what}</td>
                    <td className="p-3 text-slate-600">{row.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-[11px] text-slate-500">Water, Waste, and Air emissions are not imported from Tally — these come from separate sources.</p>
          </div>
        </section>

        {/* Section 2 — Before you start */}
        <section className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">Before you start</p>
          <p className="text-xs text-blue-700">
            Your Tally data will only import correctly if fuel and utility purchases are recorded as expense ledger entries in Tally. If your company records these under vague names like <span className="font-medium">Miscellaneous Expenses</span>, the import will still work — you&apos;ll map those ledgers manually in Step 3.
          </p>
        </section>

        {/* Section 3 — Step 1 */}
        <section id="step-1" className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <StepCircle n={1} />
            <h2 className="text-sm font-semibold text-slate-900">Export your Day Book from Tally</h2>
          </div>
          <div className="p-5 grid md:grid-cols-2 gap-5">
            {/* TallyPrime */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-800 mb-3">TallyPrime (any version)</p>
              {[
                'Open TallyPrime',
                'Go to Gateway of Tally → Display More Reports → Day Book',
                'Press F2 to set the date range — select the month you want to import',
                'Press Alt+E → select Excel (Spreadsheet) → click Export',
                'Save the file somewhere easy to find',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="text-xs text-slate-700">{step}</p>
                </div>
              ))}
            </div>
            {/* Tally ERP 9 */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-800 mb-3">Tally ERP 9</p>
              {[
                'Open Tally ERP 9',
                'Go to Gateway of Tally → Display → Day Book',
                'Press F2 to set the date range for the month',
                'Press Alt+E → select Excel → click Export',
                'Save the file',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="text-xs text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Important: </span>
                Your exported file will be named something like <span className="font-medium">DayBook.xlsx</span>. Make sure the date range in Tally matches the month you want to log in Greenio.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 — Step 2 */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <StepCircle n={2} />
            <h2 className="text-sm font-semibold text-slate-900">Upload to Greenio</h2>
          </div>
          <div className="px-5 py-4 space-y-2">
            {[
              'Go to Add Emissions',
              'Select the correct month and year above the form',
              'Click the Import from Tally tab',
              'Click the upload area and select your exported .xlsx file',
              'Click Parse Day Book',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-xs text-slate-700 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5 — Step 3 */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <StepCircle n={3} />
            <h2 className="text-sm font-semibold text-slate-900">Map your ledgers <span className="text-slate-400 font-normal">(first time only)</span></h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-600">
              Greenio shows all expense ledgers found in your Day Book and asks what each one is. Select the emission source from a dropdown next to each ledger.
            </p>
            <ul className="space-y-1 text-xs text-slate-600 list-none">
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#8226;</span>Ledgers Greenio recognises automatically will be pre-filled.</li>
              <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">&#8226;</span>Unknown ledgers show a yellow <span className="font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] mx-1">New ledger</span> badge and must be mapped manually.</li>
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">&#8226;</span>This mapping is saved — next month it applies automatically.</li>
            </ul>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-left font-semibold text-slate-600">Tally ledger name</th>
                    <th className="p-3 text-left font-semibold text-slate-600">Map to</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE_MAPPINGS.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                      <td className="p-3 font-medium text-slate-800">{row.ledger}</td>
                      <td className="p-3">
                        {row.source.startsWith('Skip') ? (
                          <span className="text-slate-400 italic">{row.source}</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">{row.source}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 6 — Step 4 */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <StepCircle n={4} />
            <h2 className="text-sm font-semibold text-slate-900">Enter quantities</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-600">
              Tally records costs, not quantities — so Greenio asks for the physical quantity for each mapped emission source. Check your bills or invoices for the correct number.
            </p>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-left font-semibold text-slate-600">Source</th>
                    <th className="p-3 text-left font-semibold text-slate-600">Unit</th>
                    <th className="p-3 text-left font-semibold text-slate-600">Where to find it</th>
                  </tr>
                </thead>
                <tbody>
                  {QUANTITY_UNITS.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                      <td className="p-3 font-medium text-slate-800">{row.source}</td>
                      <td className="p-3 font-semibold text-emerald-700">{row.unit}</td>
                      <td className="p-3 text-slate-500">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              You can also tap <span className="font-medium text-slate-700">Scan invoice</span> next to any field to extract the quantity from a photo of your bill.
            </p>
          </div>
        </section>

        {/* Section 7 — Step 5 */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <StepCircle n={5} />
            <h2 className="text-sm font-semibold text-slate-900">Confirm and apply</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-slate-600">
              After filling in quantities for each mapped source, click <span className="font-medium text-slate-800">Apply to emissions form →</span>. Greenio pre-fills the manual entry form with all the data.
            </p>
            <p className="text-xs text-slate-600">
              Review the pre-filled values, make any adjustments, then click <span className="font-medium text-slate-800">Save emissions</span> as normal.
            </p>
          </div>
        </section>

        {/* Section 8 — Every month after setup */}
        <section className="rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-emerald-100">
            <h2 className="text-sm font-semibold text-emerald-900">Every month after setup</h2>
            <p className="text-xs text-emerald-700 mt-0.5">Once your ledger mappings are saved, the monthly workflow takes just a few minutes.</p>
          </div>
          <div className="px-5 py-4 space-y-2">
            {[
              'Export Day Book from Tally for the month',
              'Open Greenio → Add Emissions → Import from Tally',
              'Upload the file — mappings apply automatically',
              'Enter quantities → Apply → Save',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-xs text-emerald-800 font-medium">{step}</p>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <p className="text-xs text-emerald-700 font-medium mt-2">Typical time after first setup: 2–3 minutes per month.</p>
          </div>
        </section>

        {/* Section 9 — FAQs */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {FAQS.map((faq, i) => (
              <div key={i} className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-800">{faq.q}</p>
                <p className="text-xs text-slate-600 mt-1.5">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 10 — Still stuck */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold text-slate-700 mb-1">Still stuck?</p>
          <p className="text-xs text-slate-600">
            If your file isn&apos;t parsing correctly or you&apos;re seeing unexpected results, check that you exported the <span className="font-medium text-slate-800">Day Book</span> (not a Ledger report or Balance Sheet). If the problem continues, contact{' '}
            <a href="mailto:support@greenio.in" className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700">Greenio support</a>.
          </p>
        </section>

        {/* Bottom back link */}
        <div className="pb-4">
          <Link
            href="/dashboard/emissions"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
              <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25H13.25A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
            </svg>
            Back to Add Emissions
          </Link>
        </div>

      </div>
    </main>
  );
}
