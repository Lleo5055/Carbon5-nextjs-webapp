// app/report-template/page.tsx
// PREMIUM CARBON REPORT TEMPLATE (HTML → PDF READY)
// This file uses SERVER COMPONENTS ONLY (no client-side JS).

import React from 'react';
import { supabase } from '../../lib/supabaseClient';

// ------------------------------
// 🔧 Utility functions
// ------------------------------

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function formatKg(v: number) {
  return `${v.toFixed(2)} kg CO₂e`;
}

function formatTonne(v: number) {
  return `${(v / 1000).toFixed(2)} tCO₂e`;
}

function formatCurrency(v: number) {
  return `£${v.toFixed(2)}`;
}

// A4 page width reference for SVG (794px ≈ 210mm)
const PAGE_WIDTH = 794;

// ------------------------------
// 📘 Pie Chart (SVG)
// ------------------------------
function PieChart({ electricity, fuel, refrigerant, other }: any) {
  const total = electricity + fuel + refrigerant + other || 1;

  const slices = [
    { label: 'Electricity', value: electricity, color: '#93C5FD' },
    { label: 'Fuel', value: fuel, color: '#FBBF24' },
    { label: 'Refrigerant', value: refrigerant, color: '#6EE7B7' },
    { label: 'Other', value: other, color: '#D1D5DB' },
  ];

  let cumulativeAngle = 0;

  const radius = 80;
  const cx = 120;
  const cy = 120;

  return (
    <svg width="260" height="260">
      {slices.map((s, idx) => {
        const sliceAngle = (s.value / total) * 2 * Math.PI;
        const x1 = cx + radius * Math.cos(cumulativeAngle);
        const y1 = cy + radius * Math.sin(cumulativeAngle);
        const x2 = cx + radius * Math.cos(cumulativeAngle + sliceAngle);
        const y2 = cy + radius * Math.sin(cumulativeAngle + sliceAngle);

        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        cumulativeAngle += sliceAngle;

        return (
          <path
            key={idx}
            d={`
              M ${cx} ${cy}
              L ${x1} ${y1}
              A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
              Z
            `}
            fill={s.color}
            stroke="#ffffff"
            strokeWidth="1"
          ></path>
        );
      })}
    </svg>
  );
}

