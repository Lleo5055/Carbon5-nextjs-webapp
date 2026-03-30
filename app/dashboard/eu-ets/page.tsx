'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const CURRENT_YEAR = new Date().getFullYear();
const EU_COUNTRIES_SET = new Set(['AT','BE','DK','FR','DE','IE','IT','NL','PL','PT','ES','SE']);

type Installation = {
  id: string;
  installation_name: string;
  permit_number: string;
  activity_type: string;
  monitoring_methodology: string | null;
  is_active: boolean;
  created_at: string;
};

type Verification = {
  id: string;
  installation_id: string;
  reporting_year: number;
  status: VerificationStatus;
  verified_emissions: number | null;
  free_allocation: number | null;
  purchased_allowances: number | null;
  surrendered_allowances: number | null;
  surrender_deadline: string | null;
  surrender_status: string | null;
};

type VerificationStatus = 'draft' | 'submitted' | 'under_review' | 'verified' | 'approved' | 'surrendered';

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200' },
  submitted:    { label: 'Submitted',    color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  under_review: { label: 'Under review', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  verified:     { label: 'Verified',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  approved:     { label: 'Approved',     color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  surrendered:  { label: 'Surrendered',  color: 'text-slate-700',   bg: 'bg-slate-100',  border: 'border-slate-300' },
};

const COMPLIANCE_CALENDAR = [
  { date: `${CURRENT_YEAR}-03-31`, label: 'Verification deadline', description: 'Annual Emissions Report verified by accredited verifier', urgent: true },
  { date: `${CURRENT_YEAR}-04-30`, label: 'Surrender deadline', description: 'EU Allowances surrendered equal to verified emissions', urgent: true },
  { date: `${CURRENT_YEAR}-12-31`, label: 'Monitoring plan review', description: 'Annual review of monitoring plan required', urgent: false },
];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function EUETSDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const FINAL_STATUSES: VerificationStatus[] = ['verified', 'approved', 'surrendered'];

  async function handleDownload(installationId: string, permitNumber: string, status: VerificationStatus) {
    if (!FINAL_STATUSES.includes(status)) {
      const label = STATUS_CONFIG[status].label;
      const ok = window.confirm(
        `This verification record is still "${label}" and may be incomplete.\n\nDownloading now will include only the data entered so far. Continue?`
      );
      if (!ok) return;
    }
    setDownloadingId(installationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = `/api/eu-ets-verification?userId=${session.user.id}&token=${session.access_token}&installationId=${installationId}&year=${CURRENT_YEAR}&format=pdf`;
      const res = await fetch(url);
      if (!res.ok) { alert('Failed to generate report.'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `eu-ets-verification-${permitNumber.replace(/\s+/g, '-')}-${CURRENT_YEAR}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (!EU_COUNTRIES_SET.has(profile?.country ?? '')) {
        router.push('/dashboard');
        return;
      }

      const { data: instData } = await supabase
        .from('eu_ets_installations')
        .select('id, installation_name, permit_number, activity_type, monitoring_methodology, is_active, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });

      const instList = instData ?? [];
      setInstallations(instList);

      if (instList.length > 0) {
        const ids = instList.map(i => i.id);
        const { data: verData } = await supabase
          .from('eu_ets_verifications')
          .select('id, installation_id, reporting_year, status, verified_emissions, free_allocation, purchased_allowances, surrendered_allowances, surrender_deadline, surrender_status')
          .in('installation_id', ids)
          .eq('reporting_year', CURRENT_YEAR);
        setVerifications(verData ?? []);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  const currentVerifications = verifications.filter(v => v.reporting_year === CURRENT_YEAR);
  const totalVerifiedEmissions = currentVerifications.reduce((sum, v) => sum + (v.verified_emissions ?? 0), 0);
  const totalAllowances = currentVerifications.reduce((sum, v) => sum + (v.free_allocation ?? 0) + (v.purchased_allowances ?? 0), 0);
  const totalSurrendered = currentVerifications.reduce((sum, v) => sum + (v.surrendered_allowances ?? 0), 0);
  const allowancePosition = totalAllowances - totalSurrendered;
  const penaltyRisk = allowancePosition < 0 ? Math.abs(allowancePosition) * 100 : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            ← Dashboard
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">EU ETS</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">EU ETS Compliance Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track installations, verified emissions, allowance position and surrender obligations under the EU Emissions Trading System.
          </p>
        </div>

        {/* Compliance guide */}
        <div className="rounded-xl border border-slate-200 bg-white shadow overflow-hidden">
          <button onClick={() => setGuideOpen(o => !o)} className="w-full px-5 py-3 bg-slate-900 flex items-center gap-2 text-left">
            <span className="text-xs font-semibold text-white">How to use EU ETS on Greenio</span>
            <span className="text-[10px] text-slate-300">· Annual cycle, resets each Jan</span>
            <span className="ml-auto text-[10px] text-slate-300 flex items-center gap-1">
              {guideOpen ? 'Hide guide' : 'Show guide'}
              <span className={`transition-transform duration-200 inline-block ${guideOpen ? 'rotate-180' : ''}`}>▾</span>
            </span>
          </button>
          {guideOpen && (
            <>
              <div className="divide-y divide-slate-100">
                {[
                  { step: '1', title: 'Register your installation', desc: "Add each site covered by an EU ETS permit. You'll need the permit number, activity type, and monitoring plan details as approved by your national competent authority.", action: 'Installations → Add installation', href: '/dashboard/eu-ets/installations', deadline: null, color: 'bg-slate-800' },
                  { step: '2', title: 'Record energy & fuel use throughout the year', desc: 'Log monthly electricity, gas, diesel and other fuel consumption in the main Emissions section. This forms the basis of your Annual Emissions Report under MRR.', action: 'Emissions → Add entry', href: '/dashboard/emissions', deadline: null, color: 'bg-slate-700' },
                  { step: '3', title: 'Engage an accredited verifier', desc: 'Before 31 March, an EU-accredited verification body must audit your Annual Emissions Report under the EU MRR/AVR framework and issue a verification opinion.', action: null, href: null, deadline: '31 March deadline', color: 'bg-rose-700' },
                  { step: '4', title: 'Enter the verification record', desc: 'Open the installation \u2192 Verification tab. Record the verifier name, accreditation, opinion, verified emissions, and EUA figures. Set status to Verified once complete.', action: 'Installation \u2192 Verification tab', href: '/dashboard/eu-ets/installations', deadline: null, color: 'bg-violet-700' },
                  { step: '5', title: 'Surrender EU Allowances (EUAs)', desc: 'By 30 April, surrender EUAs equal to verified emissions via your EU Registry account (Union Registry). One EUA = one tonne CO\u2082e. Shortfalls incur a \u20ac100/tonne penalty.', action: 'Allowances tab to track position', href: '/dashboard/eu-ets/installations', deadline: '30 April deadline', color: 'bg-rose-700' },
                  { step: '6', title: 'Download your verification report', desc: 'Once status is Verified or Approved, download a PDF report from the Verification tab. Retain this as your compliance record for national authority audits.', action: 'Installation \u2192 Verification tab \u2192 Download', href: '/dashboard/eu-ets/installations', deadline: null, color: 'bg-emerald-700' },
                ].map(item => (
                  <div key={item.step} className="flex gap-4 px-5 py-4">
                    <div className={`shrink-0 w-6 h-6 rounded-full ${item.color} flex items-center justify-center`}>
                      <span className="text-[10px] font-bold text-white">{item.step}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                        {item.deadline && (
                          <span className="text-[10px] font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">{item.deadline}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                      {item.action && item.href && (
                        <Link href={item.href} className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-800">
                          {item.action} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                <p className="text-[11px] text-slate-500">Surplus EUAs after surrender can be banked for future compliance years or sold on the secondary market.</p>
              </div>
            </>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Installations</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{installations.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{installations.filter(i => i.is_active).length} active</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Verified emissions {CURRENT_YEAR}</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">
              {totalVerifiedEmissions > 0 ? totalVerifiedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">tCO₂e</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Allowance position</p>
            <p className={`text-2xl font-semibold mt-1 ${allowancePosition >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {allowancePosition >= 0 ? '+' : ''}{allowancePosition.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{allowancePosition >= 0 ? 'Surplus EUAs' : 'Shortfall'}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Penalty risk</p>
            <p className={`text-2xl font-semibold mt-1 ${penaltyRisk > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {penaltyRisk > 0 ? `€${penaltyRisk.toLocaleString()}` : '€0'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">€100/tonne shortfall</p>
          </div>
        </div>

        {/* Compliance calendar */}
        <section className="rounded-xl bg-white border border-slate-200 shadow">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Compliance calendar {CURRENT_YEAR}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {COMPLIANCE_CALENDAR.map(item => {
              const days = daysUntil(item.date);
              const isPast = days < 0;
              const isNear = days >= 0 && days <= 30;
              return (
                <div key={item.date} className="px-5 py-3 flex items-center gap-4">
                  <div className="shrink-0 w-20 text-right">
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className={`text-[10px] mt-0.5 font-medium ${isPast ? 'text-slate-400' : isNear ? 'text-rose-600' : 'text-slate-400'}`}>
                      {isPast ? 'Past' : `${days}d`}
                    </p>
                  </div>
                  <div className={`flex-1 border-l-2 pl-4 ${item.urgent && !isPast && isNear ? 'border-rose-300' : item.urgent && !isPast ? 'border-amber-300' : 'border-slate-200'}`}>
                    <p className="text-xs font-medium text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Installations list */}
        {installations.length === 0 ? (
          <section className="rounded-xl bg-white border p-8 text-center shadow">
            <p className="text-sm font-medium text-slate-800">No installations added yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add your permitted installations to start tracking EU ETS compliance.</p>
            <Link
              href="/dashboard/eu-ets/installations"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800"
            >
              + Add installation
            </Link>
          </section>
        ) : (
          <section className="rounded-xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Installations</h2>
              <Link
                href="/dashboard/eu-ets/installations"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-1.5 hover:bg-slate-800"
              >
                Manage →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-left font-medium text-slate-500">Installation</th>
                    <th className="p-3 text-left font-medium text-slate-500">Permit</th>
                    <th className="p-3 text-left font-medium text-slate-500">Activity</th>
                    <th className="p-3 text-right font-medium text-slate-500">Verification {CURRENT_YEAR}</th>
                    <th className="p-3 text-right font-medium text-slate-500">Position</th>
                    <th className="p-3 text-right font-medium text-slate-500">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {installations.map(inst => {
                    const ver = verifications.find(v => v.installation_id === inst.id);
                    const status = ver?.status as VerificationStatus | undefined;
                    const cfg = status ? STATUS_CONFIG[status] : null;
                    const pos = (ver?.free_allocation ?? 0) + (ver?.purchased_allowances ?? 0) - (ver?.surrendered_allowances ?? 0);
                    return (
                      <tr key={inst.id} className="border-b border-slate-100 last:border-0">
                        <td className="p-3">
                          <Link href={`/dashboard/eu-ets/installations/${inst.id}`} className="font-medium text-slate-800 hover:text-blue-700 underline underline-offset-2">
                            {inst.installation_name}
                          </Link>
                          {!inst.is_active && <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">Inactive</span>}
                        </td>
                        <td className="p-3 text-slate-600 font-mono">{inst.permit_number}</td>
                        <td className="p-3 text-slate-600 capitalize">{inst.activity_type.replace(/_/g, ' ')}</td>
                        <td className="p-3 text-right">
                          {cfg ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                              {cfg.label}
                            </span>
                          ) : (
                            <Link href={`/dashboard/eu-ets/installations/${inst.id}?tab=verification`} className="text-[10px] font-medium text-slate-400 hover:text-blue-600 underline underline-offset-2">
                              Not started
                            </Link>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {ver ? (
                            <span className={`font-semibold ${pos >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {pos >= 0 ? '+' : ''}{pos.toLocaleString()} EUAs
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {ver && status ? (() => {
                            const s = status as VerificationStatus;
                            const isFinal = FINAL_STATUSES.includes(s);
                            return (
                              <button
                                onClick={() => handleDownload(inst.id, inst.permit_number, s)}
                                disabled={downloadingId !== null}
                                title={!isFinal ? `Record is "${STATUS_CONFIG[s].label}" — may be incomplete` : 'Download verification report'}
                                className={`text-[10px] font-medium border rounded-full px-2.5 py-1 disabled:opacity-40 transition-colors ${
                                  isFinal
                                    ? 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                                    : 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                                }`}
                              >
                                {downloadingId === inst.id ? '…' : isFinal ? '↓ PDF' : '↓ PDF ⚠'}
                              </button>
                            );
                          })() : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}