// ------------------------------
// 📈 Simple Line Chart (SVG) for Trend
// ------------------------------
function TrendChart({ months, values }: any) {
  if (!months || months.length === 0) return null;

  const width = PAGE_WIDTH - 120;
  const height = 200;
  const max = Math.max(...values, 1);
  const min = 0;

  const points = values.map((v: number, i: number) => {
    const x = (i / (values.length - 1)) * (width - 20) + 10;
    const y = height - (v / max) * (height - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="mt-2">
      {/* Axis */}
      <line
        x1="10"
        y1={height - 10}
        x2={width - 10}
        y2={height - 10}
        stroke="#9CA3AF"
        strokeWidth="1"
      />
      {/* Trend Line */}
      <polyline
        fill="none"
        stroke="#3B82F6"
        strokeWidth="2"
        points={points.join(' ')}
      />
      {/* Points */}
      {points.map((p: string, idx: number) => {
        const [x, y] = p.split(',').map(Number);
        return <circle key={idx} cx={x} cy={y} r={3} fill="#3B82F6" />;
      })}
    </svg>
  );
}

// ------------------------------
// 🔮 Forecast Chart (SVG)
// ------------------------------
function ForecastChart({ months, baseline, reduced }: any) {
  if (!months || months.length === 0) return null;

  const width = PAGE_WIDTH - 120;
  const height = 200;
  const maxVal = Math.max(...baseline, ...reduced, 1);

  const scaleX = (i: number) => (i / (months.length - 1)) * (width - 20) + 10;

  const scaleY = (v: number) => height - (v / maxVal) * (height - 20) - 10;

  const basePoints = baseline
    .map((v: number, i: number) => `${scaleX(i)},${scaleY(v)}`)
    .join(' ');

  const reducedPoints = reduced
    .map((v: number, i: number) => `${scaleX(i)},${scaleY(v)}`)
    .join(' ');

  return (
    <svg width={width} height={height}>
      {/* Axis */}
      <line
        x1="10"
        y1={height - 10}
        x2={width - 10}
        y2={height - 10}
        stroke="#9CA3AF"
        strokeWidth="1"
      />

      {/* Baseline */}
      <polyline
        fill="none"
        stroke="#9CA3AF"
        strokeWidth="2"
        points={basePoints}
      />

      {/* Reduced Scenario */}
      <polyline
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        points={reducedPoints}
      />
    </svg>
  );
}

// ------------------------------
// MAIN PAGE COMPONENT
// ------------------------------
export default async function ReportTemplate({
  searchParams,
}: {
  searchParams: { user_id?: string };
}) {
  const userId = searchParams.user_id;

  // Fetch data
  const { data: rows } = await supabase
    .from('emissions')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true });

  const list = rows || [];

  // Aggregate values
  const electricityTotal = list.reduce(
    (sum: number, r: any) => sum + safeNum(r.electricity_kw),
    0
  );
  const fuelTotal = list.reduce(
    (s: number, r: any) =>
      s +
      safeNum(r.diesel_litres) +
      safeNum(r.petrol_litres) +
      safeNum(r.fuel_liters),
    0
  );
  const refrigerantTotal = list.reduce(
    (s: number, r: any) =>
      s + safeNum(r.refrigerant_kg) * safeNum(r.refrigerant_gwp),
    0
  );
  const co2Total = list.reduce(
    (s: number, r: any) => s + safeNum(r.total_co2e),
    0
  );

  // Trend arrays
  const months = list.map((r: any) => r.month);
  const values = list.map((r: any) => safeNum(r.total_co2e));

  // Simple baseline forecast
  const baselineForecast = values.map((v) => v * 1.02); // +2%

  // Reduced scenario forecast
  const reducedForecast = values.map((v) => v * 0.82); // –18%

  return (
    <html>
      <head>
        <title>Carbon Report</title>
        <style>{`
          @page {
            size: A4;
            margin: 32px;
          }
          body {
            font-family: Inter, sans-serif;
          }
          .page-break {
            page-break-after: always;
          }
        `}</style>
      </head>
      <body className="text-slate-800">
        {/* COVER PAGE */}
        <section
          className="h-[1000px] flex flex-col justify-center items-start px-16"
          style={{ pageBreakAfter: 'always' }}
        >
          <h1 className="text-5xl font-semibold tracking-tight">
            Carbon Footprint Report
          </h1>

          <p className="mt-6 text-xl">Prepared for: Carbon Central Client</p>
          <p className="text-md mt-2">Industry: Logistics & Fleet Operations</p>

          <p className="text-sm text-slate-500 mt-10">
            Prepared by Carbon Central • {new Date().toLocaleDateString()}
          </p>
        </section>

        {/* TABLE OF CONTENTS */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">Table of Contents</h2>
          <ol className="text-lg leading-10">
            <li>1. Executive Summary</li>
            <li>2. Emissions Overview</li>
            <li>3. Trend Analysis</li>
            <li>4. Hotspot Breakdown</li>
            <li>5. Benchmarking</li>
            <li>6. Financial Impact</li>
            <li>7. Reduction Roadmap</li>
            <li>8. Forecast & Net-Zero Pathway</li>
            <li>9. SECR Summary</li>
            <li>10. AI Insights</li>
            <li>11. Methodology</li>
            <li>12. Appendix</li>
          </ol>
        </section>
        {/* EXECUTIVE SUMMARY */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-4">1. Executive Summary</h2>

          <p className="text-lg leading-7 mt-4">
            This report provides a comprehensive breakdown of your carbon
            footprint across electricity, fleet fuels, refrigerants, and
            operational sources. It includes historical trends, hotspot
            analysis, benchmarking, financial impact modelling, and a
            forward-looking emissions forecast aligned with industry
            expectations.
          </p>

          <div className="mt-10 space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Total Emissions</h3>
              <p className="text-lg mt-1">
                Your total emissions for the recorded period:
                <span className="font-semibold ml-2">
                  {formatTonne(co2Total)}
                </span>
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold">Primary Hotspots</h3>
              <ul className="list-disc ml-6 text-lg leading-7">
                <li>Electricity usage across offices and depots</li>
                <li>Diesel or petrol consumption from fleet vehicles</li>
                <li>Refrigerant leakage (if applicable)</li>
                <li>Unclassified “other” sources requiring refinement</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold">Data Quality Notes</h3>
              <p className="text-lg leading-7 mt-1">
                Your current data completeness is moderate, with well-structured
                entries for electricity and fuel usage. Refrigerant records
                appear optional and may require additional detail for
                high-accuracy reporting.
              </p>
            </div>
          </div>
        </section>

        {/* EMISSIONS OVERVIEW */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">2. Emissions Overview</h2>

          <p className="text-lg leading-7 mb-8">
            This section provides a high-level breakdown of your emissions by
            source category. The accompanying pie chart illustrates the
            proportional contribution of each source to your overall carbon
            footprint.
          </p>

          {/* Pie Chart + Stats */}
          <div className="flex gap-12">
            <PieChart
              electricity={electricityTotal}
              fuel={fuelTotal}
              refrigerant={refrigerantTotal}
              other={Math.max(
                co2Total - electricityTotal - fuelTotal - refrigerantTotal,
                0
              )}
            />

            <div className="flex flex-col justify-center">
              <div className="text-lg">
                <p className="mb-2">
                  <span className="inline-block w-4 h-4 bg-[#93C5FD] mr-2"></span>
                  Electricity: <strong>{formatKg(electricityTotal)}</strong>
                </p>
                <p className="mb-2">
                  <span className="inline-block w-4 h-4 bg-[#FBBF24] mr-2"></span>
                  Fuel: <strong>{formatKg(fuelTotal)}</strong>
                </p>
                <p className="mb-2">
                  <span className="inline-block w-4 h-4 bg-[#6EE7B7] mr-2"></span>
                  Refrigerant: <strong>{formatKg(refrigerantTotal)}</strong>
                </p>
                <p>
                  <span className="inline-block w-4 h-4 bg-[#D1D5DB] mr-2"></span>
                  Other sources:{' '}
                  <strong>
                    {formatKg(
                      Math.max(
                        co2Total -
                          electricityTotal -
                          fuelTotal -
                          refrigerantTotal,
                        0
                      )
                    )}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* Overview Table */}
          <div className="mt-12">
            <h3 className="text-2xl font-semibold mb-4">Breakdown Table</h3>
            <table className="w-full border-collapse text-lg">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-200">
                  <th className="text-left px-4 py-3 font-semibold">Source</th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Emissions (kg CO₂e)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50 border-b">
                  <td className="px-4 py-3">Electricity</td>
                  <td className="px-4 py-3 text-right">
                    {electricityTotal.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3">Fuel</td>
                  <td className="px-4 py-3 text-right">
                    {fuelTotal.toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-gray-50 border-b">
                  <td className="px-4 py-3">Refrigerants</td>
                  <td className="px-4 py-3 text-right">
                    {refrigerantTotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Other</td>
                  <td className="px-4 py-3 text-right">
                    {Math.max(
                      co2Total -
                        electricityTotal -
                        fuelTotal -
                        refrigerantTotal,
                      0
                    ).toFixed(2)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-blue-100 border-t-2 border-blue-300">
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 font-semibold text-right">
                    {co2Total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        {/* TREND ANALYSIS */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">3. Trend Analysis</h2>

          <p className="text-lg leading-7 mb-6">
            This chart illustrates how your total emissions have changed across
            the recorded months. It helps distinguish one-off anomalies from
            sustained trends and highlights where your operations are most
            sensitive to change.
          </p>

          <TrendChart months={months} values={values} />

          <div className="mt-8 space-y-3 text-lg">
            <p>
              <strong>Peak month:</strong>{' '}
              {months.length > 0
                ? months[
                    values.indexOf(
                      Math.max.apply(null, values.length ? values : [0])
                    )
                  ]
                : 'N/A'}
            </p>
            <p>
              <strong>Average monthly emissions:</strong>{' '}
              {values.length
                ? `${(
                    values.reduce((a, b) => a + b, 0) / values.length
                  ).toFixed(2)} kg CO₂e`
                : 'N/A'}
            </p>
          </div>
        </section>

        {/* HOTSPOT BREAKDOWN */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">4. Hotspot Breakdown</h2>

          <p className="text-lg leading-7 mb-8">
            Emissions hotspots are the parts of your operation where reductions
            will have the biggest impact. For logistics and fleet operations,
            this typically includes diesel use, routing efficiency, idling time
            and depot electricity.
          </p>

          <div className="grid grid-cols-2 gap-10 text-lg">
            <div>
              <h3 className="text-xl font-semibold mb-3">
                Fleet & Fuel Behaviour
              </h3>
              <ul className="list-disc ml-6 space-y-2 leading-7">
                <li>Route optimisation and consolidation of deliveries</li>
                <li>Driver behaviour (idling, harsh acceleration, speeding)</li>
                <li>Vehicle maintenance and tyre pressure management</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">
                Depot & Site Electricity
              </h3>
              <ul className="list-disc ml-6 space-y-2 leading-7">
                <li>Lighting controls in warehouses and yards</li>
                <li>Heating and cooling set points and schedules</li>
                <li>Out-of-hours equipment usage</li>
              </ul>
            </div>
          </div>
        </section>

        {/* BENCHMARKING */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">
            5. Benchmarking & Industry Comparison
          </h2>

          <p className="text-lg leading-7 mb-6">
            This section compares your emissions intensity against typical
            logistics and fleet operations. Exact benchmarks depend on your
            annual mileage, fleet size and revenue, but indicative ranges are
            shown below.
          </p>

          <div className="grid grid-cols-2 gap-10">
            <div className="text-lg">
              <h3 className="text-xl font-semibold mb-3">
                Indicative Sector Benchmarks
              </h3>
              <ul className="list-disc ml-6 space-y-2 leading-7">
                <li>0.9 – 2.4 tCO₂e per vehicle per year</li>
                <li>4.2 – 12.8 tCO₂e per £m turnover</li>
                <li>0.12 – 0.30 kg CO₂e per km driven</li>
              </ul>
            </div>

            <div className="text-lg">
              <h3 className="text-xl font-semibold mb-3">
                Your Current Position
              </h3>
              <p className="leading-7 mb-2">
                With the current dataset, your absolute footprint sits in a
                modest band consistent with a small fleet. Once vehicle count
                and mileage data are added to Carbon Central, the platform will
                automatically compute precise intensity ratios and show how you
                compare against your peers.
              </p>
              <p className="leading-7">
                This makes it easier to brief investors, lenders and customers
                on your operational efficiency and climate performance.
              </p>
            </div>
          </div>
        </section>

        {/* FINANCIAL IMPACT */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">
            6. Financial Impact & Cost Savings
          </h2>

          <p className="text-lg leading-7 mb-8">
            Reducing emissions is closely linked to reducing wasted energy and
            fuel. This section provides an estimate of annualised energy costs
            based on your current consumption profile and highlights where
            savings can be made.
          </p>

          {(() => {
            // Simple cost model assumptions (can be refined later or pulled from user settings)
            const electricityTariff = 0.3; // £/kWh
            const dieselPrice = 1.6; // £/litre
            const petrolPrice = 1.55; // £/litre
            const gasTariff = 0.1; // £/kWh

            const totalDiesel = list.reduce(
              (s: number, r: any) => s + safeNum(r.diesel_litres),
              0
            );
            const totalPetrol = list.reduce(
              (s: number, r: any) => s + safeNum(r.petrol_litres),
              0
            );
            const totalGas = list.reduce(
              (s: number, r: any) => s + safeNum(r.gas_kwh),
              0
            );

            const electricityCost = electricityTotal * electricityTariff;
            const dieselCost = totalDiesel * dieselPrice;
            const petrolCost = totalPetrol * petrolPrice;
            const gasCost = totalGas * gasTariff;

            const totalEnergyCost =
              electricityCost + dieselCost + petrolCost + gasCost;

            // Assume achievable savings band
            const lowSavings = totalEnergyCost * 0.2;
            const highSavings = totalEnergyCost * 0.35;

            return (
              <>
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold mb-3">
                    Annualised Energy Cost (Estimated)
                  </h3>
                  <table className="w-full border-collapse text-lg">
                    <thead>
                      <tr className="bg-blue-50 border-b border-blue-200">
                        <th className="text-left px-4 py-3 font-semibold">
                          Source
                        </th>
                        <th className="text-right px-4 py-3 font-semibold">
                          Estimated Cost (per year)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gray-50 border-b">
                        <td className="px-4 py-3">Electricity</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(electricityCost)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-3">Diesel</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(dieselCost)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50 border-b">
                        <td className="px-4 py-3">Petrol</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(petrolCost)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-3">Gas</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(gasCost)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-100 border-t-2 border-blue-300">
                        <td className="px-4 py-3 font-semibold">Total</td>
                        <td className="px-4 py-3 font-semibold text-right">
                          {formatCurrency(totalEnergyCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-4">
                    Savings Potential
                  </h3>
                  <p className="text-lg leading-7 mb-3">
                    Based on typical improvement opportunities in logistics
                    operations, a combined reduction of <strong>20–35%</strong>{' '}
                    in energy and fuel spend is often achievable through low or
                    no-cost operational measures.
                  </p>
                  <p className="text-lg leading-7">
                    For your current profile, this equates to an estimated
                    savings range of{' '}
                    <strong>
                      {formatCurrency(lowSavings)} –{' '}
                      {formatCurrency(highSavings)}
                    </strong>{' '}
                    per year, before considering any capital-intensive changes
                    such as major equipment upgrades or fleet electrification.
                  </p>
                </div>
              </>
            );
          })()}
        </section>
        {/* REDUCTION ROADMAP */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">7. Reduction Roadmap</h2>

          <p className="text-lg leading-7 mb-6">
            This roadmap outlines a practical sequence of actions across the
            next 3 years, starting with quick wins and moving towards more
            structural changes that support long-term decarbonisation.
          </p>

          <div className="grid grid-cols-2 gap-10 text-lg">
            <div>
              <h3 className="text-xl font-semibold mb-3">
                0–12 Months: Quick Wins
              </h3>
              <ul className="list-disc ml-6 space-y-2 leading-7">
                <li>
                  Introduce driver briefings on idling and smooth driving.
                </li>
                <li>Review routes to minimise empty or underfilled trips.</li>
                <li>
                  Check depot lighting schedules and switch off non-essential
                  loads out of hours.
                </li>
                <li>
                  Implement simple monitoring of monthly fuel and electricity
                  use using Carbon Central.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-3">
                12–36 Months: Strategic Moves
              </h3>
              <ul className="list-disc ml-6 space-y-2 leading-7">
                <li>
                  Deploy telematics to track driving patterns and mileage at a
                  finer level.
                </li>
                <li>
                  Gradually introduce more efficient or electric vehicles on
                  suitable routes.
                </li>
                <li>
                  Explore on-site solar or renewable power contracts for depots.
                </li>
                <li>
                  Integrate Carbon Central data with financial and operational
                  systems to track ROI from projects.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FORECAST & NET-ZERO PATHWAY */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">
            8. Forecast & Net-Zero Pathway
          </h2>

          <p className="text-lg leading-7 mb-6">
            This section provides a simple forward-looking view of your
            emissions under two scenarios: a business-as-usual baseline and an
            improvement scenario where the core operational actions outlined in
            this report are implemented.
          </p>

          <ForecastChart
            months={months}
            baseline={baselineForecast}
            reduced={reducedForecast}
          />

          {(() => {
            const latest = values[values.length - 1] || 0;
            const nextYearBaseline =
              values.length > 0
                ? baselineForecast[baselineForecast.length - 1]
                : 0;
            const nextYearReduced =
              values.length > 0
                ? reducedForecast[reducedForecast.length - 1]
                : 0;
            const yearlyAvoided = Math.max(
              nextYearBaseline - nextYearReduced,
              0
            );

            return (
              <div className="mt-8 space-y-3 text-lg">
                <p>
                  <strong>Latest reported month emissions:</strong>{' '}
                  {latest.toFixed(2)} kg CO₂e
                </p>
                <p>
                  <strong>
                    Projected next-year annual emissions (baseline):
                  </strong>{' '}
                  {formatTonne(nextYearBaseline * 12)}
                </p>
                <p>
                  <strong>
                    Projected next-year annual emissions (with actions):
                  </strong>{' '}
                  {formatTonne(nextYearReduced * 12)}
                </p>
                <p>
                  <strong>Indicative annual emissions avoided:</strong>{' '}
                  {formatTonne(yearlyAvoided * 12)}
                </p>
                <p className="mt-4 leading-7">
                  These figures are indicative and based on current data. As
                  more months and sites are added to Carbon Central, the
                  forecast will become more robust and can be aligned with
                  long-term net-zero commitments (for example, a 2040 or 2050
                  target).
                </p>
              </div>
            );
          })()}
        </section>

        {/* SECR SUMMARY */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">9. SECR Summary (UK)</h2>

          <p className="text-lg leading-7 mb-6">
            This section summarises key information typically required for
            Streamlined Energy and Carbon Reporting (SECR) in the UK. It is not
            a legal filing in itself but can be used to inform your formal
            disclosures.
          </p>

          <div className="space-y-4 text-lg">
            <div>
              <h3 className="text-xl font-semibold mb-2">Energy Consumption</h3>
              <p className="leading-7">
                Electricity consumption: {electricityTotal.toFixed(2)} kWh
              </p>
              <p className="leading-7">
                Fuel usage (litres, all fleet fuels): {fuelTotal.toFixed(2)} L
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Greenhouse Gas Emissions
              </h3>
              <p className="leading-7">
                Total emissions for the period: {formatTonne(co2Total)}
              </p>
              <p className="leading-7">
                Scope 1: fleet fuels and on-site combustion (where recorded).
              </p>
              <p className="leading-7">
                Scope 2: purchased electricity, location-based grid factors.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Energy Efficiency Actions
              </h3>
              <p className="leading-7">
                This report includes a set of operational and strategic actions
                designed to reduce energy consumption and associated emissions
                in line with good practice for logistics SMEs. Formal SECR
                filings should summarise which actions have been undertaken in
                the reporting year and, where possible, their estimated impact.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Responsibility & Governance
              </h3>
              <p className="leading-7">
                Directors remain responsible for ensuring that SECR disclosures
                are complete, accurate and in line with regulatory requirements.
                This report supports that process by collating key data in a
                decision-useful format.
              </p>
            </div>
          </div>
        </section>

        {/* AI INSIGHTS */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">
            10. AI-Powered Insights
          </h2>

          <p className="text-lg leading-7 mb-6">
            Carbon Central can apply AI analysis to highlight anomalies,
            outliers and opportunities that may not be immediately obvious from
            raw data alone. Below are indicative insights based on your current
            dataset.
          </p>

          <div className="space-y-4 text-lg">
            {(() => {
              const insights: string[] = [];

              if (values.length > 0) {
                const maxVal = Math.max(...values);
                const maxIdx = values.indexOf(maxVal);
                const maxMonth = months[maxIdx] || 'a recorded month';

                insights.push(
                  `Emissions in ${maxMonth} are notably higher than the rest of the period, indicating either a one-off operational spike or a data anomaly worth investigating.`
                );
              }

              const zeroElecMonths = list
                .filter((r: any) => safeNum(r.electricity_kw) === 0)
                .map((r: any) => r.month);
              if (zeroElecMonths.length > 0) {
                insights.push(
                  `Some months show zero recorded electricity use (${zeroElecMonths.join(
                    ', '
                  )}). This may be correct if sites were closed, but it can also signal missing meter readings.`
                );
              }

              if (fuelTotal > 0 && co2Total > 0) {
                const fuelShare =
                  (fuelTotal / (fuelTotal + electricityTotal + 1e-9)) * 100;
                if (fuelShare > 60) {
                  insights.push(
                    'Fleet fuel use accounts for a significant share of measured energy. Small changes in driving behaviour and routing may have a disproportionately large impact on your overall emissions.'
                  );
                }
              }

              if (insights.length === 0) {
                insights.push(
                  'No obvious anomalies or outliers were detected in the current dataset. As additional sites, months and data types are added, more advanced AI-driven insights will become available.'
                );
              }

              return (
                <ul className="list-disc ml-6 space-y-3 leading-7">
                  {insights.map((text, idx) => (
                    <li key={idx}>{text}</li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </section>

        {/* METHODOLOGY & GOVERNANCE */}
        <section className="px-16 py-12 page-break">
          <h2 className="text-3xl font-semibold mb-6">
            11. Methodology & Governance
          </h2>

          <div className="space-y-4 text-lg">
            <div>
              <h3 className="text-xl font-semibold mb-2">Methodology</h3>
              <p className="leading-7">
                Emissions are calculated using UK Government Greenhouse Gas
                Conversion Factors (DEFRA/BEIS, latest available). Electricity
                emissions use location-based grid factors; fuel emissions use
                standard kg CO₂e per litre factors. Refrigerant emissions, where
                recorded, are derived by multiplying leak quantities by global
                warming potential (GWP) values.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Organisational Boundary
              </h3>
              <p className="leading-7">
                This report assumes an operational control boundary, focusing on
                the UK-based operations managed day-to-day by your organisation.
                Additional regions or joint ventures can be incorporated as they
                are onboarded into Carbon Central.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Data Quality & Limitations
              </h3>
              <p className="leading-7">
                The quality of any carbon report depends on the completeness and
                accuracy of underlying data. Where fields are missing or
                estimated, the results should be interpreted with appropriate
                caution. Carbon Central will flag gaps and support a roadmap to
                improve data coverage over time.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Verification</h3>
              <p className="leading-7">
                This report has not been independently audited. If you require
                external assurance—for example, to support investor reporting or
                regulatory submissions—Carbon Central can be used as the data
                backbone for that process.
              </p>
            </div>
          </div>
        </section>

        {/* APPENDIX */}
        <section className="px-16 py-12">
          <h2 className="text-3xl font-semibold mb-6">
            12. Appendix: Underlying Data (Summary)
          </h2>

          <p className="text-lg leading-7 mb-4">
            The table below provides a compact view of the monthly data used in
            this report. Full detail remains accessible within the Carbon
            Central platform for audit and drill-down analysis.
          </p>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-blue-50 border-b border-blue-200">
                <th className="text-left px-2 py-2 font-semibold">Month</th>
                <th className="text-right px-2 py-2 font-semibold">
                  Electricity (kWh)
                </th>
                <th className="text-right px-2 py-2 font-semibold">
                  Diesel (L)
                </th>
                <th className="text-right px-2 py-2 font-semibold">
                  Petrol (L)
                </th>
                <th className="text-right px-2 py-2 font-semibold">
                  Gas (kWh)
                </th>
                <th className="text-right px-2 py-2 font-semibold">
                  Total (kg CO₂e)
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r: any, idx: number) => (
                <tr
                  key={r.id || idx}
                  className={idx % 2 === 0 ? 'bg-gray-50 border-b' : 'border-b'}
                >
                  <td className="px-2 py-2">{r.month}</td>
                  <td className="px-2 py-2 text-right">
                    {safeNum(r.electricity_kw).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {safeNum(r.diesel_litres).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {safeNum(r.petrol_litres).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {safeNum(r.gas_kwh).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {safeNum(r.total_co2e).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </body>
    </html>
  );
}
